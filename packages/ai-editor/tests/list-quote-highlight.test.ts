import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";

let editor: Editor;
const content =
  "<ol><li><p>有序一</p><ul><li><p>嵌套项</p></li></ul></li><li><p>有序二</p></li></ol><ul><li><p>无序项</p></li></ul><blockquote><p>引用一</p><p>引用二</p></blockquote><p>普通正文</p>";

function setup(initialContent = content) {
  const host = document.createElement("div");
  document.body.append(host);
  editor = new Editor({
    element: host,
    extensions: getEditorExtensions(),
    content: initialContent,
  });
  editor.view.focus();
}

function select(text: string) {
  let pos = 0;
  editor.state.doc.descendants((node, offset) => {
    if (node.isText && node.text === text) pos = offset;
  });
  editor.commands.setTextSelection(pos + 1);
}

afterEach(() => {
  editor?.destroy();
  document.body.replaceChildren();
});

describe("列表与引用当前行反馈", () => {
  it.each(["ol", "ul", "blockquote"])("%s 支持回车续写和空行退出", (tag) => {
    setup(
      tag === "blockquote"
        ? "<blockquote><p>测试</p></blockquote>"
        : `<${tag}><li><p>测试</p></li></${tag}>`,
    );
    select("测试");
    editor.commands.setTextSelection(editor.state.selection.from + 1);
    expect(editor.commands.keyboardShortcut("Enter")).toBe(true);
    expect(editor.state.selection.$head.parent.textContent).toBe("");
    expect(
      editor.isActive(tag === "ol" ? "orderedList" : tag === "ul" ? "bulletList" : "blockquote"),
    ).toBe(true);
    editor.commands.keyboardShortcut("Enter");
    expect(editor.state.selection.$head.depth).toBe(1);
    expect(editor.state.selection.$head.parent.type.name).toBe("paragraph");
  });
  it.each(["有序一", "有序二", "无序项", "嵌套项"])("只标记当前段落：%s", async (text) => {
    setup();
    select(text);
    await vi.waitFor(() =>
      expect(editor.view.dom.querySelectorAll(".qw-active-row")).toHaveLength(1),
    );
    expect(editor.view.dom.querySelector(".qw-active-row")?.textContent).toBe(text);
    const items = editor.view.dom.querySelectorAll("li.qw-active-list-item");
    expect(items).toHaveLength(1);
    expect(items[0].firstElementChild?.textContent).toBe(text);
  });

  it.each(["引用一", "引用二"])("引用反馈覆盖整块：%s", (text) => {
    setup();
    select(text);
    expect(editor.view.dom.querySelectorAll("blockquote.qw-active-quote")).toHaveLength(1);
    expect(editor.view.dom.querySelector(".qw-active-quote")?.textContent).toBe("引用一引用二");
    expect(editor.view.dom.querySelector("p.qw-active-row")).toBeNull();
  });

  it.each(["ol", "ul", "blockquote", "p"])("%s 中间回车拆行且可撤销", (tag) => {
    setup(
      tag === "p"
        ? "<p>测试</p>"
        : tag === "blockquote"
          ? "<blockquote><p>测试</p></blockquote>"
          : `<${tag}><li><p>测试</p></li></${tag}>`,
    );
    select("测试");
    const before = editor.getJSON();
    editor.commands.keyboardShortcut("Enter");
    expect(editor.state.selection.$head.parent.textContent).toBe("试");
    expect(editor.getHTML()).toContain("测</p>");
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getJSON()).toEqual(before);
  });

  it("移入普通正文后清除行反馈，不影响文档内容与导出", async () => {
    setup();
    const json = editor.getJSON();
    select("引用二");
    expect(editor.getHTML()).not.toContain("qw-active");
    expect(editor.getJSON()).toEqual(json);
    select("普通正文");
    expect(editor.view.dom.querySelector('[class*="qw-active"]')).toBeNull();
  });

  it("编辑器失焦后移除当前行反馈", async () => {
    setup();
    select("无序项");
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    await vi.waitFor(() =>
      expect(editor.view.dom.querySelector('[class*="qw-active"]')).toBeNull(),
    );
  });

  it("选中文字时保留浏览器原生选区颜色", () => {
    setup();
    select("引用一");
    const from = editor.state.selection.from;
    editor.commands.setTextSelection({ from, to: from + 1 });
    expect(editor.view.dom.querySelector('[class*="qw-active"]')).toBeNull();
  });
});
