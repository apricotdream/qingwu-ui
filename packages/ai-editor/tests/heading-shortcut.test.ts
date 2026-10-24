import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";

let editor: Editor;
function createEditor(content: string) {
  editor = new Editor({ extensions: getEditorExtensions(), content });
  return editor;
}

afterEach(() => editor?.destroy());

describe("Ctrl+Enter 取消标题样式", () => {
  it.each([1, 2, 3, 4, 5, 6])("将 H%s 转为正文，保留文字和光标位置", (level) => {
    const instance = createEditor(`<h${level}>标题内容</h${level}><p>后续正文</p>`);
    instance.commands.setTextSelection(3);
    instance.commands.keyboardShortcut("Ctrl-Enter");
    expect(instance.state.doc.firstChild!.type.name).toBe("paragraph");
    expect(instance.state.doc.firstChild!.textContent).toBe("标题内容");
    expect(instance.state.selection.from).toBe(3);
    expect(instance.state.doc.child(1).textContent).toBe("后续正文");
    expect(instance.state.doc.childCount).toBe(2);
  });

  it("空标题切换为正文后可直接继续编写", () => {
    const instance = createEditor("<h2></h2>");
    instance.commands.keyboardShortcut("Ctrl-Enter");
    instance.commands.insertContent("继续编写");
    expect(instance.state.doc.firstChild!.type.name).toBe("paragraph");
    expect(instance.state.doc.firstChild!.textContent).toBe("继续编写");
  });

  it("正文中保留原有 Ctrl+Enter 硬换行行为", () => {
    const instance = createEditor("<p>普通正文</p>");
    instance.commands.setTextSelection(3);
    instance.commands.keyboardShortcut("Ctrl-Enter");
    expect(instance.getHTML()).toBe("<p>普通<br>正文</p>");
  });

  it("不影响其他标题，可一次撤销", () => {
    const instance = createEditor("<h1>当前标题</h1><h2>其他标题</h2><p></p>");
    instance.commands.setTextSelection(2);
    instance.commands.keyboardShortcut("Ctrl-Enter");
    expect(instance.state.doc.child(1).type.name).toBe("heading");
    instance.commands.undo();
    expect(instance.getHTML()).toBe("<h1>当前标题</h1><h2>其他标题</h2><p></p>");
  });
});
