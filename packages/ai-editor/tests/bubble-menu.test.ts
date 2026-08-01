import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";
import { getBubbleMenuActions } from "../src/editor/extensions/bubble-menu";

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
});
