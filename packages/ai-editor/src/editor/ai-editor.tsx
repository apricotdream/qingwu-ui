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
import { createPortal } from "react-dom";
import { SearchBar } from "../components/search-bar";
import type { ToastOptions, ToastType } from "../components/toast";
import { subscribeToast, toast } from "../components/toast";
import { TocPanel } from "../components/toc";
import { AISelector } from "./ai/components/ai-selector";
import { flushPendingRemovals } from "./ai/pending-removal";
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

/** AI 面板宽度兜底（无法测量编辑器宽度时用，与 AISelector 内部一致） */
const AI_PANEL_WIDTH_FALLBACK = 288;
/** AI 面板宽度上限：宿主正文（如 640px）偏宽，输出文本整宽横排难读，桌面封顶保证阅读宽度 */
const AI_PANEL_WIDTH_MAX = 480;
/** 翻转判断用面板高度估算，渲染后 useLayoutEffect 会用真实高度校正 */
const AI_PANEL_HEIGHT_ESTIMATE = 320;

type AIPanelPlacement = "below" | "above";

interface AIPanelLayout {
  style: React.CSSProperties;
  placement: AIPanelPlacement;
  /** 箭头在面板内的水平位置（百分比 0-100） */
  arrowLeft: number;
}

/** 计算 AI 面板 fixed 定位；调用方必须同步 setState 保证首帧即 fixed，
 *  避免静态块级渲染撑高编辑器导致滚动跳变。宽度默认对齐编辑器根节点 */
function layoutAIPanel(
  anchor: FloatingPoint,
  measuredHeight?: number,
  opts: { panelWidth?: number; editorLeft?: number } = {},
): AIPanelLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = Math.min(opts.panelWidth || AI_PANEL_WIDTH_FALLBACK, AI_PANEL_WIDTH_MAX, vw - 32);
  const ph = Math.max(measuredHeight || AI_PANEL_HEIGHT_ESTIMATE, 160);

  // 移动端：顶部居中全宽
  if (vw < 640) {
    // 贴近视口顶部：maxHeight 按实际 top 动态算，底部控件常驻可见
    const top = Math.max(8, Math.min(anchor.top + 10, vh - 420));
    return {
      style: {
        position: "fixed",
        top,
        left: 8,
        right: 8,
        width: "auto",
        zIndex: 9999,
        maxHeight: `calc(100dvh - ${top}px - 16px)`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      },
      placement: "below",
      arrowLeft: 50,
    };
  }

  const anchorCenter = anchor.left + anchor.width / 2;
  // 水平：优先对齐编辑器左缘（宽度随编辑器）；无法测量时以锚点居中兜底
  let left = typeof opts.editorLeft === "number" ? opts.editorLeft : anchorCenter - pw / 2;
  left = Math.max(16, Math.min(left, vw - pw - 16));
  const spaceBelow = vh - anchor.top - 16;
  const spaceAbove = anchor.top - 16;
  const placement: AIPanelPlacement =
    spaceBelow < ph + 12 && spaceAbove >= ph + 12 ? "above" : "below";
  let top = placement === "below" ? anchor.top + 10 : anchor.top - ph - 10;
  top = Math.max(16, Math.min(top, vh - ph - 16));
  // 箭头尽量贴近选区中心，同时夹在面板内避免溢出
  const arrowLeft = Math.max(14, Math.min(((anchorCenter - left) / pw) * 100, 86));

  // maxHeight 按实际 top/placement 动态算，保证面板不出视口；流式变长时 flex 收缩文本区滚动
  const maxHeight =
    placement === "above"
      ? `${Math.max(anchor.top - 10 - top, 160)}px`
      : `calc(100dvh - ${top}px - 16px)`;

  return {
    style: {
      position: "fixed",
      top,
      left,
      width: pw,
      zIndex: 9999,
      maxHeight,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    },
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
  /** 初始内容：HTML 字符串（自动清洗 / markdown 识别）或 ProseMirror JSON 文档对象（原样使用，不再重解析） */
  initialContent?: string | object;
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
  /**
   * 目录（TOC）默认展开状态，默认 true。
   * true 控件可用且默认展开；false 控件可用但默认收起（仅决定初始展开，不关闭功能）
   */
  showToc?: boolean;
  /** 是否启用全文搜索：true 唤起 Ctrl+F 搜索浮层（默认），false 禁用且不拦截快捷键 */
  showSearch?: boolean;
  /** 编辑器实例就绪回调（Web Clipper 接收器据此调用 commands.insertContent） */
  onEditorReady?: (editor: Editor) => void;
  /** 是否立即渲染编辑器；SSR/Next.js 场景建议配合 dynamic import ssr:false 后传 true */
  immediatelyRender?: boolean;
  /**
   * 全局提示回调（附件超限拦截等）；宿主可接入自己的 Toast，不传时回退内置 @qingwu-ui/toast。
   * 第三参 options 透传展示选项；旧签名自动兼容。
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

  // 清洗初始 HTML，移除危险标签和属性；JSON 文档对象原样透传（宿主回显用 getJSON 产物，避免 string→markdown 重解析失真）
  const safeContent = useMemo(
    () =>
      typeof initialContent === "object" && initialContent !== null
        ? initialContent
        : (looksLikeMarkdown(initialContent) ? initialContent : sanitizeHtml(initialContent)),
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
  // 宿主运行时切换 showToc（如读者侧目录开关）：prop 变化同步进内部状态，初值仍取 prop
  useEffect(() => {
    setShowTocState(showToc);
  }, [showToc]);
  // 注意：state 名为 searchOpen，避免与 prop showSearch 冲突
  const [searchOpen, setSearchOpen] = useState(false);
  // 视口是否达桌面断点（80rem）：用 JS 监听而非纯 CSS，统一决策侧栏与悬浮球互斥显隐
  const [isWide, setIsWide] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 80rem)").matches
      : true,
  );
  // 工具栏目录按钮的可见断点（64rem 起显示）；<64rem 时目录入口交给悬浮球
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 64rem)").matches
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

  // 监听 64rem 断点（工具栏目录按钮显隐），窄视口下目录入口由悬浮球接管
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 64rem)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
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

        // 剪贴板若带文件（Obsidian 嵌入），暂存给 RelativeMedia 按文件名匹配上传换链；
        // 此路径越过其 handlePaste，暂停标记也在此清除
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

  // 编辑器销毁时 flush 待删孤儿资源（替换产生的孤儿已不在文档中 → 立即删存储）
  useEffect(() => {
    if (!editor) return;
    return () => flushPendingRemovals(editor);
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

  // placeholder 变化时 setOptions 更新扩展，避免 remount 导致内容/光标/undo 丢失
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

  // initialContent 变化时 setContent 更新文档，避免 remount 丢 undo；用 ref 记录上次值防重复
  const lastInitialContentRef = useRef<string | object>(initialContent);
  useEffect(() => {
    if (!editor) return;
    if (initialContent === lastInitialContentRef.current) return;
    lastInitialContentRef.current = initialContent;
    const safe =
      typeof initialContent === "object" && initialContent !== null
        ? initialContent
        : (looksLikeMarkdown(initialContent) ? initialContent : sanitizeHtml(initialContent));
    // emit: false 避免触发 onChange，防止覆盖父组件状态
    editor.commands.setContent(safe, { emitUpdate: false });
  }, [editor, initialContent]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isReadonly, false);
  }, [editor, isReadonly]);

  // Toast 通道订阅：宿主传入 onToast 则转发；否则回退到内置 @qingwu-ui/toast 默认渲染
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

  // 同步附件上限到 qingwuUI storage：上传路径运行期读取；tiptap 不重建扩展，setOptions 变更无效
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
  // 主行紧凑展示高频键（排版组 + AI + ⋯），低频键（高亮/链接/表格/复制/搜索）折叠进「⋯」下拉
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

  // 文档是否含标题（h1~h6）：只读态 / 窄屏下据此决定是否亮出目录悬浮球入口
  const [hasHeadings, setHasHeadings] = useState(false);
  useEffect(() => {
    if (!editor) return;
    const check = () => {
      let found = false;
      editor.state.doc.descendants((node) => {
        if (node.type.name === "heading") found = true;
      });
      setHasHeadings(found);
    };
    check();
    editor.on("update", check);
    return () => {
      editor.off("update", check);
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

  // 组件卸载时若有未关闭的 mdDialog，resolve(null) 释放挂起的 Promise，避免 objectURL 泄漏
  useEffect(() => {
    return () => {
      if (mdDialog) mdDialog.resolve(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开写作助手面板：工具栏按钮与 slash/气泡菜单共用。锚定按钮/选区/光标，
  // 同步算好 fixed 坐标与 showAI 一起 setState，首帧即 fixed 避免滚动跳变
  const openAIPanel = useCallback(
    (anchorEl?: HTMLElement | null) => {
      if (!editor?.isEditable) return;
      const domSel = window.getSelection();
      let anchor: FloatingPoint;
      if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        anchor = { top: rect.bottom, left: rect.left, width: rect.width };
      } else if (domSel && domSel.rangeCount > 0 && !domSel.isCollapsed) {
        const rect = domSel.getRangeAt(0).getBoundingClientRect();
        anchor = { top: rect.bottom, left: rect.left, width: rect.width };
      } else {
        const coords = editor.view.coordsAtPos(editor.state.selection.from);
        anchor = { top: coords.bottom, left: coords.left, width: 0 };
      }
      aiAnchorRef.current = anchor;
      const rect = editorContainerRef.current?.getBoundingClientRect();
      const layout = layoutAIPanel(anchor, undefined, {
        panelWidth: rect?.width,
        editorLeft: rect?.left,
      });
      setShowAI(true);
      setAiPanelStyle(layout.style);
      setAiPlacement(layout.placement);
      setAiArrowLeft(layout.arrowLeft);
    },
    [editor],
  );

  // 注册 UI 回调到 qingwuUI storage（替代 window 全局变量；多实例独立，不污染命名空间）
  useEffect(() => {
    if (!editor) return;
    const storage = (editor.storage as any).qingwuUI as
      | {
          openImageDialog?: () => void;
          openVideoDialog?: () => void;
          openAI?: (anchorEl?: HTMLElement | null) => void;
          chooseMd?: (filename: string, resolve: (v: "render" | "attach" | null) => void) => void;
          parseMd?: (schema: any, text: string) => unknown;
        }
      | undefined;
    // 防御：扩展未就绪时 storage 为 undefined；读取方用可选链，此处判空避免硬崩溃
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

  // 渲染后用真实高度做智能翻转 + 箭头定位：useLayoutEffect 绘制前执行，配合初始 fixed 样式全程无滚动跳变
  useLayoutEffect(() => {
    if (!showAI || !editor) return;
    const anchor = aiAnchorRef.current;
    if (!anchor) return;
    const panel = aiPanelRef.current;
    const rect = editorContainerRef.current?.getBoundingClientRect();
    const layout = layoutAIPanel(anchor, panel?.offsetHeight || undefined, {
      panelWidth: rect?.width,
      editorLeft: rect?.left,
    });
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
      const rect = editorContainerRef.current?.getBoundingClientRect();
      const layout = layoutAIPanel(anchor, panel?.offsetHeight || undefined, {
        panelWidth: rect?.width,
        editorLeft: rect?.left,
      });
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

  // 桌面侧栏可见 = 开启 TOC 且宽屏且非全屏；悬浮球 = 目录未以侧栏/抽屉展示时的入口（收起重开 / 窄屏唯一入口）
  const desktopTocVisible = showTocState && isWide && !editorWebFS && !editorNativeFS;
  const isDesktopToolbar = !isReadonly && isDesktop;
  const fabVisible =
    !desktopTocVisible && !showTocMobile && (showTocState || (hasHeadings && !isDesktopToolbar));
  // 目录启用但侧栏不可见时，挂载后自动展开抽屉一次；用户关闭后悬浮球作入口
  const autoOpenedTocRef = useRef(false);
  useEffect(() => {
    if (autoOpenedTocRef.current) return;
    autoOpenedTocRef.current = true;
    if (showTocState && !desktopTocVisible) {
      setShowTocMobile(true);
    }
  }, [showTocState, desktopTocVisible]);

  // 桌面目录用 flex 兄弟 + sticky 侧栏，不用 fixed 浮层（fixed 在祖先 transform/filter 包含块下会错位）

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
                    // 展开后按当前 isWide/全屏态决定是否叠开抽屉（点击时 showTocState 未更新恒为 false）
                    const canShowSidebar = isWide && !editorWebFS && !editorNativeFS;
                    if (!canShowSidebar) setShowTocMobile(true);
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

              {/* AI 编写按钮 — 唤起写作助手面板，锚定按钮自身就近弹出；
                  作用范围由 AISelector 决定：有选区→选区，无选区→全文 */}
              {!isReadonly && (
                <button
                  type="button"
                  className={`qed-tb-btn qed-tb-btn--ai${showAI ? " is-active" : ""}`}
                  onClick={(e) => (showAI ? setShowAI(false) : openAIPanel(e.currentTarget))}
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

              {/* 「⋯」二级菜单：图标+文字，独立浮层不增高气泡 */}
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

        {/* 写作助手面板：portal 到 body，避免祖先 transform/filter 抢走 fixed 包含块导致坐标漂移 */}
        {!isReadonly &&
          showAI &&
          createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowAI(false)} />
              <div
                ref={aiPanelRef}
                /* 面板 portal 到 body，不在宿主 data-lenis-prevent 子树内；
                   Lenis 会劫走内部滚轮 → 面板自身挂 prevent，滚轮放行给原生滚动 */
                data-lenis-prevent
                style={aiPanelStyle}
                className={`ai-panel relative flex flex-col bg-background border border-default-200 rounded-xl shadow-xl${
                  aiPlacement === "above" ? " ai-panel--above" : ""
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 锚点箭头 - 面板在锚点下方时指向上，翻转后指向下 */}
                <span
                  className="ai-panel__arrow"
                  style={{ left: `${aiArrowLeft}%` }}
                  aria-hidden="true"
                />
                <AISelector editor={editor} onClose={() => setShowAI(false)} />
              </div>
            </>,
            document.body,
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

        {/* 全局 toast：宿主经 onToast 回调自定义；未接入时内置 @qingwu-ui/toast 兜底渲染 */}

        {/* 编辑器主体 + 目录侧栏 */}
        <div ref={contentAreaRef} className="flex editor-body">
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

        {/* 目录悬浮球：桌面侧栏不可见（窄屏/放大/全屏）且目录未展开时出现，点击打开抽屉 */}
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
        {showTocMobile && (
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
