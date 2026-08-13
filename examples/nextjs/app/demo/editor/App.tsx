import { type DriveStep, driver } from "driver.js";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "driver.js/dist/driver.css";
import readmeRawEn from "@editor-root/README.en.md";

import readmeRawZh from "@editor-root/README.md";
import {
  createAILanguageModelProvider,
  createLocalStorage,
  createS3Storage,
  type Editor,
  formatBytes,
  type Locale,
  loadStorageConfig,
  QingWuAIEditor,
  registerS3PreviewConfig,
  setAIProvider,
  setLocale,
  setStorageProvider,
  setToastProvider,
  startBrowserClipperReceiver,
  t,
  toast,
  validateAttachmentFile,
} from "@apricotdream/ai-editor";
import { toast as qwToast } from "@apricotdream/toast";

// 首页直接渲染 README.md；按当前语言切换中英文内容（传原始 markdown，由编辑器单次解析）

const AISettingsDialog = lazy(() =>
  import("@editor/components/ai-settings-dialog").then((m) => ({ default: m.AISettingsDialog })),
);
const StorageSettingsDialog = lazy(() =>
  import("@editor/components/storage-settings-dialog").then((m) => ({
    default: m.StorageSettingsDialog,
  })),
);

const DialogFallback = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
    <div className="relative bg-background rounded-2xl border border-default-200 p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  </div>
);

const FONT_KEY = "qingwu_font";
const AI_CONFIG_SESSION_KEY = "qingwu_ai_config_session";
const MODE_KEY = "qingwu_editor_mode";
// 演示用附件上传限制选项（可切换，默认单文件 50MB、总大小 100MB）
const ATTACHMENT_SIZE_OPTIONS = [
  { label: "10 MB", value: 10 * 1024 * 1024 },
  { label: "20 MB", value: 20 * 1024 * 1024 },
  { label: "50 MB", value: 50 * 1024 * 1024 },
  { label: "100 MB", value: 100 * 1024 * 1024 },
  { label: "200 MB", value: 200 * 1024 * 1024 },
];
const TOTAL_SIZE_OPTIONS = [
  { label: "50 MB", value: 50 * 1024 * 1024 },
  { label: "100 MB", value: 100 * 1024 * 1024 },
  { label: "200 MB", value: 200 * 1024 * 1024 },
  { label: "500 MB", value: 500 * 1024 * 1024 },
];
const DEFAULT_MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_ATTACHMENT_SIZE = 100 * 1024 * 1024;
const CLIPPER_ENABLED_KEY = "qingwu_clipper_enabled";
const CLIPPER_URL_KEY = "qingwu_clipper_url";

function getSavedMode(): "edit" | "view" {
  try {
    return (localStorage.getItem(MODE_KEY) as "edit" | "view") || "edit";
  } catch {
    return "edit";
  }
}

// Clipper 接收器默认开启，方便联调
function getClipperEnabled(): boolean {
  try {
    return localStorage.getItem(CLIPPER_ENABLED_KEY) !== "off";
  } catch {
    return true;
  }
}

// 编辑器提供给插件的访问路径，默认当前页面 origin
function getClipperUrl(): string {
  try {
    return (
      localStorage.getItem(CLIPPER_URL_KEY) ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173")
    );
  } catch {
    return "http://localhost:5173";
  }
}

function getInitialFont(): "sans" | "serif" | "mono" {
  try {
    return (localStorage.getItem(FONT_KEY) as "sans" | "serif" | "mono") || "sans";
  } catch {
    return "sans";
  }
}

/**
 * 初始化存储服务 - 优先 S3 配置，兼容旧 OSS/COS，最后用本地存储
 *
 * 从模块顶层移到组件 useEffect 内，避免：
 * 1. 库模式下宿主 import 时副作用被意外触发
 * 2. sessionStorage 损坏导致整页模块加载失败
 * 3. 测试环境无需 mock 即可隔离
 */
function initStorageService() {
  // 存储初始化 - 优先 S3 配置，兼容旧 OSS/COS，最后用本地存储
  // try/catch 防止 localStorage 中的旧/损坏配置导致 createS3Storage 抛异常，
  // 进而使整个 App 模块加载失败、页面空白；失败时 fallback 到 local storage
  try {
    const savedConfig = loadStorageConfig();
    if (savedConfig?.type === "s3") {
      const s3Opts = {
        endpoint: savedConfig.endpoint,
        bucket: savedConfig.bucket,
        region: savedConfig.region,
        accessKeyId: savedConfig.accessKeyId,
        secretAccessKey: savedConfig.secretAccessKey,
        customDomain: savedConfig.customDomain,
        uploadPrefix: savedConfig.uploadPrefix || "qingwu",
        nameTemplate: savedConfig.nameTemplate || "{timestamp}-{timezone}-{filename}.{ext}",
      };
      setStorageProvider(createS3Storage(s3Opts), savedConfig);
      registerS3PreviewConfig(s3Opts);
    } else if (savedConfig?.type === "oss") {
      const s3Opts = {
        endpoint: `https://${savedConfig.bucket}.${savedConfig.region}.aliyuncs.com`,
        bucket: savedConfig.bucket,
        region: savedConfig.region,
        accessKeyId: savedConfig.accessKeyId,
        secretAccessKey: savedConfig.accessKeySecret,
        customDomain: savedConfig.customDomain,
        uploadPrefix: savedConfig.uploadPrefix || "qingwu",
        nameTemplate: savedConfig.nameTemplate || "{timestamp}-{timezone}-{filename}.{ext}",
      };
      setStorageProvider(createS3Storage(s3Opts), {
        type: "s3",
        endpoint: s3Opts.endpoint,
        bucket: s3Opts.bucket,
        region: s3Opts.region,
        accessKeyId: s3Opts.accessKeyId,
        secretAccessKey: s3Opts.secretAccessKey,
        customDomain: s3Opts.customDomain,
      });
      registerS3PreviewConfig(s3Opts);
    } else if (savedConfig?.type === "cos") {
      const s3Opts = {
        endpoint: `https://cos.${savedConfig.region}.myqcloud.com`,
        bucket: savedConfig.bucket,
        region: savedConfig.region,
        accessKeyId: savedConfig.secretId,
        secretAccessKey: savedConfig.secretKey,
        customDomain: savedConfig.customDomain,
        uploadPrefix: savedConfig.uploadPrefix || "qingwu",
        nameTemplate: savedConfig.nameTemplate || "{timestamp}-{timezone}-{filename}.{ext}",
      };
      setStorageProvider(createS3Storage(s3Opts), {
        type: "s3",
        endpoint: s3Opts.endpoint,
        bucket: s3Opts.bucket,
        region: s3Opts.region,
        accessKeyId: s3Opts.accessKeyId,
        secretAccessKey: s3Opts.secretAccessKey,
        customDomain: s3Opts.customDomain,
      });
      registerS3PreviewConfig(s3Opts);
    } else {
      setStorageProvider(createLocalStorage(), {
        type: "local",
        location: "浏览器内存 (Base64 编码)",
      });
    }
  } catch (e) {
    console.warn("[App] 存储初始化失败，回退到本地存储:", e);
    qwToast.warn("存储初始化失败，已回退到本地存储");
    try {
      setStorageProvider(createLocalStorage(), {
        type: "local",
        location: "浏览器内存 (Base64 编码)",
      });
    } catch {
      /* give up */
    }
  }
}

/**
 * 初始化写作助手服务 - 从 sessionStorage 恢复
 * API Key 不再持久化到 localStorage，降低 XSS 窃取风险
 */
function initAIService() {
  try {
    const raw = sessionStorage.getItem(AI_CONFIG_SESSION_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.apiKey && cfg.baseURL && cfg.model) {
        createAILanguageModelProvider(cfg)
          .then(setAIProvider)
          .catch(() => {});
      }
    }
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [currentLocale, setCurrentLocale] = useState<Locale>("zh-CN");
  // 编辑器首页内容随语言切换：中文用 README.md，英文用 README.en.md（原始 markdown）
  const readmeContent = useMemo(
    () => (currentLocale === "en-US" ? readmeRawEn : readmeRawZh).replace(/\.\/public\//g, "/"),
    [currentLocale],
  );
  const [font, setFont] = useState<"sans" | "serif" | "mono">(getInitialFont);
  const [showAISettings, setShowAISettings] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const mainOriginalParent = useRef<HTMLElement | null>(null);
  const mainScrollY = useRef(0);

  // 初始化存储和写作助手服务（从模块顶层移入，避免库模式导入时副作用被触发）
  useEffect(() => {
    initStorageService();
    initAIService();
  }, []);
  const [editorFs, setEditorFs] = useState<"none" | "web" | "native">("none");

  const exitEditorWebFS = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    document.body.style.overflow = "";
    if (mainOriginalParent.current) {
      mainOriginalParent.current.appendChild(el);
      mainOriginalParent.current = null;
    }
    Object.assign(el.style, {
      position: "",
      top: "",
      left: "",
      width: "",
      height: "",
      zIndex: "",
      background: "",
      maxWidth: "",
      margin: "",
      padding: "",
    });
    requestAnimationFrame(() => window.scrollTo(0, mainScrollY.current));
  }, []);

  const enterEditorWebFS = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    mainScrollY.current = window.scrollY;
    mainOriginalParent.current = el.parentElement;
    document.body.appendChild(el);
    Object.assign(el.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      zIndex: "99998",
      background: "var(--background, #fff)",
      maxWidth: "none",
      margin: "0",
      padding: "24px",
      overflow: "auto",
    });
    document.body.style.overflow = "hidden";
  }, []);

  const toggleEditorWebFS = useCallback(() => {
    if (editorFs === "web") {
      exitEditorWebFS();
      setEditorFs("none");
    } else {
      if (editorFs === "native" && document.fullscreenElement) document.exitFullscreen();
      enterEditorWebFS();
      setEditorFs("web");
    }
  }, [editorFs, exitEditorWebFS, enterEditorWebFS]);

  const toggleEditorNativeFS = useCallback(async () => {
    const el = mainRef.current;
    if (!el) return;
    if (editorFs === "native") {
      await document.exitFullscreen();
      setEditorFs("none");
    } else {
      if (editorFs === "web") {
        exitEditorWebFS();
        setEditorFs("none");
      }
      mainScrollY.current = window.scrollY;
      await el.requestFullscreen();
      setEditorFs("native");
    }
  }, [editorFs, exitEditorWebFS]);

  useEffect(() => {
    const onFSChange = () => {
      if (!document.fullscreenElement && editorFs === "native") {
        setEditorFs("none");
        requestAnimationFrame(() => window.scrollTo(0, mainScrollY.current));
      }
    };
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, [editorFs]);
  const [showStorageSettings, setShowStorageSettings] = useState(false);

  // 编辑器模式持久化（仅模式，不持久化内容 - 内容始终用示例）
  const [editorMode, setEditorMode] = useState<"edit" | "view">(getSavedMode);

  const toggleMode = useCallback(() => {
    const next = editorMode === "edit" ? "view" : "edit";
    setEditorMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }, [editorMode]);

  // ===== Web Clipper 接收器（浏览器 postMessage 通道）=====
  // 插件通过 chrome.tabs.create 打开本页面后注入脚本 postMessage 推送剪藏内容，
  // 这里监听 message 事件，把 markdown 插入编辑器。
  const editorRef = useRef<Editor | null>(null);
  const onEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);
  // 附件上传限制（可切换，默认 50MB / 100MB），即时传入编辑器与测试区
  const [maxAttachmentSize, setMaxAttachmentSize] = useState(DEFAULT_MAX_ATTACHMENT_SIZE);
  const [maxTotalAttachmentSize, setMaxTotalAttachmentSize] = useState(
    DEFAULT_MAX_TOTAL_ATTACHMENT_SIZE,
  );
  // Toast 接入方式演示：内置默认 / onToast 实例级 / setToastProvider 全局
  type ToastMode = "default" | "onToast" | "provider";
  const [toastMode, setToastMode] = useState<ToastMode>("default");
  // provider 模式设置全局渲染器（消息带前缀以示区别），其余模式恢复内置默认
  useEffect(() => {
    if (toastMode === "provider") {
      setToastProvider((message, type) => {
        if (type === "success") qwToast.success(`[setToastProvider] ${message}`);
        else if (type === "info") qwToast.info(`[setToastProvider] ${message}`);
        else qwToast.error(`[setToastProvider] ${message}`);
      });
    } else {
      setToastProvider(null);
    }
    // 卸载时复位，避免全局渲染器泄漏到其他页面
    return () => setToastProvider(null);
  }, [toastMode]);
  // 上传限制测试区结果（仅本地校验大小，不触发真实上传）
  const [limitTestResults, setLimitTestResults] = useState<
    { name: string; size: number; ok: boolean; message?: string }[]
  >([]);
  const handleLimitTest = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const editor = editorRef.current;
      // 编辑器未就绪时用空文档校验（只测单文件限制）
      const doc = (editor?.state.doc ?? { descendants: () => {} }) as never;
      const results: { name: string; size: number; ok: boolean; message?: string }[] = [];
      for (const file of Array.from(files)) {
        const err = validateAttachmentFile(doc, file, {
          maxAttachmentSize,
          maxTotalAttachmentSize,
        });
        results.push({
          name: file.name,
          size: file.size,
          ok: !err,
          message: err ?? undefined,
        });
      }
      setLimitTestResults(results);
    },
    [maxAttachmentSize, maxTotalAttachmentSize],
  );
  const [clipperEnabled, setClipperEnabled] = useState(getClipperEnabled);
  const [clipperUrl, setClipperUrl] = useState(getClipperUrl);
  const [showClipperSettings, setShowClipperSettings] = useState(false);
  const [showClipperBanner, setShowClipperBanner] = useState(() => {
    try {
      return localStorage.getItem("qingwu_clipper_banner_dismissed") !== "1";
    } catch {
      return true;
    }
  });

  const toggleClipperEnabled = useCallback(() => {
    setClipperEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CLIPPER_ENABLED_KEY, next ? "on" : "off");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const updateClipperUrl = useCallback((url: string) => {
    setClipperUrl(url);
    try {
      localStorage.setItem(CLIPPER_URL_KEY, url);
    } catch {
      /* ignore */
    }
  }, []);

  // 接收器随开关状态启停
  useEffect(() => {
    if (!clipperEnabled) return;
    console.info(`[qingwu-clipper] 接收器已启动，插件应配置 editorUrl = ${clipperUrl}`);
    const receiver = startBrowserClipperReceiver({
      onClip: async (clip) => {
        const editor = editorRef.current;
        if (!editor) {
          qwToast.warn("编辑器尚未就绪，无法接收剪藏");
          return;
        }
        editor.commands.focus("end");
        const sep = editor.getText().trim() ? "\n\n---\n\n" : "";
        editor.commands.insertContent(sep + clip.markdown);
        qwToast.success("剪藏已插入编辑器");
      },
    });
    return () => receiver.close();
  }, [clipperEnabled, clipperUrl]);

  const toggleLocale = useCallback(() => {
    const next = currentLocale === "zh-CN" ? "en-US" : "zh-CN";
    setCurrentLocale(next);
    setLocale(next);
  }, [currentLocale]);

  // ===== driver.js 引导 tour =====
  const startTour = useCallback(() => {
    const steps: DriveStep[] = [
      {
        element: "header",
        popover: {
          title: t("tour.welcome.title"),
          description: t("tour.welcome.description"),
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '[data-tour="mode-toggle"]',
        popover: {
          title: t("tour.mode.title"),
          description: t("tour.mode.description"),
          side: "bottom",
          align: "center",
        },
      },
      {
        element: '[data-tour="fullscreen"]',
        popover: {
          title: t("tour.fullscreen.title"),
          description: t("tour.fullscreen.description"),
          side: "bottom",
          align: "center",
        },
      },
      {
        element: '[data-tour="ai-settings"]',
        popover: {
          title: t("tour.ai.title"),
          description: t("tour.ai.description"),
          side: "bottom",
          align: "center",
        },
      },
      {
        element: '[data-tour="lang-toggle"]',
        popover: {
          title: t("tour.lang.title"),
          description: t("tour.lang.description"),
          side: "bottom",
          align: "center",
        },
      },
      {
        element: '[data-tour="font-selector"]',
        popover: {
          title: t("tour.font.title"),
          description: t("tour.font.description"),
          side: "bottom",
          align: "center",
        },
      },
      {
        element: ".ProseMirror",
        popover: {
          title: t("tour.editor.title"),
          description: t("tour.editor.description"),
          side: "top",
          align: "center",
        },
      },
    ];

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayOpacity: 0.6,
      stageRadius: 8,
      steps,
      onDestroyed: () => {
        // tour 结束后清理引用
      },
    });

    driverObj.drive();
  }, []);

  const changeFont = useCallback((value: "sans" | "serif" | "mono") => {
    setFont(value);
    try {
      localStorage.setItem(FONT_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const fontClass = font === "serif" ? "font-serif" : font === "mono" ? "font-mono" : "font-sans";

  return (
    <div className={`min-h-screen bg-background text-foreground ${fontClass}`}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-default-200 bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-wide truncate">
              {t("app.title")}
            </h1>
            <span className="text-[11px] sm:text-xs text-default-400 hidden sm:inline">
              {t("app.subtitle")}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* Mode toggle */}
            <button
              type="button"
              data-tour="mode-toggle"
              className={`px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs rounded-lg border transition-colors shrink-0 ${
                editorMode === "view"
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                  : "border-default-200 hover:bg-default-100"
              }`}
              onClick={toggleMode}
              title={editorMode === "edit" ? "切换为只读查看" : "切换为编辑模式"}
            >
              {editorMode === "edit" ? "✏️" : "👁"}
            </button>

            {/* Editor fullscreen controls */}
            <button
              type="button"
              data-tour="fullscreen"
              className={`px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs rounded-lg border transition-colors shrink-0 ${
                editorFs === "web"
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                  : "border-default-200 hover:bg-default-100 text-default-500"
              }`}
              onClick={toggleEditorWebFS}
              title={editorFs === "web" ? "退出网页全屏" : "网页全屏"}
            >
              ⛶
            </button>
            <button
              type="button"
              className={`px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs rounded-lg border transition-colors shrink-0 ${
                editorFs === "native"
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                  : "border-default-200 hover:bg-default-100 text-default-500"
              }`}
              onClick={toggleEditorNativeFS}
              title={editorFs === "native" ? "退出全屏" : "全屏"}
            >
              ⛛
            </button>
            {/* Content save controls */}
            {/* 写作助手设置 */}
            <button
              type="button"
              data-tour="ai-settings"
              className="px-1.5 sm:px-2 py-1 text-sm text-default-500 hover:text-default-700 transition-colors shrink-0"
              onClick={() => setShowAISettings(true)}
              title="写作助手设置"
            >
              🤖
            </button>

            {/* Storage settings */}
            <button
              type="button"
              className="px-1.5 sm:px-2 py-1 text-sm text-default-500 hover:text-default-700 transition-colors shrink-0"
              onClick={() => setShowStorageSettings(true)}
              title="存储设置"
            >
              ☁️
            </button>

            {/* Web Clipper 接收器设置 */}
            <button
              type="button"
              className={`px-1.5 sm:px-2 py-1 text-sm transition-colors shrink-0 ${
                clipperEnabled
                  ? "text-qingwu-600 hover:text-qingwu-700"
                  : "text-default-500 hover:text-default-700"
              }`}
              onClick={() => setShowClipperSettings(true)}
              title="Web Clipper 接收器设置"
            >
              ✂️
            </button>

            {/* Tour / 引导 */}
            <button
              type="button"
              className="px-1.5 sm:px-2 py-1 text-sm text-default-400 hover:text-default-600 transition-colors shrink-0"
              onClick={startTour}
              title="使用引导"
            >
              ❓
            </button>

            {/* Language toggle */}
            <button
              type="button"
              data-tour="lang-toggle"
              className="px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs border border-default-200 rounded-lg hover:bg-default-100 transition-colors shrink-0"
              onClick={toggleLocale}
            >
              {currentLocale === "zh-CN" ? "EN" : "中"}
            </button>

            {/* Font switcher — mobile hidden */}
            <select
              data-tour="font-selector"
              className="hidden sm:block px-2 py-1 text-xs border border-default-200 rounded-lg bg-transparent hover:bg-default-100 transition-colors cursor-pointer"
              value={font}
              onChange={(e) => changeFont(e.target.value as "sans" | "serif" | "mono")}
            >
              <option value="sans">{t("app.font.sans")}</option>
              <option value="serif">{t("app.font.serif")}</option>
              <option value="mono">{t("app.font.mono")}</option>
            </select>

            {/* 移动端字体切换 - 紧凑按钮组 */}
            <div className="sm:hidden flex items-center gap-0.5">
              <button
                type="button"
                className={`px-1.5 py-1 text-[11px] rounded-md transition-colors ${
                  font === "sans"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-default-500 hover:bg-default-100"
                }`}
                onClick={() => changeFont("sans")}
                title={t("app.font.sans")}
              >
                Aa
              </button>
              <button
                type="button"
                className={`px-1.5 py-1 text-[11px] rounded-md transition-colors ${
                  font === "serif"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-default-500 hover:bg-default-100"
                }`}
                onClick={() => changeFont("serif")}
                title={t("app.font.serif")}
              >
                宋
              </button>
              <button
                type="button"
                className={`px-1.5 py-1 text-[11px] rounded-md transition-colors ${
                  font === "mono"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-default-500 hover:bg-default-100"
                }`}
                onClick={() => changeFont("mono")}
                title={t("app.font.mono")}
              >
                等
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Editor */}
      <main ref={mainRef} className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {showClipperBanner && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-qingwu-200 bg-qingwu-50 dark:border-qingwu-800 dark:bg-qingwu-900/20 text-sm">
            <span className="text-lg shrink-0">✂️</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground">青梧 Web Clipper 浏览器扩展</div>
              <div className="text-[12px] text-default-500 mt-0.5">
                一键剪藏网页到编辑器。快捷键{" "}
                <kbd className="px-1 py-0.5 rounded bg-default-100 dark:bg-default-800 text-[11px]">
                  Alt+Shift+C
                </kbd>{" "}
                剪藏当前页面。
              </div>
            </div>
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-lg bg-qingwu-600 text-white hover:bg-qingwu-700 transition-colors shrink-0"
              onClick={() => setShowClipperSettings(true)}
            >
              了解扩展
            </button>
            <button
              type="button"
              className="text-default-400 hover:text-default-600 text-lg leading-none shrink-0"
              title="关闭"
              onClick={() => {
                setShowClipperBanner(false);
                try {
                  localStorage.setItem("qingwu_clipper_banner_dismissed", "1");
                } catch {
                  /* ignore */
                }
              }}
            >
              ×
            </button>
          </div>
        )}
        <div className="mb-6">
          <p className="text-sm text-default-500 leading-relaxed">{t("editor.prompt")}</p>
        </div>

        {/* 附件上传限制演示面板 */}
        <div className="mb-6 rounded-xl border border-default-200 bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">附件上传限制</div>
            <div className="text-xs text-default-500">
              单文件 ≤ {formatBytes(maxAttachmentSize)} · 文档附件总大小 ≤{" "}
              {formatBytes(maxTotalAttachmentSize)}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-default-500">
              单文件上限
              <select
                value={maxAttachmentSize}
                onChange={(e) => setMaxAttachmentSize(Number(e.target.value))}
                className="rounded-lg border border-default-200 bg-background px-2 py-1 text-xs text-foreground outline-none transition-colors focus:border-qingwu-400"
              >
                {ATTACHMENT_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-default-500">
              总大小上限
              <select
                value={maxTotalAttachmentSize}
                onChange={(e) => setMaxTotalAttachmentSize(Number(e.target.value))}
                className="rounded-lg border border-default-200 bg-background px-2 py-1 text-xs text-foreground outline-none transition-colors focus:border-qingwu-400"
              >
                {TOTAL_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-default-500">
              Toast 接入方式
              <select
                value={toastMode}
                onChange={(e) => setToastMode(e.target.value as ToastMode)}
                className="rounded-lg border border-default-200 bg-background px-2 py-1 text-xs text-foreground outline-none transition-colors focus:border-qingwu-400"
              >
                <option value="default">内置默认 @apricotdream/toast</option>
                <option value="onToast">onToast 实例级</option>
                <option value="provider">setToastProvider 全局</option>
              </select>
            </label>
            <button
              type="button"
              className="rounded-lg border border-default-200 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-default-100"
              onClick={() => toast("Toast 提示通道工作正常（**info**）", "info")}
            >
              发送测试提示
            </button>
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-qingwu-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-qingwu-700">
              选择文件测试
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleLimitTest(e.target.files)}
              />
            </label>
            <span className="text-xs text-default-400">
              切换限制后编辑器即时生效；拖拽文件到下方编辑器可触发真实上传（未配置存储时保留占位）
            </span>
          </div>
          <div className="mt-2 text-[11px] text-default-400">
            {toastMode === "default" &&
              "内置默认：未传 onToast、未 setToastProvider，提示由随包内置 @apricotdream/toast 渲染（开箱即用）。"}
            {toastMode === "onToast" && "实例级：经 onToast 回调转发给宿主自己的 Toast 组件渲染。"}
            {toastMode === "provider" &&
              "全局级：setToastProvider() 替换默认渲染器，消息带 [setToastProvider] 前缀以示区别。"}
          </div>
          {limitTestResults.length > 0 && (
            <ul className="mt-3 space-y-1">
              {limitTestResults.map((result) => (
                <li
                  key={`${result.name}-${result.size}`}
                  className={`text-xs ${result.ok ? "text-green-600" : "text-danger"}`}
                >
                  {result.ok ? "✓ 通过" : "✗ 拦截"} {result.name}（{formatBytes(result.size)}）
                  {!result.ok && result.message ? ` — ${result.message}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <QingWuAIEditor
          initialContent={readmeContent}
          mode={editorMode}
          placeholder={t("editor.placeholder")}
          onEditorReady={onEditorReady}
          maxAttachmentSize={maxAttachmentSize}
          maxTotalAttachmentSize={maxTotalAttachmentSize}
          onToast={
            toastMode === "onToast"
              ? (message, type) => {
                  if (type === "success") qwToast.success(message);
                  else if (type === "info") qwToast.info(message);
                  else qwToast.error(message);
                }
              : undefined
          }
        />
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-8 text-center text-xs text-default-300">
        <p>{t("app.footer.line1")}</p>
        <p className="mt-1">{t("app.footer.license")}</p>
      </footer>

      {/* 写作助手设置对话框 */}
      {showAISettings && (
        <Suspense fallback={<DialogFallback />}>
          <AISettingsDialog open={showAISettings} onClose={() => setShowAISettings(false)} />
        </Suspense>
      )}

      {/* Storage Settings Dialog */}
      {showStorageSettings && (
        <Suspense fallback={<DialogFallback />}>
          <StorageSettingsDialog
            open={showStorageSettings}
            onClose={() => setShowStorageSettings(false)}
          />
        </Suspense>
      )}

      {/* Web Clipper 接收器设置面板 */}
      {showClipperSettings && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowClipperSettings(false)}
          />
          <div className="relative w-[calc(100vw-32px)] max-w-[460px] bg-background rounded-2xl border border-default-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-default-100">
              <h2 className="text-base font-semibold text-foreground">Web Clipper 接收器</h2>
              <button
                type="button"
                className="text-default-400 hover:text-default-600 text-xl leading-none"
                onClick={() => setShowClipperSettings(false)}
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="text-[11px] text-default-500 leading-relaxed">
                青梧 Web Clipper
                扩展剪藏网页后，通过本地接收器（http://127.0.0.1:7321）或浏览器通道推送至此编辑器。扩展可在
                Chrome / Edge / Firefox 加载。
              </div>
              {/* 扩展安装与使用教程 */}
              <div className="rounded-lg bg-default-50 dark:bg-default-900/30 p-3 space-y-2">
                <div className="text-xs font-medium text-foreground">安装与使用</div>
                <ol className="text-[11px] text-default-600 dark:text-default-300 space-y-1 list-decimal pl-4">
                  <li>
                    构建：
                    <code className="px-1 rounded bg-default-100 dark:bg-default-800">
                      cd extension &amp;&amp; ./build-extension.bat
                    </code>
                  </li>
                  <li>
                    Chrome 加载：
                    <code className="px-1 rounded bg-default-100 dark:bg-default-800">
                      chrome://extensions
                    </code>{" "}
                    → 开发者模式 → 加载{" "}
                    <code className="px-1 rounded bg-default-100 dark:bg-default-800">
                      dist/chrome
                    </code>
                  </li>
                  <li>
                    剪藏：网页按{" "}
                    <kbd className="px-1 rounded bg-default-100 dark:bg-default-800">
                      Alt+Shift+C
                    </kbd>{" "}
                    或点悬浮球
                  </li>
                  <li>推送：侧边栏保存后「推送到编辑器」（需下方开关开启）</li>
                </ol>
              </div>
              {/* 接收器开关 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">接收剪藏</div>
                  <div className="text-[11px] text-default-500 mt-0.5">
                    开启后，插件推送的剪藏会自动写入编辑器文末
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={clipperEnabled}
                  onClick={toggleClipperEnabled}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    clipperEnabled ? "bg-qingwu-600" : "bg-default-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      clipperEnabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              {/* 编辑器页面路径配置 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">编辑器页面路径</label>
                <div className="text-[11px] text-default-500">
                  插件降级推送时打开的编辑器地址。复制此值填到插件设置 → 推送方式 → 编辑器页面 URL
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clipperUrl}
                    onChange={(e) => updateClipperUrl(e.target.value)}
                    placeholder="http://localhost:5173"
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-default-50 border border-default-200 focus:border-qingwu-500 focus:bg-background outline-none text-foreground"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 text-xs rounded-lg bg-qingwu-600 text-white hover:bg-qingwu-700 transition-colors shrink-0"
                    onClick={() => {
                      navigator.clipboard?.writeText(clipperUrl).then(
                        () => setShowClipperSettings(false),
                        () => {},
                      );
                    }}
                    title="复制并关闭"
                  >
                    复制
                  </button>
                </div>
                <div className="text-[11px] text-default-400">
                  当前页面：{typeof window !== "undefined" ? window.location.origin : "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
