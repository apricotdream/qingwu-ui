import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import type { ReactNode } from "react";
import {
  BoldIcon,
  CodeIcon,
  CopyIcon,
  HighlightIcon,
  ItalicIcon,
  LinkIcon,
  MathIcon,
  SearchIcon,
  SparklesIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
} from "../icons";

/** 剥掉用户手输的 $...$ / $$...$$ 包裹，返回纯 LaTeX 源码；无包裹时原样返回 */
export function unwrapDollars(text: string): string {
  const trimmed = text.trim();
  const inline = /^\$([^$]+?)\$$/.exec(trimmed);
  if (inline) return inline[1].trim();
  const block = /^\$\$([\s\S]+?)\$\$$/.exec(trimmed);
  if (block) return block[1].trim();
  return trimmed;
}

/** 选中文本是否值得转成公式：含数字/数学符号，或本身已被 $ 包裹 */
export function looksLikeMath(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^\${1,2}[\s\S]*\${1,2}$/.test(trimmed)) return true;
  return /[0-9=]/.test(trimmed) && /[+\-*/^=(){}_\\]/.test(trimmed);
}

export interface BubbleMenuAction {
  key: string;
  label: string;
  icon: ReactNode;
  isActive: (editor: Editor) => boolean;
  command: (editor: Editor) => void;
  /** true 时折叠进「⋯」二级菜单，主行保持紧凑单行 */
  more?: boolean;
}

/** 搜索引擎 URL 模板，{query} 会被替换为选中文本 */
let searchEngineTemplate = "https://www.bing.com/search?q={query}";

/** 设置搜索引擎 URL 模板，如 "https://www.google.com/search?q={query}" */
export function setSearchEngine(template: string) {
  searchEngineTemplate = template;
}

/** 获取当前搜索引擎模板 */
export function getSearchEngine(): string {
  return searchEngineTemplate;
}

export function getBubbleMenuActions(t: (key: string) => string): BubbleMenuAction[] {
  return [
    {
      key: "bold",
      label: t("editor.bubble.bold"),
      icon: <BoldIcon />,
      isActive: (editor) => editor.isActive("bold"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      label: t("editor.bubble.italic"),
      icon: <ItalicIcon />,
      isActive: (editor) => editor.isActive("italic"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleItalic().run(),
    },
    {
      key: "underline",
      label: t("editor.bubble.underline"),
      icon: <UnderlineIcon />,
      isActive: (editor) => editor.isActive("underline"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: "strikethrough",
      label: t("editor.bubble.strikethrough"),
      icon: <StrikethroughIcon />,
      isActive: (editor) => editor.isActive("strike"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleStrike().run(),
    },
    {
      key: "code",
      label: t("editor.bubble.emphasis"),
      icon: <CodeIcon />,
      isActive: (editor) => editor.isActive("code"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleCode().run(),
    },

    {
      key: "mathInline",
      label: t("editor.bubble.mathInline"),
      icon: <MathIcon />,
      isActive: (editor) => editor.isActive("mathInline"),
      command: (editor) => {
        if (!editor.isEditable) return;
        const { from, to } = editor.state.selection;
        if (from === to) return;
        const selected = editor.state.doc.textBetween(from, to, "\n");
        const latex = unwrapDollars(selected);
        if (!latex) return;
        editor
          .chain()
          .focus()
          .insertContentAt({ from, to }, { type: "mathInline", attrs: { latex } })
          .run();
      },
    },
    {
      key: "highlight",
      label: t("editor.bubble.highlight"),
      icon: <HighlightIcon />,
      more: true,
      isActive: (editor) => editor.isActive("highlight"),
      // 高亮色板由 QingWuAIEditor 组件的自定义浮层处理
      command: () => {},
    },
    {
      key: "link",
      label: t("editor.bubble.link"),
      icon: <LinkIcon />,
      more: true,
      isActive: (editor) => editor.isActive("link"),
      // link 操作由 QingWuAIEditor 组件的自定义浮层处理
      command: () => {},
    },
    {
      key: "copy",
      label: t("editor.bubble.copy"),
      icon: <CopyIcon />,
      more: true,
      isActive: () => false,
      command: (editor) => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, "\n").trim();
        if (!text) return;
        navigator.clipboard?.writeText(text).catch(() => {});
      },
    },
    {
      key: "search",
      label: t("editor.bubble.search"),
      icon: <SearchIcon />,
      more: true,
      isActive: () => false,
      command: (editor) => {
        // 已在表格内则跳过，避免嵌套
        if (editor.isActive("table")) return;
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ").trim();
        if (!text) return;
        const url = searchEngineTemplate.replace("{query}", encodeURIComponent(text));
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    {
      key: "table",
      label: t("editor.bubble.table"),
      icon: <TableIcon />,
      more: true,
      isActive: (editor) => editor.isActive("table"),
      command: (editor) => {
        if (!editor.isEditable) return;
        // 已在表格内则跳过，避免嵌套
        if (editor.isActive("table")) return;
        const { from, to, $to } = editor.state.selection;
        const chain = editor.chain().focus();
        if (from !== to) {
          // 先折叠选区到末尾，保留选中文本，避免 insertTable 清除选中内容
          chain.setTextSelection($to.end($to.depth));
        }
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).scrollIntoView().run();
      },
    },

    {
      key: "ai",
      label: t("editor.ai.trigger"),
      icon: <SparklesIcon />,
      isActive: () => false,
      command: (editor) => {
        if (!editor.isEditable) return;
        // 通过 (editor.storage as any).qingwuUI 触发写作助手面板（多实例安全）
        const storage = (editor.storage as any).qingwuUI as { openAI?: () => void } | undefined;
        storage?.openAI?.();
      },
    },
  ];
}

export const BubbleMenuExtension = Extension.create({
  name: "bubbleMenu",
});
