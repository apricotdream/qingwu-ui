import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";
import {
  getBubbleMenuActions,
  looksLikeMath,
  unwrapDollars,
} from "../src/editor/extensions/bubble-menu";

function mathNodes(editor: Editor): string[] {
  const nodes: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "mathInline") nodes.push(node.attrs.latex);
  });
  return nodes;
}

describe("气泡栏", () => {
  afterEach(() => vi.restoreAllMocks());

  it("复制控件复制选区纯文本", () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const editor = new Editor({
      extensions: getEditorExtensions({}),
      content: "<p>复制 <code>示例</code> 文本</p>",
    });
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });

    getBubbleMenuActions((key) => key)
      .find((action) => action.key === "copy")
      ?.command(editor);

    expect(writeText).toHaveBeenCalledWith("复制 示例 文本");
    editor.destroy();
  });

  it("looksLikeMath 判定公式样式文本", () => {
    expect(looksLikeMath("1/2")).toBe(true);
    expect(looksLikeMath("(a+b)^2")).toBe(true);
    expect(looksLikeMath("$E=mc^2$")).toBe(true);
    expect(looksLikeMath("2024年")).toBe(false);
    expect(looksLikeMath("你好世界")).toBe(false);
  });

  it("unwrapDollars 剥掉手输的美元符包裹", () => {
    expect(unwrapDollars("$\\frac{1}{2}$")).toBe("\\frac{1}{2}");
    expect(unwrapDollars("$$x^2$$")).toBe("x^2");
    expect(unwrapDollars("1+2=3")).toBe("1+2=3");
  });

  it("行内公式动作把选中的算式替换为 mathInline 节点", () => {
    const editor = new Editor({
      extensions: getEditorExtensions({}),
      content: "<p>结果是 1/2 没错</p>",
    });
    // 选中 “1/2”（结1 果2 是3 空格4 1=5 /=6 2=7 空格8）
    editor.commands.setTextSelection({ from: 5, to: 8 });

    getBubbleMenuActions((key) => key)
      .find((action) => action.key === "mathInline")
      ?.command(editor);

    expect(mathNodes(editor)).toEqual(["1/2"]);
    editor.destroy();
  });

  it("行内公式动作自动剥掉选中内容外层的 $", () => {
    const editor = new Editor({
      extensions: getEditorExtensions({}),
      content: "<p>$E=mc^2$</p>",
    });
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });

    getBubbleMenuActions((key) => key)
      .find((action) => action.key === "mathInline")
      ?.command(editor);

    expect(mathNodes(editor)).toEqual(["E=mc^2"]);
    editor.destroy();
  });
});

