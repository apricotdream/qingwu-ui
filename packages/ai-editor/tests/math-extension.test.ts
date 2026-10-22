import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";

describe("KaTeX 数学公式扩展", () => {
  let editor: Editor | undefined;

  function createEditor(content: string): Editor {
    const element = document.createElement("div");
    document.body.appendChild(element);
    editor = new Editor({ element, extensions: getEditorExtensions(), content });
    return editor;
  }

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    document.body.innerHTML = "";
  });

  it("把行内与块级 LaTeX 解析成数学节点", () => {
    const instance = createEditor("行内 $E=mc^2$ 公式\n\n$$\n\\int_0^1 x^2 dx\n$$");

    const found: Array<{ type: string; latex: string }> = [];
    instance.state.doc.descendants((node) => {
      if (node.type.name === "mathInline" || node.type.name === "mathBlock") {
        found.push({ type: node.type.name, latex: node.attrs.latex });
      }
    });

    expect(found).toEqual([
      { type: "mathInline", latex: "E=mc^2" },
      { type: "mathBlock", latex: "\\int_0^1 x^2 dx" },
    ]);
  });

  it("导出 Markdown 时保留 TeX 源码", () => {
    const instance = createEditor("$a+b$\n\n$$\n\\frac{1}{2}\n$$");
    const markdown = instance.storage.markdown.getMarkdown();

    expect(markdown).toContain("$a+b$");
    expect(markdown).toContain("$$");
    expect(markdown).toContain("\\frac{1}{2}");
  });

  it("导出 HTML 时包含 KaTeX 渲染结果与 data-latex", () => {
    const instance = createEditor("$E=mc^2$");
    const html = instance.getHTML();

    expect(html).toContain('data-type="inline-math"');
    expect(html).toContain('data-latex="E=mc^2"');
    expect(html).toContain('class="katex"');
  });

  it("逐行输入的多行块级公式会自动转换", () => {
    const instance = createEditor("占位");
    instance.commands.setContent("<p>$$</p><p>\\frac{20}{100}</p><p>$$</p>");

    const blocks: Array<{ latex: string }> = [];
    instance.state.doc.descendants((node) => {
      if (node.type.name === "mathBlock") blocks.push({ latex: node.attrs.latex });
    });

    expect(blocks).toEqual([{ latex: "\\frac{20}{100}" }]);
  });

  it("不会把货币金额误判为公式", () => {
    const instance = createEditor("价格是 $5 到 $10 之间");
    const json = JSON.stringify(instance.getJSON());

    expect(json).not.toContain("mathInline");
    expect(instance.getText()).toContain("$5 到 $10");
  });

  function paste(text: string): Editor {
    const instance = createEditor("<p>占位</p>");
    instance.commands.focus();
    instance.commands.setTextSelection(3);
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: dataTransfer });
    instance.view.dom.dispatchEvent(event);
    return instance;
  }

  it("粘贴混在中文中的行内 $...$ 自动转换且保留反斜杠", () => {
    const instance = paste("如果$\\dfrac{20}{100}=\\dfrac{1}{5}$，那么");
    const nodes: string[] = [];
    instance.state.doc.descendants((node) => {
      if (node.type.name === "mathInline") nodes.push(node.attrs.latex);
    });
    expect(nodes).toEqual(["\\dfrac{20}{100}=\\dfrac{1}{5}"]);
  });

  it("粘贴单行 $$...$$ 自动转换为块级公式", () => {
    const instance = paste("$$\\frac{1}{2}$$");
    const nodes: string[] = [];
    instance.state.doc.descendants((node) => {
      if (node.type.name === "mathBlock") nodes.push(node.attrs.latex);
    });
    expect(nodes).toEqual(["\\frac{1}{2}"]);
  });

  it("粘贴多行 $$...$$ 自动转换为块级公式", () => {
    const instance = paste("$$\n\\frac{20}{100}=\\frac{1}{5}\n$$");
    const nodes: string[] = [];
    instance.state.doc.descendants((node) => {
      if (node.type.name === "mathBlock") nodes.push(node.attrs.latex);
    });
    expect(nodes).toEqual(["\\frac{20}{100}=\\frac{1}{5}"]);
  });
});

