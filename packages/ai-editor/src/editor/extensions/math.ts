import { type Editor, InputRule, Node } from "@tiptap/core";
import type { NodeType } from "@tiptap/pm/model";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { escapeAttr, renderMathHtml } from "./math-utils";
import { MathView } from "./math-view";

// 行内 `$...$`：首尾不允许空白，避免把 "$5 and $10" 误判成公式
const INLINE_MATH_INPUT_RE = /(?:^|[^\\$])\$([^\s$](?:[^$\n]*[^\s$])?)\$$/;
// 块级 `$$...$$`：整段文本就是一个公式时转换为块节点
const BLOCK_MATH_INPUT_RE = /^\$\$([\s\S]+?)\$\$$/;

/**
 * 自动把「$$ / 内容 / $$」三行（或多行）纯文本转成块级公式。
 * 输入规则只能匹配单个段落，用户逐行键入多行公式时不会触发；
 * 这里在每次文档变化后扫描顶层段落，闭合的 $$ 一出现就转换。
 */
function createMultilineBlockMathPlugin(editor: Editor): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!editor.isEditable || editor.view.composing) return null;
      if (!transactions.some((tr) => tr.docChanged)) return null;

      const paragraphType = newState.schema.nodes.paragraph;
      const mathBlockType = newState.schema.nodes.mathBlock;
      if (!paragraphType || !mathBlockType) return null;

      const matches: Array<{ from: number; to: number; latex: string }> = [];
      let open: { from: number; lines: string[] } | null = null;

      newState.doc.forEach((node, offset) => {
        if (node.type !== paragraphType) {
          open = null;
          return;
        }
        const text = node.textContent.trim();
        const current = open;
        if (!current) {
          if (text === "$$") open = { from: offset, lines: [] };
          return;
        }
        if (text === "$$") {
          matches.push({
            from: current.from,
            to: offset + node.nodeSize,
            latex: current.lines.join("\n"),
          });
          open = null;
          return;
        }
        current.lines.push(node.textContent);
      });

      if (!matches.length) return null;

      const tr = newState.tr;
      // 从后往前替换，避免前面的位置变化影响后面的范围
      for (const match of matches.reverse()) {
        const mathNode = mathBlockType.create({ latex: match.latex });
        tr.replaceWith(match.from, match.to, mathNode);

        // 保证公式后仍有可输入的段落
        const afterPos = match.from + mathNode.nodeSize;
        const $after = tr.doc.resolve(afterPos);
        if (!$after.nodeAfter || !$after.nodeAfter.isTextblock) {
          tr.insert(afterPos, paragraphType.create());
        }
        tr.setSelection(TextSelection.near(tr.doc.resolve(afterPos), 1));
      }
      return tr;
    },
  });
}

function inlineMathInputRule(type: NodeType): InputRule {
  return new InputRule({
    find: INLINE_MATH_INPUT_RE,
    handler: ({ state, range, match }) => {
      const latex = match[1];
      const dollarOffset = match[0].indexOf("$");
      if (dollarOffset < 0) return;
      const from = range.from + dollarOffset;
      const to = range.to;
      if (from >= to) return;
      state.tr.replaceWith(from, to, type.create({ latex }));
    },
  });
}

function blockMathInputRule(type: NodeType): InputRule {
  return new InputRule({
    find: BLOCK_MATH_INPUT_RE,
    handler: ({ state, range, match }) => {
      const latex = match[1].trim();
      if (!latex) return;

      const $pos = state.doc.resolve(range.from);
      const depth = $pos.depth;
      const from = $pos.before(depth);
      const to = $pos.after(depth);
      const mathNode = type.create({ latex });
      const tr = state.tr.replaceWith(from, to, mathNode);

      // 块级公式需要相邻的可输入文本块，否则光标没有落点
      const afterPos = from + mathNode.nodeSize;
      const $after = tr.doc.resolve(afterPos);
      if (!$after.nodeAfter || !$after.nodeAfter.isTextblock) {
        tr.insert(afterPos, state.schema.nodes.paragraph.create());
      }
      tr.setSelection(TextSelection.near(tr.doc.resolve(afterPos), 1));
    },
  });
}

interface MarkdownToken {
  content: string;
}

interface MarkdownInlineState {
  src: string;
  pos: number;
  push(type: string, tag: string, nesting: number): MarkdownToken;
}

interface MarkdownBlockState {
  src: string;
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  line: number;
  push(type: string, tag: string, nesting: number): MarkdownToken;
}

interface MarkdownItLike {
  __qingwuMathReg?: boolean;
  inline: { ruler: { before(name: string, ruleName: string, rule: unknown): void } };
  block: {
    ruler: {
      before(name: string, ruleName: string, rule: unknown, options?: { alt: string[] }): void;
    };
  };
}

interface MarkdownSerializerLike {
  write(value: string): void;
  ensureNewLine(): void;
  closeBlock(node: unknown): void;
}

interface MathNodeLike {
  attrs: { latex?: string };
}

/** markdown-it inline 规则：把 `$...$` 转成 mathInline 节点可解析的 HTML */
function mathInlineRule(state: MarkdownInlineState, silent: boolean): boolean {
  const src: string = state.src;
  const start: number = state.pos;
  if (src.charCodeAt(start) !== 0x24 /* $ */) return false;
  if (src.charCodeAt(start + 1) === 0x24 /* $ */) return false;

  let end = start + 1;
  while (end < src.length) {
    const ch = src.charCodeAt(end);
    if (ch === 0x0a /* \n */) return false;
    if (ch === 0x24 /* $ */ && src.charCodeAt(end - 1) !== 0x5c /* \ */) break;
    end += 1;
  }
  if (end >= src.length) return false;

  const content = src.slice(start + 1, end);
  // 与输入规则保持一致：首尾空白不视为公式
  if (!content || /^\s|\s$/.test(content)) return false;

  if (!silent) {
    const token = state.push("html_inline", "", 0);
    token.content = `<span data-type="inline-math" data-latex="${escapeAttr(content)}"></span>`;
  }
  state.pos = end + 1;
  return true;
}

/** markdown-it block 规则：把 `$$...$$`（单行或多行）转成 mathBlock HTML */
function mathBlockRule(
  state: MarkdownBlockState,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (start + 1 >= max) return false;
  if (state.src.charCodeAt(start) !== 0x24 || state.src.charCodeAt(start + 1) !== 0x24)
    return false;

  const firstLine: string = state.src.slice(start, max).trim();
  let content = "";
  let nextLine = startLine + 1;

  if (firstLine.length > 4 && firstLine.endsWith("$$")) {
    content = firstLine.slice(2, -2);
  } else {
    const lines: string[] = [];
    const head = firstLine.slice(2);
    let found = head.endsWith("$$");
    if (found) {
      content = head.slice(0, -2);
    } else {
      if (head) lines.push(head);
      for (; nextLine < endLine; nextLine += 1) {
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const lineEnd = state.eMarks[nextLine];
        const raw: string = state.src.slice(lineStart, lineEnd);
        const trimmed = raw.trimEnd();
        if (trimmed.endsWith("$$")) {
          lines.push(trimmed.slice(0, -2));
          found = true;
          nextLine += 1;
          break;
        }
        lines.push(raw);
      }
      if (!found) return false;
      content = lines.join("\n");
    }
  }

  if (silent) return true;

  const token = state.push("html_block", "", 0);
  token.content = `<div data-type="block-math" data-latex="${escapeAttr(content.trim())}"></div>\n`;
  state.line = nextLine;
  return true;
}

function registerMathMarkdownRules(md: MarkdownItLike) {
  if (md.__qingwuMathReg) return;
  md.__qingwuMathReg = true;
  md.inline.ruler.before("backticks", "qingwu_math_inline", mathInlineRule);
  md.block.ruler.before("fence", "qingwu_math_block", mathBlockRule, { alt: ["paragraph"] });
}

function mathMarkdownStorage(isBlock: boolean) {
  return {
    markdown: {
      serialize(state: MarkdownSerializerLike, node: MathNodeLike) {
        const latex = String(node.attrs.latex ?? "");
        if (!isBlock) {
          state.write(`$${latex}$`);
          return;
        }

        state.ensureNewLine();
        state.write("$$");
        state.ensureNewLine();
        for (const line of latex.split("\n")) {
          state.write(line);
          state.ensureNewLine();
        }
        state.write("$$");
        state.closeBlock(node);
      },
      parse: {
        setup(md: MarkdownItLike) {
          registerMathMarkdownRules(md);
        },
      },
    },
  };
}

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-latex") ?? element.textContent ?? "",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-math"]' }, { tag: "span.math-node--inline" }];
  },

  renderHTML({ node }) {
    const latex = String(node.attrs.latex ?? "");
    const attrs = {
      "data-type": "inline-math",
      "data-latex": latex,
      class: "math-node math-node--inline",
    };

    if (typeof document === "undefined") {
      return ["span", attrs, latex];
    }

    const span = document.createElement("span");
    for (const [key, value] of Object.entries(attrs)) span.setAttribute(key, value);
    span.innerHTML = renderMathHtml(latex, false);
    return span;
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },

  addInputRules() {
    return [inlineMathInputRule(this.type)];
  },

  addStorage() {
    return mathMarkdownStorage(false);
  },
});

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-latex") ?? element.textContent ?? "",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="block-math"]' }, { tag: "div.math-node--block" }];
  },

  renderHTML({ node }) {
    const latex = String(node.attrs.latex ?? "");
    const attrs = {
      "data-type": "block-math",
      "data-latex": latex,
      class: "math-node math-node--block",
    };

    if (typeof document === "undefined") {
      return ["div", attrs, latex];
    }

    const div = document.createElement("div");
    for (const [key, value] of Object.entries(attrs)) div.setAttribute(key, value);
    div.innerHTML = renderMathHtml(latex, true);
    return div;
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },

  addInputRules() {
    return [blockMathInputRule(this.type)];
  },

  addProseMirrorPlugins() {
    return [createMultilineBlockMathPlugin(this.editor)];
  },

  addStorage() {
    return mathMarkdownStorage(true);
  },
});
