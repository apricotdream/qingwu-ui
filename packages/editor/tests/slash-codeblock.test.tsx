import { cleanup } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";
import { slashCommandPluginKey } from "../src/editor/extensions/slash-command";

function slashActive(editor: Editor): boolean {
  const st = slashCommandPluginKey.getState(editor.state);
  return !!(st && st.active);
}

describe("代码块内 slash 命令", () => {
  afterEach(() => cleanup());

  it("代码块内输入 / 不应触发命令栏", () => {
    const editor = new Editor({
      extensions: getEditorExtensions({}),
      content: '<pre><code class="language-js">foo</code></pre>',
    });
    // 光标置于代码块内文本末尾
    editor.commands.setTextSelection(8);
    editor.commands.insertContent("/");
    expect(slashActive(editor)).toBe(false);
    editor.destroy();
  });

  it("代码块外（段落起始）输入 / 应触发命令栏（对照）", () => {
    const editor = new Editor({
      extensions: getEditorExtensions({}),
      content: "<p>abc</p>",
    });
    // 段落起始处，前缀为行首，符合 slash 触发条件
    editor.commands.setTextSelection(1);
    editor.commands.insertContent("/");
    expect(slashActive(editor)).toBe(true);
    editor.destroy();
  });
});
