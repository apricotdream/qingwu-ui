import type { Editor } from "@tiptap/core";

import { Fragment, DOMParser as PmDOMParser, Slice } from "@tiptap/pm/model";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { type FC, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchBar } from "../components/search-bar";
import type { ToastType } from "../components/toast";
import { subscribeToast, toast } from "../components/toast";
import { TocPanel } from "../components/toc";
import { AISelector } from "./ai/components/ai-selector";
import { formatBytes, getDocAttachmentTotal, validateAttachmentFile } from "./attachment-limits";
import { getEditorExtensions } from "./extensions";
import { getBubbleMenuActions } from "./extensions/bubble-menu";
import { TableToolbar } from "./extensions/table-toolbar";
import { t } from "./i18n";
import { sanitizeHtml } from "./utils/sanitize";

type InlineToken =
  | { type: "text"; text: string }
  | { type: "link"; href: string; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "video"; src: string }
  | { type: "audio"; src: string };

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|#|$)/i;
const VIDEO_EXT_RE = /\.(mp4|m3u8|webm|ogg|flv|mkv|mov|avi|wmv|ts|m4v|3gp|f4v|rmvb)(\?|#|$)/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|flac|aac|m4a|wma|opus)(\?|#|$)/i;
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

function attachmentLabel(path: string, alias?: string): string {
  const text = alias?.trim();
  if (text) return text;

  const normalized = path.trim().replace(/\\/g, "/");
  return normalized.split("/").pop() || normalized;
}

function pathBasename(path: string): string {
  return (
    path
      .trim()
      .replace(/^Open:\s*/i, "")
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.toLowerCase() || ""
  );
}

function resolveClipboardResource(
  path: string,
  alias: string | undefined,
  resourceUrls?: Map<string, string>,
): string | null {
  return (
    resourceUrls?.get(pathBasename(path)) ||
    (alias ? resourceUrls?.get(pathBasename(alias)) : null) ||
    null
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("读取粘贴文件失败"));
    reader.readAsDataURL(file);
  });
}

async function collectClipboardResourceUrls(cb: DataTransfer): Promise<Map<string, string>> {
  const files = Array.from(cb.files || []);
  const entries = await Promise.all(
    files.map(async (file) => [file.name.toLowerCase(), await fileToDataUrl(file)] as const),
  );
  return new Map(entries);
}

function hasLocalMediaRefs(text: string): boolean {
  return /!\[\[[^\]]+\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|m3u8|webm|ogg|flv|mkv|mov|avi|wmv|ts|m4v|3gp|f4v|rmvb|mp3|wav|flac|aac|m4a|wma|opus)(?:\|[^\]]*)?\]\]/i.test(
    text,
  );
}
/** 将文本中 [[path]]/![[path]] 的 path 按剪贴板资源映射替换为 dataURL */
function applyResourceUrls(text: string, resourceUrls?: Map<string, string>): string {
  if (!resourceUrls || resourceUrls.size === 0) return text;
  return text.replace(/(!?)\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (full, bang, path, alias) => {
    const dataUrl = resourceUrls.get(pathBasename(path));
    return dataUrl ? `${bang}[[${dataUrl}${alias || ""}]]` : full;
  });
}

function pushMediaToken(
  tokens: InlineToken[],
  path: string,
  alias?: string,
  resourceUrls?: Map<string, string>,
) {
  const rawSrc = path.trim();
  const src = resolveClipboardResource(rawSrc, alias, resourceUrls) || rawSrc;
  const label = attachmentLabel(rawSrc, alias);

  if (IMAGE_EXT_RE.test(rawSrc) || /^data:image\//i.test(src)) {
    tokens.push({ type: "image", src, alt: label });
  } else if (VIDEO_EXT_RE.test(rawSrc) || /^data:video\//i.test(src)) {
    tokens.push({ type: "video", src });
  } else if (AUDIO_EXT_RE.test(rawSrc) || /^data:audio\//i.test(src)) {
    tokens.push({ type: "audio", src });
  } else {
    tokens.push({ type: "link", href: src, text: label });
  }
}

/** 安全创建 text node（PM 不允许空字符串） */
function tokenizeObsidianInline(line: string, resourceUrls?: Map<string, string>): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re =
    /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line))) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: line.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      pushMediaToken(tokens, match[1], match[2], resourceUrls);
    } else if (match[3]) {
      const href = match[3].trim();
      tokens.push({ type: "link", href, text: attachmentLabel(href, match[4]) });
    } else if (match[6]) {
      pushMediaToken(tokens, match[6], match[5], resourceUrls);
    } else if (match[8]) {
      tokens.push({ type: "link", href: match[8].trim(), text: match[7] });
    }

    lastIndex = re.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({ type: "text", text: line.slice(lastIndex) });
  }

  return tokens;
}

function safeText(schema: any, text: string, marks?: any[]): any {
  if (!text) return null;
  try {
    return schema.text(text, marks);
  } catch {
    return null;
  }
}

function parseAttr(text: string, name: string): string | null {
  const match = text.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return match?.[1] ?? null;
}

function markdownTextNodes(schema: any, text: string, baseMarks: any[] = []): any[] {
  const result: any[] = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const push = (value: string, extraMarks: any[] = []) => {
    const node = safeText(schema, value, [...baseMarks, ...extraMarks].filter(Boolean));
    if (node) result.push(node);
  };

  while ((match = re.exec(text))) {
    if (match.index > lastIndex) push(text.slice(lastIndex, match.index));
    const raw = match[0];
    if (raw.startsWith("`")) push(raw.slice(1, -1), [schema.marks.code?.create()]);
    else if (raw.startsWith("**") || raw.startsWith("__"))
      push(raw.slice(2, -2), [schema.marks.bold?.create()]);
    else if (raw.startsWith("~~")) push(raw.slice(2, -2), [schema.marks.strike?.create()]);
    else push(raw.slice(1, -1), [schema.marks.italic?.create()]);
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) push(text.slice(lastIndex));
  return result;
}

/** 从 token 数组构建行内 content（ProseMirror text nodes + marks） */
function buildInline(schema: any, tokens: InlineToken[]): any[] {
  const result: any[] = [];
  const linkMark = schema.marks.link;
  for (const t of tokens) {
    if (t.type === "text") {
      result.push(...markdownTextNodes(schema, t.text));
    } else if (t.type === "link" && linkMark) {
      result.push(
        ...markdownTextNodes(schema, t.text || t.href, [linkMark.create({ href: t.href || "" })]),
      );
    } else if (t.type === "image") {
      const imgType = schema.nodes.image;
      if (imgType) {
        try {
          result.push(imgType.create({ src: t.src, alt: t.alt || "" }));
        } catch {
          /* skip */
        }
      }
    }
  }
  return result;
}

/** 将一行 Obsidian markdown 转为若干 ProseMirror block 节点 */
function parseLineBlocks(schema: any, raw: string, resourceUrls?: Map<string, string>): any[] {
  const blocks: any[] = [];
  const line = raw;

  // 标题
  const hMatch = line.match(/^(#{1,6})\s/);
  if (hMatch) {
    const level = hMatch[1].length;
    const content = line.replace(/^#{1,6}\s/, "");
    const tokens = tokenizeObsidianInline(content, resourceUrls).filter(
      (t) => t.type !== "image" && t.type !== "video" && t.type !== "audio",
    );
    blocks.push(schema.nodes.heading.create({ level }, buildInline(schema, tokens)));
    return blocks;
  }

  const htmlImgMatch = line.trim().match(/^<img\s+[^>]*src=["'][^"']+["'][^>]*\/?>$/i);
  if (htmlImgMatch) {
    const src = parseAttr(line, "src");
    const alt = parseAttr(line, "alt") || "";
    const width = parseAttr(line, "width");
    const imgType = schema.nodes.image;
    if (imgType && src) {
      try {
        blocks.push(imgType.create({ src, alt, width }));
      } catch {
        /* skip */
      }
    }
    return blocks.length ? blocks : [schema.nodes.paragraph.create()];
  }

  if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
    blocks.push(schema.nodes.horizontalRule.create());
    return blocks;
  }

  const quoteMatch = line.match(/^>\s?(.*)$/);
  if (quoteMatch) {
    const content = quoteMatch[1] || "";
    // 引用内的分割线：> --- / > *** / > ___
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(content)) {
      blocks.push(schema.nodes.blockquote.create(null, schema.nodes.horizontalRule.create()));
    } else {
      const paragraph = schema.nodes.paragraph.create(
        null,
        buildInline(schema, tokenizeObsidianInline(content, resourceUrls)),
      );
      blocks.push(schema.nodes.blockquote.create(null, paragraph));
    }
    return blocks;
  }

  const bulletMatch = line.match(/^\s*[-*+]\s+(.*)$/);
  if (bulletMatch) {
    const paragraph = schema.nodes.paragraph.create(
      null,
      buildInline(schema, tokenizeObsidianInline(bulletMatch[1], resourceUrls)),
    );
    blocks.push(
      schema.nodes.bulletList.create(null, schema.nodes.listItem.create(null, paragraph)),
    );
    return blocks;
  }

  const orderedMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);
  if (orderedMatch) {
    const paragraph = schema.nodes.paragraph.create(
      null,
      buildInline(schema, tokenizeObsidianInline(orderedMatch[1], resourceUrls)),
    );
    blocks.push(
      schema.nodes.orderedList.create(null, schema.nodes.listItem.create(null, paragraph)),
    );
    return blocks;
  }

  if (!line.trim()) {
    blocks.push(schema.nodes.paragraph.create());
    return blocks;
  }

  const tokens = tokenizeObsidianInline(line, resourceUrls);
  const mediaTokens = tokens.filter(
    (t) => t.type === "image" || t.type === "video" || t.type === "audio",
  );
  const textTokens = tokens.filter(
    (t) => t.type !== "image" && t.type !== "video" && t.type !== "audio",
  );

  if (textTokens.some((t) => (t.type === "text" ? t.text.trim() : true))) {
    blocks.push(schema.nodes.paragraph.create(null, buildInline(schema, textTokens)));
  }
  for (const media of mediaTokens) {
    if (media.type === "image") {
      const imgType = schema.nodes.image;
      if (imgType) {
        try {
          blocks.push(imgType.create({ src: media.src, alt: media.alt || "" }));
        } catch {
          /* skip */
        }
      }
    } else if (media.type === "video") {
      const videoType = schema.nodes.videoEmbed;
      if (videoType) {
        try {
          blocks.push(videoType.create({ src: media.src, source: "direct" }));
        } catch {
          /* skip */
        }
      }
    } else if (media.type === "audio") {
      const audioType = schema.nodes.audioEmbed;
      if (audioType) {
        try {
          blocks.push(audioType.create({ src: media.src }));
        } catch {
          /* skip */
        }
      }
    }
  }

  if (blocks.length === 0) {
    blocks.push(schema.nodes.paragraph.create());
  }

  return blocks;
}

const TABLE_SEPARATOR_RE = /^\|?[\s:]*-{1,}[\s:]*(\|[\s:]*-{1,}[\s:]*)*\|?$/;

function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

/** 将多行 markdown 表格构建为 TipTap table 节点 */
function parseTableBlock(
  schema: any,
  tableLines: string[],
  resourceUrls?: Map<string, string>,
): any | null {
  const tableType = schema.nodes.table;
  const rowType = schema.nodes.tableRow;
  const headerType = schema.nodes.tableHeader;
  const cellType = schema.nodes.tableCell;
  if (!tableType || !rowType || !headerType || !cellType) return null;

  try {
    const headerCells = splitTableRow(tableLines[0]);
    const headerRow = rowType.create(
      null,
      headerCells.map((text) =>
        headerType.create(
          null,
          schema.nodes.paragraph.create(
            null,
            buildInline(schema, tokenizeObsidianInline(text, resourceUrls)),
          ),
        ),
      ),
    );

    const dataRows: any[] = [];
    for (let i = 2; i < tableLines.length; i++) {
      if (!tableLines[i].trim()) break;
      const cells = splitTableRow(tableLines[i]);
      dataRows.push(
        rowType.create(
          null,
          cells.map((text) =>
            cellType.create(
              null,
              schema.nodes.paragraph.create(
                null,
                buildInline(schema, tokenizeObsidianInline(text, resourceUrls)),
              ),
            ),
          ),
        ),
      );
    }

    return tableType.create(null, [headerRow, ...dataRows]);
  } catch {
    return null;
  }
}

/** 将 Obsidian markdown 文本直接构建为 ProseMirror Fragment */
function _obsidianToFragment(schema: any, text: string, resourceUrls?: Map<string, string>): any {
  const lines = text.split("\n");
  const blocks: any[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^```/.test(raw)) {
      if (inCode) {
        const lang = codeLang || null;
        blocks.push(
          schema.nodes.codeBlock.create(
            lang ? { language: lang } : {},
            codeLines.length ? schema.text(codeLines.join("\n")) : undefined,
          ),
        );
        codeLines = [];
        inCode = false;
      } else {
        codeLang = raw.slice(3).trim();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(raw);
      continue;
    }

    // 表格检测：当前行含 |，下一行是分隔行
    if (raw.includes("|") && i + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[i + 1].trim())) {
      const tableLines: string[] = [raw];
      let j = i + 1;
      // 收集分隔行 + 后续数据行
      while (j < lines.length && (j === i + 1 || (lines[j].includes("|") && lines[j].trim()))) {
        tableLines.push(lines[j]);
        j++;
      }
      const tableNode = parseTableBlock(schema, tableLines, resourceUrls);
      if (tableNode) {
        blocks.push(tableNode);
        i = j - 1;
        continue;
      }
    }

    if (!raw.trim()) continue;
    blocks.push(...parseLineBlocks(schema, raw, resourceUrls));
  }

  if (inCode) {
    try {
      const lang = codeLang || null;
      const text = codeLines.length ? safeText(schema, codeLines.join("\n")) : null;
      blocks.push(schema.nodes.codeBlock.create(lang ? { language: lang } : {}, text ?? undefined));
    } catch {
      /* skip broken code block */
    }
  }

  // 过滤掉 null 节点
  const valid = blocks.filter(Boolean);

  if (valid.length === 0) {
    valid.push(schema.nodes.paragraph.create());
  }

  try {
    return Fragment.from(valid);
  } catch {
    // 极端兜底：返回纯文本段落
    const para = schema.nodes.paragraph.create();
    return Fragment.from(para);
  }
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
   */
  onToast?: (message: string, type: ToastType) => void;
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
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showStorageSettings, setShowStorageSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showHighlightColors, setShowHighlightColors] = useState(false);

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

        void (async () => {
          try {
            const resourceUrls = await collectClipboardResourceUrls(cb);
            if (resourceUrls.size === 0 && hasLocalMediaRefs(text)) {
              // 走 toast 通道：默认内置 @qingwu/toast 渲染，宿主可经 onToast/setToastProvider 自定义
              toast(
                "检测到本地相对路径图片/视频，但剪贴板没有对应文件；浏览器无法直接读取，请同时复制附件文件，或先上传后使用 URL。",
                "info",
                { maxLines: 3, duration: 6000 },
              );
            }
            const processed = applyResourceUrls(text, resourceUrls);
            const fragment = editorRef.current
              ? markdownToFragment(editorRef.current, processed)
              : null;
            if (fragment) {
              const slice = new Slice(fragment, 0, 0);
              view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
            } else {
              view.dispatch(view.state.tr.insertText(text).scrollIntoView());
            }
          } catch (e) {
            console.warn("Obsidian paste fallback:", e);
            view.dispatch(view.state.tr.insertText(text).scrollIntoView());
          }
        })();

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

  // 选区为空时收起强调色面板，避免残留
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (editor.state.selection.empty) {
        setShowHighlightColors(false);
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

  const bubbleActions = getBubbleMenuActions((key) => t(key));
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
  const openAIPanel = useCallback(() => {
    if (!editor?.isEditable) return;
    savedScrollYRef.current = window.scrollY;
    const domSel = window.getSelection();
    if (domSel && domSel.rangeCount > 0 && !domSel.isCollapsed) {
      const rect = domSel.getRangeAt(0).getBoundingClientRect();
      aiAnchorRef.current = { top: rect.bottom, left: rect.left, width: rect.width };
    } else {
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      aiAnchorRef.current = { top: coords.bottom, left: coords.left, width: 0 };
    }
    setShowAI(true);
    requestAnimationFrame(() => window.scrollTo(0, savedScrollYRef.current));
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

  // 写作助手面板定位 - 基于选区位置，移动端全宽
  useEffect(() => {
    if (!showAI || !editor) return;

    const isMobile = window.innerWidth < 640;
    const anchor = aiAnchorRef.current;
    let top = 120;

    if (isMobile) {
      // 移动端：顶部居中全宽
      if (anchor) top = anchor.top + 10;
      setAiPanelStyle({
        position: "fixed",
        top: Math.max(8, Math.min(top, window.innerHeight - 420)),
        left: 8,
        right: 8,
        width: "auto",
        zIndex: 9999,
      });
      return;
    }

    let left = window.innerWidth / 2 - 200;
    if (anchor) {
      top = anchor.top + 10;
      left = anchor.left + anchor.width / 2 - 200;
    } else {
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      top = coords.bottom + 10;
      left = coords.left;
    }

    const pw = Math.min(400, window.innerWidth - 32);
    const ph = 360;
    setAiPanelStyle({
      position: "fixed",
      top: Math.max(16, Math.min(top, window.innerHeight - ph - 16)),
      left: Math.max(16, Math.min(left, window.innerWidth - pw - 16)),
      zIndex: 9999,
    });
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
            options={{ placement: "bottom", offset: 8 }}
            className="bg-background border border-default-200 rounded-xl p-1 shadow-lg"
          >
            <div
              className="bubble-menu-items flex flex-col gap-1"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) e.preventDefault();
              }}
            >
              <div className="bubble-actions-row flex items-center gap-0.5 flex-wrap justify-center">
                {bubbleActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                      action.isActive(editor)
                        ? "bg-default-200 text-default-900"
                        : action.key === "ai"
                          ? "text-primary hover:bg-primary/10"
                          : action.key === "link"
                            ? editor.isActive("link")
                              ? "bg-primary/10 text-primary"
                              : "text-default-600 hover:bg-default-100"
                            : "text-default-600 hover:bg-default-100"
                    }`}
                    onClick={(event) => {
                      event.preventDefault();
                      if (action.key === "link") {
                        if (editor.isActive("link")) {
                          editor.chain().focus().unsetLink().run();
                        } else {
                          const href = editor.getAttributes("link").href || "";
                          setLinkUrl(href);
                          setShowLinkInput(true);
                        }
                      } else if (action.key === "highlight") {
                        setShowHighlightColors((v) => !v);
                      } else if (action.key === "ai") {
                        const scrollY = window.scrollY;
                        action.command(editor);
                        requestAnimationFrame(() => window.scrollTo(0, scrollY));
                      } else {
                        action.command(editor);
                      }
                    }}
                    title={action.label}
                  >
                    {action.icon}
                  </button>
                ))}
              </div>

              {/* 链接编辑浮层 */}
              {/* 强调色选择浮层 */}
              {showHighlightColors && (
                <div className="flex items-center gap-1 pt-1 border-t border-default-100 flex-wrap">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      className="w-5 h-5 rounded-full border border-default-200 hover:scale-110 transition-transform"
                      style={{ background: c.color }}
                      title={c.name}
                      onClick={() => {
                        editor.chain().focus().setHighlight({ color: c.color }).run();
                        setShowHighlightColors(false);
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className="w-5 h-5 rounded-full border border-default-200 text-default-500 hover:bg-default-100 flex items-center justify-center text-[10px]"
                    title="清除高亮"
                    onClick={() => {
                      editor.chain().focus().unsetHighlight().run();
                      setShowHighlightColors(false);
                    }}
                  >
                    ✕{" "}
                  </button>
                </div>
              )}
              {showLinkInput && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-default-100">
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
                        setShowLinkInput(false);
                      } else if (e.key === "Escape") {
                        setShowLinkInput(false);
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
                      setShowLinkInput(false);
                    }}
                  >
                    确定
                  </button>
                </div>
              )}
            </div>
          </BubbleMenu>
        )}

        {/* 写作助手面板 - 浮动在选中区域下方，点击外部关闭 */}
        {!isReadonly && showAI && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setShowAI(false)} />
            <div
              style={aiPanelStyle}
              className="bg-background border border-default-200 rounded-xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
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
