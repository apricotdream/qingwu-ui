import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";

let editor: Editor;

function setup(tag: string) {
  editor = new Editor({
    extensions: getEditorExtensions(),
    content: `<${tag}><li><p>第一项</p></li><li><p>第二项</p></li><li><p>第三项</p></li></${tag}>`,
  });
}

function position(text: string) {
  let pos = 0;
  editor.state.doc.descendants((node, offset) => {
    if (node.isText && node.text === text) pos = offset;
  });
  return pos;
}

afterEach(() => editor?.destroy());

describe("列表 Tab 缩进", () => {
  it.each(["ol", "ul"])("%s 的第二项缩进与反向缩进保留内容和光标", (tag) => {
    setup(tag);
    editor.commands.setTextSelection(position("第二项") + 1);
    const before = editor.getJSON();
    editor.commands.keyboardShortcut("Tab");
    const list = editor.state.doc.firstChild!;
    expect(list.childCount).toBe(2);
    expect(list.firstChild!.lastChild!.type.name).toBe(tag === "ol" ? "orderedList" : "bulletList");
    expect(editor.state.selection.$head.parentOffset).toBe(1);
    expect(editor.state.selection.$head.parent.textContent).toBe("第二项");
    editor.commands.keyboardShortcut("Shift-Tab");
    expect(editor.getJSON()).toEqual(before);
  });

  it("回车生成的空有序项可缩进并继续输入", () => {
    setup("ol");
    editor.commands.setTextSelection(position("第三项") + 3);
    editor.commands.keyboardShortcut("Enter");
    editor.commands.keyboardShortcut("Tab");
    editor.commands.insertContent("新的子项");
    expect(editor.state.selection.$head.depth).toBe(5);
    expect(editor.state.doc.firstChild!.lastChild!.lastChild!.textContent).toBe("新的子项");
  });

  it("选中多个有序项时一起缩进", () => {
    setup("ol");
    editor.commands.setTextSelection({ from: position("第二项"), to: position("第三项") + 3 });
    editor.commands.keyboardShortcut("Tab");
    const list = editor.state.doc.firstChild!;
    expect(list.childCount).toBe(1);
    expect(list.firstChild!.lastChild!.childCount).toBe(2);
    expect(list.textContent).toBe("第一项第二项第三项");
  });
});
