import { cleanup } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";

describe("markdown 渲染", () => {
  afterEach(() => cleanup());

  it("渲染 > 引用块 / - 列表 / --- 分割线", () => {
    const md = "# 标题\n\n> 引用文本\n\n---\n\n- 列表项1\n- 列表项2\n\n正文";
    const editor = new Editor({
      extensions: getEditorExtensions({}),
      content: md,
    });
    const html = editor.getHTML();
    console.log(`=== HTML ===\n${html}`);
    expect(html).toContain("blockquote");
    expect(html).toContain("<ul");
    expect(html).toContain("<hr");
    editor.destroy();
  });

  it("渲染反引号强调为行内 code，纯文本不保留反引号", () => {
    const editor = new Editor({
      extensions: getEditorExtensions({}),
      content: "这是 `示例` 文本",
    });

    expect(editor.getHTML()).toContain("<code>示例</code>");
    expect(editor.getText()).toBe("这是 示例 文本");

    editor.destroy();
  });
});
