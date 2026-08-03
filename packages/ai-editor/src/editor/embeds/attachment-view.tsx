import type { FileViewerOptions } from "@file-viewer/core";
import { NodeViewWrapper } from "@tiptap/react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n";
import { removeStoredResource } from "../storage/remove-resource";
import { signPreviewUrl, signPreviewUrlHeaders } from "../storage/signed-fetch";
import { isDeleteConfirmActive, setDeleteConfirmActive } from "../utils/delete-confirm";
import { DeleteConfirmDialog } from "../utils/delete-confirm-dialog";

const FileViewer = lazy(() => import("@file-viewer/react"));

const openPreviewSources = new Set<string>();

// IDM 绕过策略：优先通过 /api/preview 服务端代理获取文件（代理 URL 不含扩展名，
// IDM 无法按扩展名拦截），回退到 XHR（部分旧版 IDM 不 hook XHR），最终兜底为直接 fetch。
// 获取成功后用 application/octet-stream 创建 Blob URL，避免 IDM 识别文件类型。

const FILE_VIEWER_OPTIONS = {
  rendererMode: "replace" as const,
  autoRenderers: true,
  theme: "light" as const,
  // 关闭 Shadow DOM，让外部 MutationObserver 能移除内部 <a download> 防止 IDM 拦截
  styleIsolation: "scoped" as const,
  // 附件卡片提供统一下载入口，关闭预览器内置下载，避免 PDF 出现重复"下载"提示
  toolbar: {
    position: "bottom-right" as const,
    download: false,
    permissions: { download: false },
  },
  pdf: {
    workerUrl: "/file-viewer/vendor/pdf/pdf.worker.mjs",
    cMapUrl: "/file-viewer/vendor/pdf/cmaps/",
    wasmUrl: "/file-viewer/vendor/pdf/wasm/",
    standardFontDataUrl: "/file-viewer/vendor/pdf/standard_fonts/",
    cjkFontFallbackPath: "/file-viewer/vendor/pdf/fonts/",
  },
  spreadsheet: {
    workerUrl: "/file-viewer/vendor/xlsx/sheet.worker.js",
  },
  docx: {
    workerUrl: "/file-viewer/vendor/docx/docx.worker.js",
    workerJsZipUrl: "/file-viewer/vendor/docx/jszip.min.js",
    backgroundColor: "#ffffff",
  },
  archive: {
    workerUrl: "/file-viewer/vendor/libarchive/worker-bundle.js",
    wasmUrl: "/file-viewer/vendor/libarchive/libarchive.wasm",
    cache: true,
    workerTimeoutMs: 30000,
  },
};

// 附件按扩展名懒加载对应 renderer：只下载用到的引擎，
// 避免静态 import preset-office 让全部重型引擎（pdf/excel/word/ppt/ofd）进入首屏。
type RendererFamily = "pdf" | "word" | "spreadsheet" | "presentation" | "archive" | "text";

const EXT_RENDERER: Record<string, RendererFamily> = {
  pdf: "pdf",
  docx: "word",
  docm: "word",
  dotx: "word",
  dotm: "word",
  doc: "word",
  dot: "word",
  rtf: "word",
  odt: "word",
  xlsx: "spreadsheet",
  xlsm: "spreadsheet",
  xlsb: "spreadsheet",
  xls: "spreadsheet",
  xltx: "spreadsheet",
  xlt: "spreadsheet",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  ods: "spreadsheet",
  numbers: "spreadsheet",
  pptx: "presentation",
  pptm: "presentation",
  potx: "presentation",
  potm: "presentation",
  ppsx: "presentation",
  ppsm: "presentation",
  ppt: "presentation",
  pot: "presentation",
  odp: "presentation",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  tgz: "archive",
  bz2: "archive",
  xz: "archive",
  zst: "archive",
  txt: "text",
  md: "text",
  log: "text",
  html: "text",
  htm: "text",
  css: "text",
  js: "text",
  jsx: "text",
  ts: "text",
  tsx: "text",
  py: "text",
  sh: "text",
  sql: "text",
  json: "text",
  xml: "text",
  yml: "text",
  yaml: "text",
};

const RENDERER_LOADERS: Record<RendererFamily, () => Promise<unknown>> = {
  pdf: () => import("@file-viewer/renderer-pdf").then((m) => m.pdfRenderer),
  word: () => import("@file-viewer/renderer-word").then((m) => m.wordRenderer),
  spreadsheet: () => import("@file-viewer/renderer-spreadsheet").then((m) => m.spreadsheetRenderer),
  presentation: () =>
    import("@file-viewer/renderer-presentation").then((m) => m.presentationRenderer),
  archive: () => import("@file-viewer/renderer-archive").then((m) => m.archiveRenderer),
  text: () => import("@file-viewer/renderer-text").then((m) => m.textRenderer),
};

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const typeMap: Record<string, { label: string; color: string }> = {
    pdf: { label: "PDF", color: "#ef4444" },
    doc: { label: "DOC", color: "#2563eb" },
    docx: { label: "DOC", color: "#2563eb" },
    dot: { label: "DOT", color: "#2563eb" },
    dotx: { label: "DOT", color: "#2563eb" },
    xls: { label: "XLS", color: "#16a34a" },
    xlsx: { label: "XLS", color: "#16a34a" },
    xlt: { label: "XLT", color: "#16a34a" },
    xltx: { label: "XLT", color: "#16a34a" },
    csv: { label: "CSV", color: "#16a34a" },
    ppt: { label: "PPT", color: "#ea580c" },
    pptx: { label: "PPT", color: "#ea580c" },
    pot: { label: "POT", color: "#ea580c" },
    potx: { label: "POT", color: "#ea580c" },
    zip: { label: "ZIP", color: "#ca8a04" },
    rar: { label: "RAR", color: "#ca8a04" },
    "7z": { label: "7Z", color: "#ca8a04" },
    tar: { label: "TAR", color: "#ca8a04" },
    gz: { label: "GZ", color: "#ca8a04" },
    txt: { label: "TXT", color: "#6b7280" },
    md: { label: "MD", color: "#6b7280" },
    log: { label: "LOG", color: "#6b7280" },
    html: { label: "HTM", color: "#7c3aed" },
    htm: { label: "HTM", color: "#7c3aed" },
    css: { label: "CSS", color: "#7c3aed" },
    js: { label: "JS", color: "#7c3aed" },
    jsx: { label: "JSX", color: "#7c3aed" },
    ts: { label: "TS", color: "#7c3aed" },
    tsx: { label: "TSX", color: "#7c3aed" },
    json: { label: "JSON", color: "#7c3aed" },
    xml: { label: "XML", color: "#7c3aed" },
  };
  const t = typeMap[ext] || {
    label: ext ? ext.slice(0, 3).toUpperCase() : "FILE",
    color: "#6b7280",
  };
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 2h7l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
        fill="#fff"
        stroke={t.color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13 2v5h5" fill="none" stroke={t.color} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="5" y="14" width="14" height="6.5" rx="1.2" fill={t.color} />
      <text
        x="12"
        y="19"
        textAnchor="middle"
        fontSize="5"
        fontWeight="700"
        fill="#fff"
        fontFamily="Arial, sans-serif"
      >
        {t.label}
      </text>
    </svg>
  );
}

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

function isPreviewable(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  // @file-viewer/react-full 支持 206+ 种文件格式在线预览
  return /^(pdf|docx?|dotx?|xlsx?|xltx?|pptx?|potx?|txt|md|html?|csv|json|xml|yml|yaml|log|zip|rar|7z|tar|gz|odt|ods|odp|rtf|xlsm|xlsb|ppsx|numbers|tgz|bz2|xz|zst|js|ts|tsx|py|sh|sql)$/.test(
    ext,
  );
}

function shouldFetchForPreview(url: string): boolean {
  return Boolean(url) && !url.startsWith("file:");
}

/** base64url 编码，用于 /api/preview 代理路径规避 IDM 扩展名拦截 */
function encodePreviewPath(url: string): string {
  return btoa(encodeURIComponent(url)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 通过 /api/preview 代理获取文件 buffer。
 * 代理 URL 不含文件扩展名，可绕过 IDM 的扩展名拦截。
 * 若 /api/preview 端点不存在或返回 SPA fallback HTML，则返回 null（调用方回退到直接请求）。
 */
async function fetchViaPreviewProxy(
  targetUrl: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer | null> {
  try {
    const encoded = encodePreviewPath(targetUrl);
    const res = await fetch(`/api/preview/${encoded}`, {
      signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("Content-Type") || "";
    // SPA fallback（如 dev server 返回 index.html）表示代理端点不存在
    if (ct.includes("text/html")) {
      console.warn(
        "[attachment] /api/preview returned HTML (endpoint missing), fallback to direct XHR",
      );
      return null;
    }
    const buf = await res.arrayBuffer();
    const expectedLen = Number(res.headers.get("Content-Length") || 0);
    if (buf.byteLength > 0 && (expectedLen === 0 || buf.byteLength === expectedLen)) {
      return buf;
    }
    console.warn("[attachment] /api/preview data incomplete");
    return null;
  } catch {
    return null;
  }
}

/**
 * 用 XMLHttpRequest 获取 ArrayBuffer，替代 fetch。
 * 部分 IDM 版本只 hook fetch 不 hook XHR，用 XHR 可绕过拦截。
 */
function fetchArrayBufferXHR(
  url: string,
  headers?: Record<string, string>,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    if (headers) {
      // 跳过浏览器禁止通过 XHR 设置的头（如 Host），浏览器会自动设置
      const forbidden = [
        "host",
        "connection",
        "content-length",
        "cookie",
        "date",
        "expect",
        "keep-alive",
        "origin",
        "referer",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "via",
      ];
      for (const [key, value] of Object.entries(headers)) {
        if (forbidden.includes(key.toLowerCase())) continue;
        try {
          xhr.setRequestHeader(key, value);
        } catch {
          /* 部分头不能设置，忽略 */
        }
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error(`HTTP ${xhr.status} ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error("XHR network error"));
    xhr.ontimeout = () => reject(new Error("XHR timeout"));
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Aborted", "AbortError"));
      });
    }
    xhr.send();
  });
}

export function AttachmentView({ node, deleteNode, selected, editor }: any) {
  const isEditable = editor?.isEditable ?? true;
  const initialSrc: string = node.attrs.src || "";
  const [showPreview, setShowPreviewState] = useState(() => openPreviewSources.has(initialSrc));
  const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadTip, setDownloadTip] = useState<"loading" | "success" | "error" | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fetchedSrcRef = useRef<string | null>(null);
  const savedScrollYRef = useRef<number>(0);
  const keepPreviewOpenRef = useRef(false);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const savedPreviewScrollRef = useRef<number>(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // 保存触发删除时的选区范围，避免确认框交互破坏 ProseMirror 选区
  const deleteSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const [previewRenderKey, _setPreviewRenderKey] = useState(0);
  const [fsMode, setFsMode] = useState<"none" | "web" | "native">("none");
  // 当前附件类型对应的渲染引擎（懒加载，避免首屏背负全部引擎）
  const [renderer, setRenderer] = useState<unknown>(undefined);
  const [rendererError, setRendererError] = useState(false);
  const src: string = node.attrs.src || "";
  // 名称兜底链：attrs.name → URL 文件名 → 无 src 时标记「附件已丢失」
  // （历史版本存库的节点缺 data-src/data-name，或对象存储中的文件已被删除）。
  const name: string =
    node.attrs.name ||
    (src ? src.split("/").pop()?.split("?")[0] || "" : "") ||
    (src ? "attachment" : t("editor.attachment.lost"));
  const size: number = node.attrs.size || 0;
  const ext = fileExt(name);
  // 丢失态：src 缺失 → 无法预览/下载，仅保留删除，避免给用户可点但必然失败的按钮
  const lost = !src;

  // 按扩展名懒加载渲染引擎；切换文件类型时先清空旧引擎，避免用错误引擎挂载新文件
  useEffect(() => {
    if (!showPreview) {
      setRenderer(undefined);
      setRendererError(false);
      return;
    }
    const family = EXT_RENDERER[ext];
    if (!family) {
      setRenderer(undefined);
      setRendererError(false);
      return;
    }
    let active = true;
    setRenderer(undefined);
    setRendererError(false);
    RENDERER_LOADERS[family]()
      .then((loaded) => {
        if (active) setRenderer(loaded);
      })
      .catch((err) => {
        console.error(`[attachment] renderer "${family}" load failed:`, err);
        if (active) setRendererError(true);
      });
    return () => {
      active = false;
    };
  }, [showPreview, ext]);

  // 引擎加载完成后才渲染 FileViewer；renderers 用 replace 模式，只挂当前文件类型的引擎
  const fileViewerOptions = useMemo<FileViewerOptions>(
    () => ({
      ...FILE_VIEWER_OPTIONS,
      renderers: renderer
        ? ([renderer] as unknown as NonNullable<FileViewerOptions["renderers"]>)
        : [],
      rendererMode: "replace",
    }),
    [renderer],
  );

  const setShowPreview = useCallback(
    (value: boolean | ((current: boolean) => boolean)) => {
      setShowPreviewState((current) => {
        const next = typeof value === "function" ? value(current) : value;
        if (src) {
          if (next) openPreviewSources.add(src);
          else openPreviewSources.delete(src);
        }
        return next;
      });
    },
    [src],
  );

  useEffect(() => {
    setShowPreviewState(src ? openPreviewSources.has(src) : false);
  }, [src]);

  const restoreAfterFullscreen = useCallback(() => {
    keepPreviewOpenRef.current = true;
    setShowPreview(true);
    window.setTimeout(() => {
      window.scrollTo(0, savedScrollYRef.current);
      if (previewScrollRef.current)
        previewScrollRef.current.scrollTop = savedPreviewScrollRef.current;
      if (keepPreviewOpenRef.current) setShowPreview(true);
      keepPreviewOpenRef.current = false;
    }, 0);
  }, [setShowPreview]);

  const handleWebFS = useCallback(async () => {
    if (fsMode === "web") {
      setFsMode("none");
      document.body.style.overflow = "";
      restoreAfterFullscreen();
    } else {
      if (fsMode === "native" && document.fullscreenElement) {
        await document.exitFullscreen();
      }
      savedScrollYRef.current = window.scrollY;
      savedPreviewScrollRef.current = previewScrollRef.current?.scrollTop ?? 0;
      document.body.style.overflow = "hidden";
      setFsMode("web");
    }
  }, [fsMode]);

  const handleNativeFS = useCallback(async () => {
    const el = previewContainerRef.current;
    if (!el) return;
    if (fsMode === "native") {
      await document.exitFullscreen();
    } else {
      if (fsMode === "web") {
        setFsMode("none");
        document.body.style.overflow = "";
      }
      savedScrollYRef.current = window.scrollY;
      savedPreviewScrollRef.current = previewScrollRef.current?.scrollTop ?? 0;
      await el.requestFullscreen();
      setFsMode("native");
    }
  }, [fsMode, restoreAfterFullscreen]);

  const togglePreview = useCallback(() => {
    if (fsMode !== "none") return;
    if (keepPreviewOpenRef.current) return;
    setShowPreview((value) => !value);
  }, [fsMode]);

  useEffect(() => {
    const onFSChange = () => {
      if (!document.fullscreenElement) {
        if (fsMode === "native") {
          setFsMode("none"); /* 不重挂 FileViewer，与网页全屏一致保留预览状态 */
        }
        restoreAfterFullscreen();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fsMode === "web") {
        setFsMode("none");
        document.body.style.overflow = "";
        restoreAfterFullscreen();
      }
    };
    document.addEventListener("fullscreenchange", onFSChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFSChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [fsMode, restoreAfterFullscreen]);

  // Backspace/Delete 键删除附件（附件节点被选中时触发）
  // 多选时共享标志位防止重复弹框
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (!isEditable) return;
      if (!selected) return;
      if (isDeleteConfirmActive()) return; // 已有确认框，跳过
      e.preventDefault();
      e.stopPropagation();
      if (editor) {
        const { from, to } = editor.state.selection;
        deleteSelectionRef.current = { from, to };
      }
      // 清除浏览器选区（删除范围已存入 ref），防止确认框文字被全选高亮
      window.getSelection()?.removeAllRanges();
      setDeleteConfirmActive(true);
      setShowDeleteConfirm(true);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selected, editor, isEditable]);

  // fetch ArrayBuffer：用 XHR 替代 fetch 规避 IDM 拦截
  useEffect(() => {
    if (!showPreview || !shouldFetchForPreview(src)) {
      setPreviewBuffer(null);
      setPreviewError(null);
      fetchedSrcRef.current = null;
      return;
    }
    if (fetchedSrcRef.current === src) {
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setPreviewError(null);

    (async () => {
      const isPresigned = src.includes("?X-Amz-");

      let buffer: ArrayBuffer | null = null;
      let lastError: Error | null = null;

      // 方法0: /api/preview 代理 — 所有 URL 优先走代理，代理 URL 无扩展名绕过 IDM
      if (!buffer && !isPresigned) {
        buffer = await fetchViaPreviewProxy(src, controller.signal);
      }

      // 方法1: S3 预签名 + /api/preview 代理，回退 XHR
      if (!buffer && !isPresigned) {
        try {
          const presignedUrl = await signPreviewUrl(src);
          if (presignedUrl) {
            const proxyBuffer = await fetchViaPreviewProxy(presignedUrl, controller.signal);
            if (proxyBuffer) {
              buffer = proxyBuffer;
            } else {
              buffer = await fetchArrayBufferXHR(presignedUrl, undefined, controller.signal);
            }
          }
        } catch (e) {
          console.warn("[attachment] signPreviewUrl failed:", e);
        }
      }

      // 方法2: S3 签名头 + XHR（CORS 预检需 S3 允许 Authorization）
      if (!buffer && !isPresigned) {
        try {
          const signedHeaders = await signPreviewUrlHeaders(src);
          if (signedHeaders) {
            const headers: Record<string, string> = { "X-Requested-With": "XMLHttpRequest" };
            signedHeaders.forEach((v, k) => {
              headers[k] = v;
            });
            try {
              buffer = await fetchArrayBufferXHR(src, headers, controller.signal);
            } catch (e) {
              console.warn("[attachment] signed headers XHR failed:", e);
              lastError = e instanceof Error ? e : new Error(String(e));
            }
          }
        } catch (e) {
          console.warn("[attachment] signPreviewUrlHeaders failed:", e);
        }
      }

      // 方法3: 直接 XHR（公开 URL 或预签名 URL，/api/preview 不可用时的兜底）
      if (!buffer) {
        try {
          buffer = await fetchArrayBufferXHR(
            src,
            isPresigned ? undefined : { "X-Requested-With": "XMLHttpRequest" },
            controller.signal,
          );
        } catch (e) {
          console.warn("[attachment] plain XHR failed:", e);
          lastError = e instanceof Error ? e : new Error(String(e));
        }
      }

      if (!buffer) {
        throw lastError || new Error("所有 fetch 方法均失败");
      }
      if (!active) return;
      setPreviewBuffer(buffer);
      fetchedSrcRef.current = src;
      // blob 用 application/octet-stream 类型，IDM 不识别
      const blobUrl = URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
      setBlobUrl(blobUrl);
      setLoading(false);
    })().catch((error) => {
      if (!active) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      // 若同一 src 已成功预览过，不要用错误覆盖已显示的 PDF
      if (fetchedSrcRef.current === src) {
        setLoading(false);
        return;
      }
      setPreviewError(
        error instanceof Error ? error.message : "附件读取失败，请检查对象存储 CORS 和公开访问权限",
      );
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [showPreview, src]);

  // 组件卸载时释放 blob URL 与 ArrayBuffer，避免大文件常驻内存
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setPreviewBuffer(null);
    };
    // 仅在卸载时执行，依赖项故意为空
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // src 变化时释放上一次的 blob URL 和缓冲，避免切换附件时内存累积
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setPreviewBuffer(null);
      fetchedSrcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // 成功/失败提示短暂保留；下载中状态持续到请求结束
  useEffect(() => {
    if (downloadTip !== "success" && downloadTip !== "error") return;
    const timer = window.setTimeout(() => setDownloadTip(null), 2400);
    return () => window.clearTimeout(timer);
  }, [downloadTip]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setDownloadTip("loading");
    try {
      // 优先用已缓存的 blob URL（预览时已下载到内存）
      if (blobUrl) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setDownloadTip("success");
        return;
      }
      // 否则多级回退 fetch（与预览相同逻辑），私有桶直接 a.href=src 会 AccessDenied
      const isPresigned = src.includes("?X-Amz-");
      let response: Response | null = null;
      // 方法1: 预签名 URL
      if (!isPresigned) {
        try {
          const presignedUrl = await signPreviewUrl(src);
          if (presignedUrl) {
            response = await fetch(presignedUrl, {
              headers: { "X-Requested-With": "XMLHttpRequest" },
            });
            if (!response.ok) response = null;
          }
        } catch {}
      }
      // 方法2: 签名头
      if (!response && !isPresigned) {
        try {
          const signedHeaders = await signPreviewUrlHeaders(src);
          if (signedHeaders) {
            response = await fetch(src, {
              headers: (() => {
                const h = new Headers(signedHeaders);
                h.set("X-Requested-With", "XMLHttpRequest");
                return h;
              })(),
            });
            if (!response.ok) response = null;
          }
        } catch {}
      }
      // 方法3: 直接 fetch（公开桶或预签名 URL）
      if (!response) {
        response = await fetch(src, { headers: { "X-Requested-With": "XMLHttpRequest" } });
      }
      if (!response || !response.ok) throw new Error("下载失败");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadTip("success");
    } catch (e) {
      console.error("[attachment] download failed:", e);
      setDownloadTip("error");
    } finally {
      setDownloading(false);
    }
  }, [src, name, blobUrl]);

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      as="div"
      className={`attachment-embed group/att ${selected ? "is-selected" : ""}`}
      contentEditable={false}
    >
      <div
        className="att-inner"
        style={
          selected
            ? { outline: "2px solid var(--primary, #6366f1)", outlineOffset: "2px" }
            : undefined
        }
      >
        {/* Header */}
        <div className="att-header">
          <div className="att-info">
            <span className="att-icon">
              {lost ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ color: "#9ca3af" }}
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
              ) : (
                fileIcon(name)
              )}
            </span>
            <div className="att-meta">
              <span className="att-name">{name}</span>
              {size > 0 && <span className="att-size">{formatSize(size)}</span>}
            </div>
          </div>

          <div className="att-tools">
            <div
              className="att-download-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {downloadTip === "loading" && (
                <span className="att-download-status__content is-loading">
                  <svg
                    className="att-download-spinner"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" d="M12 2a10 10 0 1 0 10 10" />
                  </svg>
                  正在准备
                </span>
              )}
              {downloadTip === "success" && (
                <span className="att-download-status__content is-success">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
                  </svg>
                  已下载
                </span>
              )}
              {downloadTip === "error" && (
                <span className="att-download-status__content is-error">下载失败，请重试</span>
              )}
            </div>
            <div className="att-actions">
              {src && isPreviewable(name) && (
                <button
                  type="button"
                  className="att-btn"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePreview();
                  }}
                  title={t("editor.attachment.preview")}
                  aria-label={t("editor.attachment.preview")}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="att-btn"
                onClick={handleDownload}
                disabled={downloading || lost}
                title={downloading ? "正在准备下载" : t("editor.attachment.download")}
                aria-label={downloading ? "正在准备下载" : t("editor.attachment.download")}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>
              {isEditable && (
                <button
                  type="button"
                  className="att-btn att-btn--del"
                  onClick={() => {
                    if (!isEditable || isDeleteConfirmActive()) return;
                    setDeleteConfirmActive(true);
                    setShowDeleteConfirm(true);
                  }}
                  title={t("editor.attachment.delete")}
                  aria-label={t("editor.attachment.delete")}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* FileViewer 预览区 */}
        {showPreview && (
          <div
            ref={previewContainerRef}
            className={`att-preview-wrap ${fsMode === "web" ? "is-web-fs" : ""}`}
            style={{ position: "relative", height: 500, overflow: "hidden", background: "#fff" }}
          >
            {/* 滚动内容区 - 与悬浮控件隔离 */}
            <div
              ref={previewScrollRef}
              className="att-preview-scroll"
              style={{ height: "100%", overflow: "auto" }}
            >
              {loading && !previewBuffer && !blobUrl ? (
                <div className="flex items-center justify-center h-full text-default-400 text-sm">
                  {t("editor.attachment.loadingPreview")}
                </div>
              ) : (previewError || rendererError) && !previewBuffer && !blobUrl ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-default-500">
                  <div className="font-medium text-default-700">暂时无法预览此附件</div>
                  <div className="max-w-md text-xs leading-relaxed">
                    请稍后重试，或使用附件栏中的下载按钮。
                  </div>
                </div>
              ) : (
                <Suspense
                  fallback={
                    <div
                      className="flex items-center justify-center h-full text-default-400 text-sm"
                      style={{ background: "#fff" }}
                    >
                      {t("editor.attachment.loadingPreview")}
                    </div>
                  }
                >
                  {previewBuffer || blobUrl || src ? (
                    renderer ? (
                      <FileViewer
                        key={`${src}-${previewRenderKey}`}
                        buffer={previewBuffer || undefined}
                        url={blobUrl || src}
                        name={name}
                        filename={name}
                        type={ext}
                        size={size || previewBuffer?.byteLength || 0}
                        options={fileViewerOptions}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-default-400">
                        正在加载预览引擎...
                      </div>
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-default-400">
                      正在加载...
                    </div>
                  )}
                </Suspense>
              )}
            </div>
            {/* 悬浮全屏控件 - 在滚动容器外部，不与内容冲突 */}
            <div
              className="att-fs-controls__panel"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 10,
                display: "flex",
                gap: 2,
                padding: 4,
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <button
                type="button"
                onClick={handleWebFS}
                title={fsMode === "web" ? "退出网页全屏" : "网页全屏"}
                aria-label={fsMode === "web" ? "退出网页全屏" : "网页全屏"}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "none",
                  background: fsMode === "web" ? "#e4e4e7" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#52525b",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (fsMode !== "web") e.currentTarget.style.background = "#f4f4f5";
                }}
                onMouseLeave={(e) => {
                  if (fsMode !== "web") e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleNativeFS}
                title={fsMode === "native" ? "退出全屏" : "全屏"}
                aria-label={fsMode === "native" ? "退出全屏" : "全屏"}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "none",
                  background: fsMode === "native" ? "#e4e4e7" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#52525b",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (fsMode !== "native") e.currentTarget.style.background = "#f4f4f5";
                }}
                onMouseLeave={(e) => {
                  if (fsMode !== "native") e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 删除确认对话框 - select-none + onMouseDown preventDefault 防止 Ctrl+A 全选时把弹框文字也选中 */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title="确认删除附件"
        message={
          lost
            ? `此操作将删除该附件节点，不可撤销。`
            : `此操作将同时删除对象存储中的文件（${name}），不可撤销。`
        }
        onCancel={() => {
          setDeleteConfirmActive(false);
          setShowDeleteConfirm(false);
        }}
        onConfirm={async () => {
          try {
            if (editor) {
              const range = deleteSelectionRef.current;
              const from = range?.from ?? editor.state.selection.from;
              const to = range?.to ?? editor.state.selection.to;
              const cleanups: Promise<void>[] = [];
              editor.state.doc.nodesBetween(from, to, (n: any) => {
                if (n.type.name === "attachmentEmbed" && n.attrs?.src) {
                  cleanups.push(removeStoredResource(n.attrs.src));
                }
              });
              await Promise.all(cleanups);
              setDeleteConfirmActive(false);
              await new Promise((r) => setTimeout(r, 300));
              editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
            } else {
              await removeStoredResource(src);
              setDeleteConfirmActive(false);
              await new Promise((r) => setTimeout(r, 300));
              deleteNode();
            }
          } catch {
            setDeleteConfirmActive(false);
          }
        }}
      />
    </NodeViewWrapper>
  );
}
