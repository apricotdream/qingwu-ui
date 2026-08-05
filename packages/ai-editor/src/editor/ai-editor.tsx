import type { Editor } from "@tiptap/core";

import { type Fragment, DOMParser as PmDOMParser, Slice } from "@tiptap/pm/model";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  type FC,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SearchBar } from "../components/search-bar";
import type { ToastOptions, ToastType } from "../components/toast";
import { subscribeToast, toast } from "../components/toast";
import { TocPanel } from "../components/toc";
import { AISelector } from "./ai/components/ai-selector";
import { formatBytes, getDocAttachmentTotal, validateAttachmentFile } from "./attachment-limits";
import { getEditorExtensions } from "./extensions";
import { type BubbleMenuAction, getBubbleMenuActions } from "./extensions/bubble-menu";
import { TableToolbar } from "./extensions/table-toolbar";
import { t } from "./i18n";
import { MoreIcon, SparklesIcon } from "./icons";
import { sanitizeHtml } from "./utils/sanitize";

type FloatingPoint = { top: number; left: number; width: number };
/** 气泡菜单强调色预设 */
const HIGHLIGHT_COLORS = [
  { color: "#fef08a", name: "黄" },
  { color: "#bbf7d0", name: "绿" },
  { color: "#bfdbfe", name: "蓝" },
  { color: "#fbcfe8", name: "粉" },
  { color: "#fed7aa", name: "橙" },
  { color: "#ddd6fe", name: "紫" },
];

/** AI 面板固定宽度（与 AISelector 内部一致，避免测量偏差） */
const AI_PANEL_WIDTH = 288;
/** 翻转判断用面板高度估算，渲染后 useLayoutEffect 会用真实高度校正 */
const AI_PANEL_HEIGHT_ESTIMATE = 320;

type AIPanelPlacement = "below" | "above";

interface AIPanelLayout {
  style: React.CSSProperties;
  placement: AIPanelPlacement;
  /** 箭头在面板内的水平位置（百分比 0-100） */
  arrowLeft: number;
}

/** 计算 AI 面板 fixed 定位。调用方必须同步 setState，保证首帧即 fixed，
 *  避免面板先以静态块级元素渲染撑高编辑器导致页面滚动跳变。 */
function layoutAIPanel(anchor: FloatingPoint, measuredHeight?: number): AIPanelLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = Math.min(AI_PANEL_WIDTH, vw - 32);
  const ph = Math.max(measuredHeight || AI_PANEL_HEIGHT_ESTIMATE, 160);

  // 移动端：顶部居中全宽
  if (vw < 640) {
    return {
      style: {
        position: "fixed",
        top: Math.max(8, Math.min(anchor.top + 10, vh - 420)),
        left: 8,
        right: 8,
        width: "auto",
        zIndex: 9999,
      },
      placement: "below",
      arrowLeft: 50,
    };
  }

  const anchorCenter = anchor.left + anchor.width / 2;
  let left = anchorCenter - pw / 2;
  const spaceBelow = vh - anchor.top - 16;
  const spaceAbove = anchor.top - 16;
  const placement: AIPanelPlacement =
    spaceBelow < ph + 12 && spaceAbove >= ph + 12 ? "above" : "below";
  let top = placement === "below" ? anchor.top + 10 : anchor.top - ph - 10;
  top = Math.max(16, Math.min(top, vh - ph - 16));
  left = Math.max(16, Math.min(left, vw - pw - 16));
  // 箭头尽量贴近选区中心，同时夹在面板内避免溢出
  const arrowLeft = Math.max(14, Math.min(((anchorCenter - left) / pw) * 100, 86));

  return {
    style: { position: "fixed", top, left, width: pw, zIndex: 9999 },
    placement,
    arrowLeft,
  };
}

function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)```|(^|\n)#{1,6}\s|(^|\n)>\s?|(^|\n)\s*([-*_])(?:\s*\4){2,}\s*(?=\n|$)|(^|\n)\s*[-*+]\s+|(^|\n)\s*\d+[.)]\s+|(^|\n)\s*<img\s+|(^|\n)\s*\|.+\|/i.test(
    text,
  );
}
/** 用 tiptap-markdown 解析器将 markdown 文本转为 ProseMirror Fragment */
function markdownToFragment(editor: Editor, text: string): Fragment | null {
  try {
    const parser = (editor.storage as any)?.markdown?.parser;
    if (!parser) return null;
    const html = parser.parse(text);
    const div = document.createElement("div");
    div.innerHTML = html;
    return PmDOMParser.fromSchema(editor.schema).parse(div).content;
  } catch {
    return null;
  }
}

const ImageUploadDialog = lazy(() =>
  import("../components/image-upload-dialog").then((m) => ({ default: m.ImageUploadDialog })),
);
const StorageSettingsDialog = lazy(() =>
  import("../components/storage-settings-dialog").then((m) => ({
    default: m.StorageSettingsDialog,
  })),
);
const ExportDialog = lazy(() =>
  import("../components/export-dialog").then((m) => ({ default: m.ExportDialog })),
);
const VideoEmbedDialog = lazy(() =>
  import("../components/video-embed-dialog").then((m) => ({ default: m.VideoEmbedDialog })),
);
const MdImportDialog = lazy(() =>
  import("../components/md-import-dialog").then((m) => ({ default: m.MdImportDialog })),
);

const DialogFallback = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
    <div className="relative bg-background rounded-2xl border border-default-200 p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  </div>
);

export interface QingWuAIEditorProps {
  /** 初始内容 (HTML 字符串，会自动做安全清洗) */
  initialContent?: string;
  /** 内容变化回调 */
  onChange?: (html: string, json: object) => void;
  /** placeholder 文本 */
  placeholder?: string;
  /**
   * 编辑器模式
   * - "edit"  可编辑（默认）
   * - "view"  只读查看
   */
  mode?: "edit" | "view";
  /** @deprecated 请使用 mode="view" 代替 */
  readonly?: boolean;
  /** 最大字符数限制，不传则不限制 */
  maxLength?: number;
  /** 单文件上传大小上限（字节），必填；超限文件将被拦截并 toast 提示 */
  maxAttachmentSize: number;
  /** 文档内所有附件总大小上限（字节），必填；超出后拒绝新附件上传 */
  maxTotalAttachmentSize: number;
  /** 自定义类名 */
  className?: string;
  /** 隐藏编辑器外边框 */
  borderless?: boolean;
  /** 自定义 CSS 样式，应用于编辑器容器 */
  style?: React.CSSProperties;
  /** 是否显示顶部工具栏（导出按钮），默认 true */
  showToolbar?: boolean;
  /** 是否显示目录（TOC）侧栏，默认 true */
  showToc?: boolean;
  /**
   * 是否启用全文搜索（关键词高亮）
   * - true  启用 Ctrl+F / Cmd+F 唤起搜索浮层（默认）
   * - false 禁用搜索功能，不拦截快捷键
   */
  showSearch?: boolean;
  /**
   * 编辑器实例就绪回调 - 把内部 Editor 暴露给宿主
   * （Web Clipper 接收器用它调用 commands.insertContent 写入剪藏）
   */
  onEditorReady?: (editor: Editor) => void;
  /** 是否立即渲染编辑器；SSR/Next.js 场景建议配合 dynamic import ssr:false 后传 true */
  immediatelyRender?: boolean;
  /**
   * 全局提示回调（附件超限拦截 / 文档附件超限警告等）。
   * 由宿主接入自己的 Toast 组件（如 @qingwu/toast）；不传时回退到内置
   * @qingwu/toast 默认渲染，也可通过 setToastProvider() 全局替换。
   * 第三参 options 透传展示选项（persist/maxLines/duration）；旧签名自动兼容。
   */
  onToast?: (message: string, type: ToastType, options?: ToastOptions) => void;
}

export const QingWuAIEditor: FC<QingWuAIEditorProps> = ({
  initialContent = "",
  onChange,
  placeholder,
  mode,
  readonly = false,
  maxLength,
  maxAttachmentSize,
  maxTotalAttachmentSize,
  className = "",
  borderless = false,
  style,
  showToolbar = true,
  showToc = true,
  showSearch = true,
  onEditorReady,
  immediatelyRender,
  onToast,
}) => {
  const isReadonly = mode === "view" || readonly;

  // 清洗初始 HTML，移除危险标签和属性
  const safeContent = useMemo(
    () => (looksLikeMarkdown(initialContent) ? initialContent : sanitizeHtml(initialContent)),
    [initialContent],
  );
  const [showAI, setShowAI] = useState(false);
  const [aiPanelStyle, setAiPanelStyle] = useState<React.CSSProperties>({});
  /** AI 面板相对选区的方位（智能翻转用） */
  const [aiPlacement, setAiPlacement] = useState<"below" | "above">("below");
  /** 箭头在面板内的水平位置（百分比），默认居中 */
  const [aiArrowLeft, setAiArrowLeft] = useState(50);
  const aiPanelRef = useRef<HTMLDivElement | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showStorageSettings, setShowStorageSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  // 气泡子面板（高亮色板 / 链接输入）独立浮层，不叠加进气泡内增高气泡
  const [subPanel, setSubPanel] = useState<"none" | "highlight" | "link">("none");
  const [subPanelStyle, setSubPanelStyle] = useState<React.CSSProperties>({});

  const [linkUrl, setLinkUrl] = useState("");
  const [mdDialog, setMdDialog] = useState<{
    filename: string;
    resolve: (v: "render" | "attach" | null) => void;
  } | null>(null);
  const [showTocState, setShowTocState] = useState(showToc);
  const [showTocMobile, setShowTocMobile] = useState(false);
  // 注意：state 名为 searchOpen，避免与 prop showSearch 冲突
  const [searchOpen, setSearchOpen] = useState(false);
  // 视口是否达到桌面断点（与 TOC 悬浮框的 80rem 一致）。
  // 用 JS 监听而非纯 CSS，以便在「全屏」等 CSS 媒体查询感知不到的场景下，
  // 统一决定桌面侧栏与悬浮球的互斥显隐。
  const [isWide, setIsWide] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 80rem)").matches
      : true,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const savedScrollYRef = useRef<number>(0);
  const aiAnchorRef = useRef<FloatingPoint | null>(null);
  const editorRef = useRef<Editor | null>(null);
  // 气泡菜单：主行容器 ref（子面板定位锚点）+ 「⋯」二级菜单开关
  const bubbleBoxRef = useRef<HTMLDivElement | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editorWebFS, setEditorWebFS] = useState(false);
  const [editorNativeFS, setEditorNativeFS] = useState(false);

  // 网页全屏 - 不搬 DOM，用 position: fixed + flex 列布局，内容区独立滚动
  const handleEditorWebFS = useCallback(() => {
    const el = editorContainerRef.current;
    const content = contentAreaRef.current;
    if (!el) return;
    if (editorWebFS) {
      document.body.style.overflow = "";
      Object.assign(el.style, {
        position: "",
        top: "",
        left: "",
        width: "",
        height: "",
        zIndex: "",
        background: "",
        borderRadius: "",
        overflow: "",
        display: "",
        flexDirection: "",
      });
      if (content) {
        Object.assign(content.style, { flex: "", overflow: "", minHeight: "" });
      }
      setEditorWebFS(false);
      // 延迟到下一帧：清除 position:fixed 后浏览器需 reflow 恢复页面高度，否则 scrollTo 被 clamp
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollYRef.current);
      });
    } else {
      if (document.fullscreenElement) document.exitFullscreen();
      // 保存当前滚动位置，退出时恢复
      savedScrollYRef.current = window.scrollY;
      Object.assign(el.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        zIndex: "99999",
        background: "var(--background, #fff)",
        borderRadius: "0",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      });
      if (content) {
        Object.assign(content.style, { flex: "1", overflow: "auto", minHeight: "0" });
      }
      document.body.style.overflow = "hidden";
      setEditorWebFS(true);
    }
  }, [editorWebFS]);

  const handleEditorNativeFS = useCallback(() => {
    const el = editorContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      if (editorWebFS) handleEditorWebFS();
      savedScrollYRef.current = window.scrollY;
      el.requestFullscreen();
    }
  }, [editorWebFS, handleEditorWebFS]);

  // ESC 退出网页全屏 & 原生全屏状态同步 & 退出原生全屏时恢复滚动位置
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editorWebFS) handleEditorWebFS();
    };
    const onFSChange = () => {
      if (!document.fullscreenElement) {
        setEditorNativeFS(false);
        // 退出原生全屏时延迟恢复滚动位置：浏览器需 reflow 恢复元素原始布局
        requestAnimationFrame(() => {
          window.scrollTo(0, savedScrollYRef.current);
        });
      } else {
        setEditorNativeFS(true);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFSChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFSChange);
    };
  }, [editorWebFS, handleEditorWebFS]);

  // Ctrl+F / Cmd+F 唤起搜索；showSearch=false 时不拦截，交还浏览器原生查找
  useEffect(() => {
    if (!showSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        const root = editorContainerRef.current;
        // 编辑器不可见时不拦截
        if (!root) return;
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSearch]);

  // 监听桌面断点变化（窗口缩放 / 浏览器 zoom 放大缩小），驱动侧栏与悬浮球切换
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 80rem)");
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    setIsWide(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const editor = useEditor({
    extensions: getEditorExtensions({
      placeholder: placeholder || t("editor.placeholder"),
      maxLength,
      maxAttachmentSize,
      maxTotalAttachmentSize,
    }),
    content: safeContent,
    editable: !isReadonly,
    immediatelyRender,
    onUpdate: ({ editor }) => {
      if (!onChange) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange?.(editor.getHTML(), editor.getJSON());
      }, 300);
    },
    onCreate: () => {},
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-4 sm:px-8 py-4",
      },
      handlePaste(view, event) {
        const cb = event.clipboardData;
        if (!cb) return false;

        const text = cb.getData("text/plain");
        if (!text || !text.includes("[[")) return false;

        event.preventDefault();

        // 剪贴板若带文件（Obsidian 复制嵌入等场景），暂存给 RelativeMedia：
        // 插入完成后由它按文件名匹配、上传换链；匹配不到的走目录授权解析。
        // 此路径会越过 RelativeMedia 插件的 handlePaste，暂停标记也要在这里清除
        const relStorage = (
          editorRef.current?.storage as
            | { relativeMedia?: { clipboardFiles: Map<string, File>; pausedUntilPaste: boolean } }
            | undefined
        )?.relativeMedia;
        if (relStorage) {
          relStorage.clipboardFiles = new Map(
            Array.from(cb.files ?? []).map((f) => [f.name.toLowerCase(), f] as const),
          );
          relStorage.pausedUntilPaste = false;
        }

        // 按原始相对路径插入；本地引用的解析与上传统一由 RelativeMedia 扩展兜底
        const fragment = editorRef.current ? markdownToFragment(editorRef.current, text) : null;
        if (fragment) {
          const slice = new Slice(fragment, 0, 0);
          view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
        } else {
          view.dispatch(view.state.tr.insertText(text).scrollIntoView());
        }
        return true;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    (window as any).__editor = editor;
  }, [editor]);

  // 编辑器实例就绪后回调宿主（Web Clipper 接收器据此拿到 editor 调用 insertContent）
  useEffect(() => {
    if (!editor || !onEditorReady) return;
    onEditorReady(editor);
  }, [editor, onEditorReady]);

  // 选区为空（气泡隐藏）时收起子面板与「⋯」菜单，避免残留
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (editor.state.selection.empty) {
        setSubPanel("none");
        setShowMoreMenu(false);
      }
    };
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor]);

  // placeholder 变化时（如 i18n 切换）通过 setOptions 更新扩展配置，
  // 避免通过 key 强制 remount 编辑器导致内容/光标/undo 栈丢失
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      extensions: getEditorExtensions({
        placeholder: placeholder || t("editor.placeholder"),
        maxLength,
        maxAttachmentSize,
        maxTotalAttachmentSize,
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholder, maxLength, maxAttachmentSize, maxTotalAttachmentSize]);

  // initialContent 变化时（如 Demo 切换 locale）通过 setContent 更新文档，
  // 避免通过 key 强制 remount 编辑器导致 undo 栈丢失
  // 用 ref 记录上次值，避免初次挂载和 prop 引用变化时重复 setContent
  const lastInitialContentRef = useRef<string>(initialContent);
  useEffect(() => {
    if (!editor) return;
    if (initialContent === lastInitialContentRef.current) return;
    lastInitialContentRef.current = initialContent;
    const safe = looksLikeMarkdown(initialContent) ? initialContent : sanitizeHtml(initialContent);
    // emit: false 避免触发 onChange，防止覆盖父组件状态
    editor.commands.setContent(safe, { emitUpdate: false });
  }, [editor, initialContent]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isReadonly, false);
  }, [editor, isReadonly]);

  // Toast 通道订阅：宿主传入 onToast 则转发；否则回退到内置 @qingwu/toast 默认渲染
  useEffect(() => {
    if (!onToast) return;
    return subscribeToast(onToast);
  }, [onToast]);

  // 加载已有文档时，附件总大小已超限 → 发警告（不阻止编辑）
  useEffect(() => {
    if (!editor) return;
    const total = getDocAttachmentTotal(editor.state.doc);
    if (total > maxTotalAttachmentSize) {
      toast(
        `文档内附件总大小 ${formatBytes(total)} 已超过限制 ${formatBytes(maxTotalAttachmentSize)}`,
        "info",
      );
    }
  }, [editor, maxTotalAttachmentSize]);

  // 同步附件上传限制到 qingwuUI storage：上传路径运行期实时读取。
  // 不能走 setOptions({ extensions })——tiptap 不重建扩展，配置变更无效。
  useEffect(() => {
    if (!editor) return;
    const storage = (editor.storage as any).qingwuUI as
      | { limits?: { maxAttachmentSize: number; maxTotalAttachmentSize: number } }
      | undefined;
    if (!storage) return;
    storage.limits = { maxAttachmentSize, maxTotalAttachmentSize };
  }, [editor, maxAttachmentSize, maxTotalAttachmentSize]);

  // 打开高亮色板 / 链接输入独立浮层：锚定气泡菜单当前矩形，浮层不叠进气泡内
  const openSubPanel = useCallback((panel: "highlight" | "link") => {
    const anchor = bubbleBoxRef.current?.getBoundingClientRect();
    setSubPanel(panel);
    setShowMoreMenu(false);
    setSubPanelStyle({
      position: "fixed",
      top: anchor ? anchor.bottom + 8 : undefined,
      left: anchor ? Math.max(8, Math.min(anchor.left, window.innerWidth - 240)) : 8,
      zIndex: 9999,
    });
  }, []);

  const bubbleActions = getBubbleMenuActions((key) => t(key));
  // 主行紧凑展示高频键，低频键折叠进「⋯」二级菜单，避免气泡换行增高。
  // 主行 = 排版组（B/I/U/S/代码）+ AI 专属 + ⋯；高亮/链接/表格/复制/搜索 进 ⋯ 下拉。
  const mainActions = bubbleActions.filter((action) => !action.more);
  const moreActions = bubbleActions.filter((action) => action.more);
  const formatActions = mainActions.filter((action) => action.key !== "ai");
  const aiAction = mainActions.find((action) => action.key === "ai");

  // 气泡按钮统一点击处理：链接/高亮走二级浮层，其余执行命令
  const handleBubbleAction = useCallback(
    (action: BubbleMenuAction) => {
      if (!editor) return;
      setShowMoreMenu(false);
      if (action.key === "link") {
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
        } else {
          const href = editor.getAttributes("link").href || "";
          setLinkUrl(href);
          openSubPanel("link");
        }
      } else if (action.key === "highlight") {
        if (subPanel === "highlight") setSubPanel("none");
        else openSubPanel("highlight");
      } else {
        action.command(editor);
      }
    },
    [editor, subPanel, openSubPanel],
  );

  const isMoreActionActive = useCallback(
    (action: BubbleMenuAction) => {
      if (!editor) return false;
      if (action.key === "highlight") return subPanel === "highlight";
      if (action.key === "link") return editor.isActive("link");
      return action.isActive(editor);
    },
    [editor, subPanel],
  );

  // 字数统计：仅订阅 editor 事务时刷新，避免每次重渲染都调用
  const [charTick, setCharTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => setCharTick((n) => (n + 1) % 1_000_000);
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor]);
  const characterCount = useMemo(
    () => editor?.storage?.characterCount?.characters?.() ?? 0,
    // charTick 强制重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, charTick],
  );
  const limitExceeded = maxLength ? characterCount > maxLength : false;

  // 组件卸载时清理 debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // 组件卸载时若有未关闭的 mdDialog，resolve(null) 释放 insertMdFile 中挂起的 Promise
  // 否则 URL.createObjectURL(file) 也不会被 revoke，造成内存泄漏
  useEffect(() => {
    return () => {
      if (mdDialog) mdDialog.resolve(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开写作助手面板 — 工具栏「AI 编写」按钮与扩展（slash / 气泡菜单）共用。
  // 有选区时锚定选区下沿，无选区时锚定光标坐标；二者皆无则用默认位置。
  // 关键：同步算好 fixed 坐标与 showAI 一起 setState，首帧即 fixed，
  // 从源头消除「面板先以静态块级元素渲染撑高编辑器 → 页面滚动跳变」的问题。
  const openAIPanel = useCallback(() => {
    if (!editor?.isEditable) return;
    const domSel = window.getSelection();
    let anchor: FloatingPoint;
    if (domSel && domSel.rangeCount > 0 && !domSel.isCollapsed) {
      const rect = domSel.getRangeAt(0).getBoundingClientRect();
      anchor = { top: rect.bottom, left: rect.left, width: rect.width };
    } else {
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      anchor = { top: coords.bottom, left: coords.left, width: 0 };
    }
    aiAnchorRef.current = anchor;
    const layout = layoutAIPanel(anchor);
    setShowAI(true);
    setAiPanelStyle(layout.style);
    setAiPlacement(layout.placement);
    setAiArrowLeft(layout.arrowLeft);
  }, [editor]);

  // 注册全局回调（供 slash 命令和代码块等触发）
  // 注册 UI 回调到 (editor.storage as any).qingwuUI（替代 window.__qingwu_* 全局变量）
  // 多编辑器实例各自独立，不污染全局命名空间
  useEffect(() => {
    if (!editor) return;
    const storage = (editor.storage as any).qingwuUI as
      | {
          openImageDialog?: () => void;
          openVideoDialog?: () => void;
          openAI?: () => void;
          chooseMd?: (filename: string, resolve: (v: "render" | "attach" | null) => void) => void;
          parseMd?: (schema: any, text: string) => unknown;
        }
      | undefined;
    // 防御：扩展未注册/未就绪时 storage 为 undefined（消费方产物与扩展注册不一致、
    // 或 tiptap 多实例等情形）。读取方均用可选链，写入方此处同样判空，避免硬崩溃。
    if (!storage) return;
    storage.openImageDialog = () => setShowImageDialog(true);
    storage.openVideoDialog = () => setShowVideoDialog(true);
    storage.chooseMd = (filename: string, resolve: (v: "render" | "attach" | null) => void) => {
      setMdDialog({ filename, resolve });
    };
    storage.openAI = openAIPanel;
    storage.parseMd = (_schema: any, text: string) => {
      if (!editor) return null;
      return markdownToFragment(editor, text);
    };
    return () => {
      // 卸载时清空回调，避免扩展内调用已卸载组件的 setState
      delete storage.openImageDialog;
      delete storage.openVideoDialog;
      delete storage.openAI;
      delete storage.parseMd;
      delete storage.chooseMd;
    };
  }, [editor, openAIPanel]);

  // 写作助手面板定位校正：渲染后用真实高度做智能翻转 + 箭头定位。
  // 用 useLayoutEffect（绘制前执行），配合 openAIPanel 里同步写入的初始 fixed 样式，
  // 全程面板都是 fixed，不会以静态元素撑高编辑器 → 无滚动跳变。
  useLayoutEffect(() => {
    if (!showAI || !editor) return;
    const anchor = aiAnchorRef.current;
    if (!anchor) return;
    const panel = aiPanelRef.current;
    const layout = layoutAIPanel(anchor, panel?.offsetHeight || undefined);
    setAiPlacement(layout.placement);
    setAiArrowLeft(layout.arrowLeft);
    setAiPanelStyle(layout.style);
  }, [showAI, editor]);

  // 面板打开期间窗口尺寸变化时重新定位
  useEffect(() => {
    if (!showAI || !editor) return;
    const onResize = () => {
      const anchor = aiAnchorRef.current;
      if (!anchor) return;
      const panel = aiPanelRef.current;
      const layout = layoutAIPanel(anchor, panel?.offsetHeight || undefined);
      setAiPlacement(layout.placement);
      setAiArrowLeft(layout.arrowLeft);
      setAiPanelStyle(layout.style);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [showAI, editor]);

  useEffect(() => {
    if (!showAI) aiAnchorRef.current = null;
  }, [showAI]);

  const handleImageInsert = useCallback(
    (url: string) => {
      editor?.chain().focus().setImage({ src: url }).run();
    },
    [editor],
  );
  const handleVideoInsert = useCallback(
    (url: string) => {
      (editor?.commands as any).insertVideo?.({ src: url });
    },
    [editor],
  );

  // 桌面内联侧栏可见 = 用户开启 TOC 且 视口宽屏 且 非全屏。
  // 悬浮球可见 = TOC 功能启用 且 用户开启 TOC 且 桌面侧栏当前不可见 且 目录抽屉未展开
  // （窄屏 / 浏览器放大到窄视口 / 网页全屏 / 原生全屏 都落入此分支）。
  // 抽屉展开时目录已直接展示，悬浮球隐藏避免重叠。
  const desktopTocVisible = showTocState && isWide && !editorWebFS && !editorNativeFS;
  const fabVisible = showToc && showTocState && !desktopTocVisible && !showTocMobile;
  // 目录启用但桌面侧栏不可见（窄视口 / 全屏等）时，挂载后直接展开抽屉展示目录内容，
  // 而不是只亮出悬浮球等用户再点一次。仅首次挂载自动展开一次；
  // 用户手动关闭抽屉后，悬浮球作为折叠态入口保留。
  const autoOpenedTocRef = useRef(false);
  useEffect(() => {
    if (autoOpenedTocRef.current) return;
    autoOpenedTocRef.current = true;
    if (showToc && showTocState && !desktopTocVisible) {
      setShowTocMobile(true);
    }
  }, [showToc, showTocState, desktopTocVisible]);

  // 桌面目录改为编辑器卡片之外的独立侧栏（flex 兄弟节点 + sticky），
  // 不再用 fixed 浮层：fixed 在「宿主容器满宽」或「祖先存在 transform/filter 包含块」时
  // 会落在编辑器卡片边框内，看起来与编辑器粘连。侧栏布局在任意宿主宽度下都保持分离。

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-32 text-default-400">
        {t("editor.loading")}
      </div>
    );
  }

  return (
    <div className="qingwu-editor-row">
      <div
        ref={editorContainerRef}
        className={`qingwu-editor relative flex-1 min-w-0 bg-background ${isReadonly ? "qingwu-editor--readonly" : ""} ${borderless ? "" : "rounded-xl border border-default-200"} ${className}`}
        style={style}
      >
        {/* 顶部工具栏 */}
        {showToolbar && (
          <div className="qed-toolbar">
            <div className="qed-toolbar__group">
              <button
                type="button"
                className={`qed-tb-btn qed-tb-btn--desktop-only${showTocState ? " is-active" : ""}`}
                onClick={() => {
                  if (showTocState) {
                    // 收起目录时同步关闭抽屉，避免浮层残留
                    setShowTocState(false);
                    setShowTocMobile(false);
                  } else {
                    setShowTocState(true);
                    // 桌面侧栏不可见（64rem~80rem 窄视口 / 全屏等）时，
                    // 展开目录直接打开抽屉，而不是只亮出悬浮球等二次点击
                    if (!desktopTocVisible) setShowTocMobile(true);
                  }
                }}
                title={showTocState ? "隐藏目录" : "显示目录"}
                aria-label={showTocState ? "隐藏目录" : "显示目录"}
                aria-pressed={showTocState}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7" />
                </svg>
              </button>

              {/* 全文搜索按钮 - 等效 Ctrl+F */}
              {showSearch && (
                <button
                  type="button"
                  className={`qed-tb-btn${searchOpen ? " is-active" : ""}`}
                  onClick={() => setSearchOpen(!searchOpen)}
                  title="查找 (Ctrl+F)"
                  aria-label="查找"
                  aria-pressed={searchOpen}
                >
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              )}

              {/* AI 编写按钮 — 唤起写作助手面板（无选区时针对光标上下文，有选区时针对选区） */}
              {!isReadonly && (
                <button
                  type="button"
                  className={`qed-tb-btn qed-tb-btn--ai${showAI ? " is-active" : ""}`}
                  onClick={() => (showAI ? setShowAI(false) : openAIPanel())}
                  title={t("editor.toolbar.aiTitle")}
                  aria-label={t("editor.toolbar.ai")}
                  aria-pressed={showAI}
                >
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18.5 14l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div className="qed-toolbar__group">
              <button
                type="button"
                className="qed-tb-btn qed-tb-btn--solid"
                onClick={() => setShowExport(true)}
                title={t("editor.toolbar.exportTitle")}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span className="qed-tb-btn__label">{t("editor.toolbar.export")}</span>
              </button>
              <button
                type="button"
                className={`qed-tb-btn${editorWebFS ? " is-active" : ""}`}
                onClick={handleEditorWebFS}
                title={editorWebFS ? "退出网页全屏" : "网页全屏"}
                aria-label={editorWebFS ? "退出网页全屏" : "网页全屏"}
                aria-pressed={editorWebFS}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
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
                className={`qed-tb-btn${editorNativeFS ? " is-active" : ""}`}
                onClick={handleEditorNativeFS}
                title={editorNativeFS ? "退出全屏" : "全屏"}
                aria-label={editorNativeFS ? "退出全屏" : "全屏"}
                aria-pressed={editorNativeFS}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
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

        {/* Bubble 菜单 - 选中文本时显示 */}
        {editor && !isReadonly && editor.isEditable && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor: ed, state }) => {
              if (
                ed.isActive("image") ||
                ed.isActive("videoEmbed") ||
                ed.isActive("codeBlock") ||
                ed.isActive("audioEmbed") ||
                ed.isActive("attachmentEmbed")
              ) {
                return false;
              }
              // 仅选中文字时才显示，光标在空白处不显示
              if (state.selection.empty) return false;
              return true;
            }}
            options={{ placement: "bottom", offset: 8, flip: true }}
            className="bubble-menu-pop bg-background border border-default-200 rounded-xl p-1 shadow-lg"
          >
            <div
              ref={bubbleBoxRef}
              className="bubble-menu-items relative flex items-center gap-0.5"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) e.preventDefault();
              }}
            >
              {/* 排版组：B / I / U / S / 代码 */}
              {formatActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                    action.isActive(editor)
                      ? "bg-primary/10 text-primary"
                      : "text-default-600 hover:bg-default-100"
                  }`}
                  onClick={(event) => {
                    event.preventDefault();
                    handleBubbleAction(action);
                  }}
                  title={action.label}
                  aria-label={action.label}
                >
                  {action.icon}
                </button>
              ))}

              {/* 分隔线 */}
              <span className="w-px h-4 bg-default-200 mx-0.5 shrink-0" aria-hidden="true" />

              {/* AI 专属 - 品牌色 */}
              <button
                type="button"
                className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                  showAI ? "bg-primary/15 text-primary" : "text-primary hover:bg-primary/10"
                }`}
                onClick={(event) => {
                  event.preventDefault();
                  setShowMoreMenu(false);
                  // openAIPanel 内部已同步算好 fixed 定位，首帧即 fixed，不再需要 RAF 滚动救场
                  aiAction?.command(editor);
                }}
                title={aiAction?.label}
                aria-label={aiAction?.label}
              >
                <SparklesIcon />
              </button>

              {/* 分隔线 */}
              <span className="w-px h-4 bg-default-200 mx-0.5 shrink-0" aria-hidden="true" />

              {/* 「⋯」低频操作入口 - 展开竖向下拉 */}
              <button
                type="button"
                aria-expanded={showMoreMenu}
                className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                  showMoreMenu
                    ? "bg-default-100 text-default-900"
                    : "text-default-600 hover:bg-default-100"
                }`}
                onClick={(event) => {
                  event.preventDefault();
                  setShowMoreMenu((v) => !v);
                }}
                title={t("editor.bubble.more")}
                aria-label={t("editor.bubble.more")}
              >
                <MoreIcon />
              </button>

              {/* 「⋯」竖向二级菜单 - 图标 + 文字，宽度贴合最长字段，独立浮层不增高气泡 */}
              {showMoreMenu && (
                <div
                  role="menu"
                  className="bubble-more-menu absolute right-0 top-full z-[9999] mt-1 w-max max-h-[70vh] overflow-y-auto flex-col gap-1 rounded-xl border border-default-200 bg-background p-1.5 shadow-xl"
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest("button")) e.preventDefault();
                  }}
                >
                  {moreActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      role="menuitem"
                      className={`flex items-center gap-2 w-full whitespace-nowrap px-3 py-1.5 text-xs rounded-md transition-colors ${
                        isMoreActionActive(action)
                          ? "bg-primary/10 text-primary"
                          : "text-default-600 hover:bg-default-100"
                      }`}
                      onClick={(event) => {
                        event.preventDefault();
                        handleBubbleAction(action);
                      }}
                      title={action.label}
                    >
                      <span className="w-4 h-4 flex items-center justify-center shrink-0">
                        {action.icon}
                      </span>
                      <span className="tracking-wide">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </BubbleMenu>
        )}

        {/* 高亮色板 / 链接输入 - 独立浮层，不叠加进气泡内增高气泡 */}
        {editor && subPanel !== "none" && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setSubPanel("none")} />
            <div
              style={subPanelStyle}
              className="bg-background border border-default-200 rounded-xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {subPanel === "highlight" ? (
                <div className="flex items-center gap-1 p-1.5 flex-wrap">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      className="w-5 h-5 rounded-full border border-default-200 hover:scale-110 transition-transform"
                      style={{ background: c.color }}
                      title={c.name}
                      onClick={() => {
                        editor.chain().focus().setHighlight({ color: c.color }).run();
                        setSubPanel("none");
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className="w-5 h-5 rounded-full border border-default-200 text-default-500 hover:bg-default-100 flex items-center justify-center text-[10px]"
                    title="清除高亮"
                    onClick={() => {
                      editor.chain().focus().unsetHighlight().run();
                      setSubPanel("none");
                    }}
                  >
                    ✕{" "}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 p-1.5">
                  <input
                    type="url"
                    autoFocus
                    className="flex-1 px-2 py-1 text-xs rounded-md border border-default-200 bg-background focus:outline-none focus:border-primary"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (linkUrl.trim()) {
                          editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
                        }
                        setSubPanel("none");
                      } else if (e.key === "Escape") {
                        setSubPanel("none");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="px-2 py-1 text-xs rounded-md bg-primary text-white hover:opacity-90"
                    onClick={() => {
                      if (linkUrl.trim()) {
                        editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
                      }
                      setSubPanel("none");
                    }}
                  >
                    确定
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* 写作助手面板 - 浮动在选中区域下方，点击外部关闭 */}
        {!isReadonly && showAI && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setShowAI(false)} />
            <div
              ref={aiPanelRef}
              style={aiPanelStyle}
              className={`ai-panel relative bg-background border border-default-200 rounded-xl shadow-xl${
                aiPlacement === "above" ? " ai-panel--above" : ""
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 锚点箭头 - 面板在选区下方时指向上，翻转后指向下 */}
              <span
                className="ai-panel__arrow"
                style={{ left: `${aiArrowLeft}%` }}
                aria-hidden="true"
              />
              <AISelector editor={editor} onClose={() => setShowAI(false)} />
            </div>
          </>
        )}

        {/* 图片上传弹窗 */}
        {showImageDialog && (
          <Suspense fallback={<DialogFallback />}>
            <ImageUploadDialog
              open={showImageDialog}
              onClose={() => setShowImageDialog(false)}
              onInsert={handleImageInsert}
              validate={(file) =>
                editor
                  ? validateAttachmentFile(editor.state.doc, file, {
                      maxAttachmentSize,
                      maxTotalAttachmentSize,
                    })
                  : null
              }
            />
          </Suspense>
        )}

        {/* 视频弹窗 */}
        {showVideoDialog && (
          <Suspense fallback={<DialogFallback />}>
            <VideoEmbedDialog
              open={showVideoDialog}
              onClose={() => setShowVideoDialog(false)}
              onInsert={handleVideoInsert}
            />
          </Suspense>
        )}

        {/* 存储设置弹窗 */}
        {showStorageSettings && (
          <Suspense fallback={<DialogFallback />}>
            <StorageSettingsDialog
              open={showStorageSettings}
              onClose={() => setShowStorageSettings(false)}
            />
          </Suspense>
        )}

        {/* 导出弹窗 */}
        {showExport && (
          <Suspense fallback={<DialogFallback />}>
            <ExportDialog open={showExport} onClose={() => setShowExport(false)} editor={editor} />
          </Suspense>
        )}

        {mdDialog && (
          <Suspense fallback={<DialogFallback />}>
            <MdImportDialog
              open={!!mdDialog}
              filename={mdDialog.filename}
              onRender={() => {
                mdDialog.resolve("render");
                setMdDialog(null);
              }}
              onAttach={() => {
                mdDialog.resolve("attach");
                setMdDialog(null);
              }}
              onClose={() => {
                mdDialog.resolve(null);
                setMdDialog(null);
              }}
            />
          </Suspense>
        )}

        {/* 全局 toast：宿主经 onToast 回调自定义；未接入时内置 @qingwu/toast 兜底渲染 */}

        {/* 编辑器主区域 */}
        {/* 编辑器主体 + 目录侧栏 */}
        <div ref={contentAreaRef} className="flex editor-body">
          {/* 编辑区 */}
          <div className="relative min-w-0 flex-1">
            <EditorContent editor={editor} />
            {!isReadonly && <TableToolbar editor={editor} />}

            {/* 右下角字数统计 */}
            <div
              className={`${editorWebFS || editorNativeFS ? "fixed" : "absolute"} bottom-2 right-4 z-10 pointer-events-none select-none`}
            >
              <span
                className={`text-xs ${
                  limitExceeded
                    ? "bg-danger/10 text-danger font-medium px-2 py-0.5 rounded"
                    : maxLength && characterCount > maxLength * 0.9
                      ? "bg-warning/10 text-warning px-2 py-0.5 rounded"
                      : "text-default-300"
                }`}
              >
                {characterCount}
                {maxLength ? ` / ${maxLength}` : ""} 字
              </span>
            </div>
          </div>
        </div>

        {/* 全文搜索浮层 - Ctrl+F 唤起，浮在编辑器右上角 */}
        {showSearch && searchOpen && (
          <SearchBar editor={editor} onClose={() => setSearchOpen(false)} />
        )}

        {/* 目录悬浮球 - 当桌面内联侧栏不可见（窄屏 / 浏览器放大 / 网页全屏 / 原生全屏）
          且用户开启了 TOC、目录抽屉未展开时出现，点击打开目录抽屉。
          抽屉展开时目录已直接展示，悬浮球隐藏。 */}
        {fabVisible && (
          <button
            type="button"
            className="qingwu-toc-fab"
            onClick={() => setShowTocMobile(true)}
            title="目录"
            aria-label="打开目录"
          >
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7" />
            </svg>
          </button>
        )}

        {/* 移动端目录抽屉 - 不设遮罩层，避免遮挡编辑器内容；关闭走抽屉头 × / 面板收起按钮 */}
        {showToc && showTocMobile && (
          <div className="qingwu-toc-drawer toc-scroll">
            <div className="qed-drawer-head">
              <span className="qed-drawer-head__title">目录</span>
              <button
                type="button"
                className="qed-drawer-head__close"
                onClick={() => setShowTocMobile(false)}
                aria-label="关闭目录"
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <TocPanel
              editor={editor}
              className="!p-3"
              onClose={() => {
                setShowTocMobile(false);
                setShowTocState(false);
              }}
            />
          </div>
        )}
      </div>
      {/* 桌面端目录 — 悬浮框（fixed 视口右侧，宽屏且非全屏时显示） */}
      {desktopTocVisible && (
        <aside className="qingwu-toc-desktop toc-scroll">
          <TocPanel editor={editor} onClose={() => setShowTocState(false)} />
        </aside>
      )}
    </div>
  );
};
