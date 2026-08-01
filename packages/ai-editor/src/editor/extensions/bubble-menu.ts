import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";

export interface BubbleMenuAction {
  key: string;
  label: string;
  icon: string;
  isActive: (editor: Editor) => boolean;
  command: (editor: Editor) => void;
}

/** 搜索引擎 URL 模板，{query} 会被替换为选中文本 */
let searchEngineTemplate = "https://www.bing.com/search?q={query}";

/** 设置搜索引擎 URL 模板，例如：
 *  - Google: "https://www.google.com/search?q={query}"
 *  - Baidu:  "https://www.baidu.com/s?wd={query}"
 *  - DuckDuckGo: "https://duckduckgo.com/?q={query}"
 */
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
      icon: "B",
      isActive: (editor) => editor.isActive("bold"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      label: t("editor.bubble.italic"),
      icon: "I",
      isActive: (editor) => editor.isActive("italic"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleItalic().run(),
    },
    {
      key: "underline",
      label: t("editor.bubble.underline"),
      icon: "U",
      isActive: (editor) => editor.isActive("underline"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: "strikethrough",
      label: t("editor.bubble.strikethrough"),
      icon: "S",
      isActive: (editor) => editor.isActive("strike"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleStrike().run(),
    },
    {
      key: "code",
      label: t("editor.bubble.emphasis"),
      icon: "`",
      isActive: (editor) => editor.isActive("code"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleCode().run(),
    },
    {
      key: "highlight",
      label: t("editor.bubble.highlight"),
      icon: "A",
      isActive: (editor) => editor.isActive("highlight"),
      command: (editor) => editor.isEditable && editor.chain().focus().toggleHighlight().run(),
    },
    {
      key: "copy",
      label: t("editor.bubble.copy"),
      icon: "⧉",
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
      icon: "🔍",
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
      key: "link",
      label: t("editor.bubble.link"),
      icon: "🔗",
      isActive: (editor) => editor.isActive("link"),
      command: () => {
        // link 操作由 QingWuAIEditor 组件的自定义浮层处理
      },
    },
    {
      key: "table",
      label: t("editor.bubble.table"),
      icon: "▦",
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
      icon: "✨",
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
