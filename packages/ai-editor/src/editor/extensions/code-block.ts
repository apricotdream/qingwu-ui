import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
// common 预设未包含 dockerfile，单独注册
import dockerfile from "highlight.js/lib/languages/dockerfile";
import { common, createLowlight } from "lowlight";
import { ReactRenderer } from "@tiptap/react";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { Fragment, type Schema } from "@tiptap/pm/model";
import type { NodeViewProps } from "@tiptap/react";
import type { NodeViewRendererProps } from "@tiptap/core";
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

function measureLineHeights(
  pre: HTMLPreElement,
  mirror: HTMLElement,
  nums: HTMLElement,
) {
  // 镜像必须与真实 <pre> 有完全一致的排版盒：移动端媒体查询会给
  // .cb-code-pre / .cb-code-mirror / .cb-line-numbers 不同的 padding，
  // 既会让镜像按更宽内容区折行（行数偏少），也会让垂直起点错位。
  // 这里把镜像的 padding 整体同步成 pre 的实测值，并用 content-box + 精确内容宽，
  // 保证折行点与逐行高度和真实 <pre> 逐像素一致。
  const preCS = getComputedStyle(pre);
  const pl = parseFloat(preCS.paddingLeft);
  const pr = parseFloat(preCS.paddingRight);
  const contentWidth = pre.clientWidth - pl - pr;
  mirror.style.boxSizing = "content-box";
  mirror.style.width = `${contentWidth}px`;
  mirror.style.padding = preCS.padding;
  // 行号列垂直 padding 同步 pre，保证第 1 行起点与代码首行对齐
  const numsCS = getComputedStyle(nums);
  if (numsCS.paddingTop !== preCS.paddingTop || numsCS.paddingBottom !== preCS.paddingBottom) {
    nums.style.paddingTop = preCS.paddingTop;
    nums.style.paddingBottom = preCS.paddingBottom;
  }
  const kids = mirror.children;
  for (let i = 0; i < kids.length; i++) {
    const h = (kids[i] as HTMLElement).offsetHeight;
    const num = nums.children[i] as HTMLElement | undefined;
    if (num && num.offsetHeight !== h) num.style.height = `${h}px`;
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
      const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } })
        .fonts;
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
        const lineDivs = Array.from(
          (codeEl ?? el).querySelectorAll(":scope > div"),
        );
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
