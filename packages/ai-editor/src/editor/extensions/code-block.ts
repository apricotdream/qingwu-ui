import type { NodeViewRendererProps } from "@tiptap/core";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { Fragment, type Schema } from "@tiptap/pm/model";
import type { NodeViewProps } from "@tiptap/react";
import { ReactRenderer } from "@tiptap/react";
// common 预设未包含 dockerfile，单独注册
import dockerfile from "highlight.js/lib/languages/dockerfile";
import { common, createLowlight } from "lowlight";
import { CodeBlockView } from "./code-block-view";

// 可选语言列表（UI 语言下拉 / 外部引用）
export const CODE_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "html", label: "HTML/XML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "yaml", label: "YAML" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "vue", label: "Vue" },
  { value: "react", label: "React" },
  { value: "markdown", label: "Markdown" },
  { value: "mermaid", label: "Mermaid" },
];

// 创建 lowlight 实例：注册常用语言（highlight.js 自带 js/ts/py/sh/yml/rb/rs/kt/cs 等别名识别）
const lowlight = createLowlight(common);
lowlight.register({ dockerfile });
// 补充 highlight.js 未内置的别名
lowlight.registerAlias("xml", ["vue", "html"]); // html 已是别名，补充 vue
lowlight.registerAlias("javascript", ["react", "jsx"]);
lowlight.registerAlias("typescript", ["tsx"]);

/* 混合 NodeView：
   - 可编辑的 <pre><code> 由原生 DOM 承载并交给 ProseMirror 直接管理（contentDOM），
     React 完全不触碰可编辑内容，从根上规避安卓 Chrome 上 React↔DOMObserver 死循环。
   - 顶部工具栏（语言选择/复制/下载/折叠/AI/删除/mermaid）仍为完整 React 组件，
     通过 ReactRenderer 挂到 contentEditable=false 的外壳里。
   - 行号、隐藏镜像测量也在原生层完成（不触发 React 重渲染）。 */

function splitLines(text: string): string[] {
  return text ? text.split("\n") : [""];
}

function renderLineNumbers(container: HTMLElement, lineCount: number) {
  // 仅在行数变化时重建，避免编辑中反复触发布局
  if (container.childElementCount === lineCount) return;
  container.replaceChildren();
  for (let i = 1; i <= lineCount; i++) {
    const span = document.createElement("span");
    span.className = "cb-line-num";
    span.textContent = String(i);
    container.appendChild(span);
  }
}

function renderMirror(mirror: HTMLElement, texts: string[]) {
  mirror.replaceChildren();
  for (const t of texts) {
    const span = document.createElement("span");
    span.className = "cb-mirror-line";
    span.textContent = t.length ? t : " ";
    mirror.appendChild(span);
  }
}

function measureLineHeights(pre: HTMLPreElement, mirror: HTMLElement, nums: HTMLElement) {
  // 镜像仅保留作兜底；真实行高直接在 <code> 上用 Range 逐行测量。
  // 旧实现读隐藏 mirror 每行的 offsetHeight（整数），在 Android Chromium 上
  // 真实 <pre> 行盒因字体度量/子像素取整约 24.8px/行，5 行累积可差 4px，
  // 行号列比代码卡片短一截、且数字逐行上漂。直接量真实矩形可消除该累积误差。
  const preCS = getComputedStyle(pre);
  const pl = parseFloat(preCS.paddingLeft);
  const pr = parseFloat(preCS.paddingRight);
  mirror.style.boxSizing = "content-box";
  mirror.style.width = `${Math.max(0, pre.clientWidth - pl - pr)}px`;
  mirror.style.padding = preCS.padding;
  // 行号列垂直 padding 同步 pre，保证第 1 行起点与代码首行对齐
  const numsCS = getComputedStyle(nums);
  if (numsCS.paddingTop !== preCS.paddingTop || numsCS.paddingBottom !== preCS.paddingBottom) {
    nums.style.paddingTop = preCS.paddingTop;
    nums.style.paddingBottom = preCS.paddingBottom;
  }

  const code = pre.querySelector("code");
  const fallbackLh = parseFloat(preCS.lineHeight) || 24;
  if (!code) {
    for (let i = 0; i < nums.children.length; i++) {
      (nums.children[i] as HTMLElement).style.height = `${fallbackLh}px`;
    }
    return;
  }

  // 收集每个逻辑行（按 \n 切分）在 code.textContent 中的全局字符偏移区间
  const text = code.textContent ?? "";
  const bounds: Array<[number, number]> = [];
  let lineStart = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      bounds.push([lineStart, i]);
      lineStart = i + 1;
    }
  }

  // 把全局字符偏移映射到具体文本节点 + 局部偏移（lowlight 会把代码拆成多个 <span>）
  const textNodes: Text[] = [];
  const nodeStarts: number[] = [];
  let global = 0;
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let tn: Text | null;
  while ((tn = walker.nextNode() as Text | null)) {
    textNodes.push(tn);
    nodeStarts.push(global);
    global += tn.textContent?.length ?? 0;
  }
  const resolve = (pos: number): { node: Text; offset: number } | null => {
    for (let k = 0; k < textNodes.length; k++) {
      const ns = nodeStarts[k]!;
      const len = textNodes[k]!.textContent?.length ?? 0;
      if (pos <= ns + len) return { node: textNodes[k]!, offset: pos - ns };
    }
    const last = textNodes[textNodes.length - 1];
    return last ? { node: last, offset: last.textContent?.length ?? 0 } : null;
  };

  const preRect = pre.getBoundingClientRect();
  const padTop = parseFloat(preCS.paddingTop);
  const contentTop = preRect.top + padTop;
  const contentBottom = preRect.bottom - parseFloat(preCS.paddingBottom);

  // 取每个逻辑行「首个可见字符矩形」的 top（相对 pre 内容区顶部）。
  // getClientRects 给的是字形墨高而非行盒高，故每行高度由相邻行 top 之差
  // （真实行距，自动含软换行折成的多行高度）求得；末行底部就是 <pre> 内容区
  // 底边（其后再无行盒）。这样行号列总高与 <pre> 逐像素一致，消除 Android
  // 子像素取整造成的累积错位与底部短一截。
  const range = document.createRange();
  const tops: number[] = [];
  for (let i = 0; i < bounds.length; i++) {
    const [s, e] = bounds[i]!;
    let top = NaN;
    const a = resolve(s);
    const b = resolve(e);
    if (a && b) {
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
      const rects = range.getClientRects();
      let min = Infinity;
      for (let r = 0; r < rects.length; r++) {
        if (rects[r]!.height > 0 && rects[r]!.top < min) min = rects[r]!.top;
      }
      if (Number.isFinite(min)) top = min - contentTop;
    }
    tops.push(top);
  }
  // 空行无矩形：沿用上一行 top + 行距
  for (let i = 0; i < tops.length; i++) {
    if (!Number.isFinite(tops[i]!)) {
      tops[i] = i > 0 ? tops[i - 1]! + fallbackLh : 0;
    }
  }

  // 中间行高 = 相邻行「首字 top」之差：字形墨盒相对行盒有半行距 leading，
  // 相邻行相减时 leading 自动抵消，得到精确行距（含软换行折成的多行）。
  // 末行高 = 内容区总高 − 前面各行之和，避免末字形 top 距行盒底有 leading/descent
  // 造成整列短一截。行号列垂直 padding 已同步 pre，故列顶 = pre 内容区顶。
  const contentH = contentBottom - contentTop;
  let used = 0;
  for (let i = 0; i < bounds.length; i++) {
    const num = nums.children[i] as HTMLElement | undefined;
    if (!num) continue;
    let h: number;
    if (i + 1 < tops.length) {
      h = tops[i + 1]! - tops[i]!;
    } else {
      h = contentH - used;
    }
    if (!Number.isFinite(h) || h < 1) h = fallbackLh;
    num.style.height = `${h}px`;
    used += h;
  }
}

// 高亮由 CodeBlockLowlight 内置 lowlight 插件处理（指定语言高亮，未指定则自动检测）；
// 自定义 NodeView 仅负责工具栏（语言选择/复制/下载/mermaid）。
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return (ctx: NodeViewRendererProps) => {
      const { node: initialNode, editor, getPos } = ctx;
      // 当前节点引用，随 update() 刷新；删除/改属性时必须读实时尺寸，
      // 否则编辑后 nodeSize 变化，用初始值会删不干净（残留尾部代码）。
      let currentNode: ProseNode = initialNode;

      // React NodeView 会注入 updateAttributes/deleteNode，vanilla NodeView 没有，
      // 这里用 editor 命令 + 实时 getPos()/currentNode 实现，保持与 React NodeView 一致。
      const updateAttributes = (attrs: Record<string, unknown>) => {
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (typeof pos !== "number") return;
        editor
          .chain()
          .command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...attrs });
            return true;
          })
          .run();
      };
      const deleteNode = () => {
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (typeof pos !== "number") return;
        editor
          .chain()
          .command(({ tr }) => {
            tr.delete(pos, pos + currentNode.nodeSize);
            return true;
          })
          .run();
      };

      const wrapper = document.createElement("div");
      wrapper.className = "code-block-node-view group/cb";

      // React 外壳：display:contents，把工具栏/图表「透传」到 wrapper 布局里
      const reactHost = document.createElement("div");
      reactHost.contentEditable = "false";
      wrapper.appendChild(reactHost);

      // 代码区（原生，ProseMirror 管理 code 内容）
      const area = document.createElement("div");
      area.className = "cb-code-area";
      const lineNums = document.createElement("div");
      lineNums.className = "cb-line-numbers";
      lineNums.contentEditable = "false";
      lineNums.setAttribute("aria-hidden", "true");
      const pre = document.createElement("pre");
      pre.className = "cb-code-pre";
      const code = document.createElement("code");
      pre.appendChild(code);
      const mirror = document.createElement("div");
      mirror.className = "cb-code-mirror";
      mirror.contentEditable = "false";
      mirror.setAttribute("aria-hidden", "true");
      area.appendChild(lineNums);
      area.appendChild(pre);
      area.appendChild(mirror);
      wrapper.appendChild(area);

      // 初始行号/镜像
      const initialTexts = splitLines(initialNode.textContent);
      renderLineNumbers(lineNums, initialTexts.length);
      renderMirror(mirror, initialTexts);

      // React 工具栏
      const renderer = new ReactRenderer(CodeBlockView, {
        editor,
        props: {
          node: initialNode,
          editor,
          getPos,
          updateAttributes,
          deleteNode,
          selected: false,
        } as NodeViewProps,
      });
      reactHost.appendChild(renderer.element);

      const syncVanilla = (next: ProseNode) => {
        const texts = splitLines(next.textContent);
        renderLineNumbers(lineNums, texts.length);
        renderMirror(mirror, texts);
        // 等一帧让 lowlight 装饰与排版落定后再测量
        requestAnimationFrame(() => measureLineHeights(pre, mirror, lineNums));
      };
      // 挂载后首帧再测一次：此时字体/布局已就绪，避免初始行高错位
      requestAnimationFrame(() => measureLineHeights(pre, mirror, lineNums));

      // 宽度变化 / 字体加载后重测行高
      const ro = new ResizeObserver(() => measureLineHeights(pre, mirror, lineNums));
      ro.observe(pre);
      const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
      fonts?.ready?.then(() => measureLineHeights(pre, mirror, lineNums));

      // 注意：selected 仅在「节点被整体选中」（NodeSelection）时为 true，
      // 由 selectNode/deselectNode 维护。光标落在代码块内部打字时 selected 必须为 false，
      // 否则 Backspace/Delete 会被误判成「删除代码块」而弹确认框。
      return {
        dom: wrapper,
        contentDOM: code,
        update(updated: ProseNode) {
          if (updated.type !== initialNode.type) return false;
          if (!updated.sameMarkup(currentNode)) return false;
          currentNode = updated;
          renderer.updateProps({
            node: updated,
            editor,
            getPos,
            updateAttributes,
            deleteNode,
            selected: wrapper.classList.contains("ProseMirror-selectednode"),
          } as NodeViewProps);
          syncVanilla(updated);
          return true;
        },
        selectNode() {
          wrapper.classList.add("ProseMirror-selectednode");
          renderer.updateProps({
            node: currentNode,
            editor,
            getPos,
            updateAttributes,
            deleteNode,
            selected: true,
          } as NodeViewProps);
        },
        deselectNode() {
          wrapper.classList.remove("ProseMirror-selectednode");
          renderer.updateProps({
            node: currentNode,
            editor,
            getPos,
            updateAttributes,
            deleteNode,
            selected: false,
          } as NodeViewProps);
        },
        // 工具栏内部的事件（按钮点击、下拉、输入）不要交给 ProseMirror
        stopEvent(event: Event) {
          const target = event.target as Node | null;
          return Boolean(target && reactHost.contains(target));
        },
        // React 外壳里的属性变更不应触发 ProseMirror 的 mutation 处理
        ignoreMutation(mutation: { target: Node }) {
          if (!code.contains(mutation.target)) return true;
          return false;
        },
        destroy() {
          ro.disconnect();
          renderer.destroy();
        },
      };
    };
  },
  parseHTML() {
    /* 兼容 Obsidian 等来源把代码行逐行包在 <div>（.code-block-line / .cm-line）里：
       ProseMirror 对 content: text* 的 codeBlock 遇到嵌套块级 div 时只保留首行文本，
       后续行全部丢失（表现为「代码块只包住第一句」）。
       用 getContent 强制提取全部文本：若 <pre> 内有行级 div 则按行拼接 \n，否则取 textContent。 */
    return (this.parent?.() ?? []).map((rule) => ({
      ...rule,
      getContent: (node: Node, schema: Schema) => {
        const el = node as Element;
        const codeEl = el.querySelector(":scope > code");
        const lineDivs = Array.from((codeEl ?? el).querySelectorAll(":scope > div"));
        if (lineDivs.length > 0) {
          const text = lineDivs.map((d) => d.textContent ?? "").join("\n");
          return text ? Fragment.from(schema.text(text)) : Fragment.empty;
        }
        const text = el.textContent ?? "";
        return text ? Fragment.from(schema.text(text)) : Fragment.empty;
      },
    }));
  },
}).configure({ lowlight });
