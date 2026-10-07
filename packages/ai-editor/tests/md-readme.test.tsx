import { readFileSync } from "node:fs";
import { cleanup } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";

describe("README markdown 渲染", () => {
  afterEach(() => cleanup());

  it("真实 README 内容渲染引用/列表/分割线", () => {
    const md = readFileSync("README.md", "utf8").replace(/\.\/public\//g, "/");
    const editor = new Editor({
      extensions: getEditorExtensions({}),
      content: md,
    });
    const html = editor.getHTML();
    const hasBlockquote = /<blockquote/.test(html);
    const hasUl = /<ul/.test(html);
    const hasHr = /<hr/.test(html);
    console.log("blockquote:", hasBlockquote, "ul:", hasUl, "hr:", hasHr);
    console.log("html length:", html.length);
    // 打印前 600 字符看结构
    console.log(`=== head ===\n${html.slice(0, 600)}`);
    expect(hasBlockquote && hasUl && hasHr).toBe(true);
    editor.destroy();
  });
});
