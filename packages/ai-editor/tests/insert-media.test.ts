import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";
import { insertMedia } from "../src/editor/utils/insert-media";

const editors: Editor[] = [];
function createEditor(content: string) {
  const editor = new Editor({ extensions: getEditorExtensions(), content });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe.each(["image", "attachmentEmbed", "audioEmbed", "videoEmbed"])(
  "%s 插入后的光标",
  (type) => {
    it("文末插入后可直接在下一段输入，且可一次撤销", () => {
      const editor = createEditor("<p>原有内容</p>");
      editor.commands.setTextSelection("end");
      const media = editor.schema.nodes[type].create({ src: "test-resource" });
      expect(insertMedia(editor.view, media)).toBe(true);
      expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
      expect(editor.state.selection.$from.parent.content.size).toBe(0);
      expect(editor.state.doc.nodeAt(editor.state.selection.from - 2)).toBe(media);
      editor.commands.undo();
      expect(editor.getHTML()).toBe("<p>原有内容</p>");
    });

    it("复用媒体下方已有的空段落，不重复添加空行", () => {
      const editor = createEditor("<p>前文</p><p></p><p>后文</p>");
      const position = editor.state.doc.firstChild!.nodeSize;
      const media = editor.schema.nodes[type].create({ src: "test-resource" });
      insertMedia(editor.view, media, position);
      expect(editor.state.doc.childCount).toBe(4);
      expect(editor.state.selection.$from.index(0)).toBe(2);
      editor.commands.insertContent("继续编写");
      expect(editor.state.doc.child(2).textContent).toBe("继续编写");
      expect(editor.state.doc.lastChild!.textContent).toBe("后文");
    });

    it("后方已有正文时插入空段落，保留原文", () => {
      const editor = createEditor("<p>前文</p><p>后文</p>");
      const position = editor.state.doc.firstChild!.nodeSize;
      insertMedia(
        editor.view,
        editor.schema.nodes[type].create({ src: "test-resource" }),
        position,
      );
      expect(editor.state.doc.childCount).toBe(4);
      expect(editor.state.selection.$from.parent.content.size).toBe(0);
      editor.commands.insertContent("继续编写");
      expect(editor.state.doc.child(2).textContent).toBe("继续编写");
      expect(editor.state.doc.lastChild!.textContent).toBe("后文");
    });

    it("连续插入时光标始终在最后一个媒体之后，不产生中间空行", () => {
      const editor = createEditor("<p></p>");
      insertMedia(editor.view, editor.schema.nodes[type].create({ src: "first-resource" }));
      insertMedia(editor.view, editor.schema.nodes[type].create({ src: "second-resource" }));
      expect(editor.state.doc.childCount).toBe(3);
      expect(editor.state.doc.child(0).attrs.src).toBe("first-resource");
      expect(editor.state.doc.child(1).attrs.src).toBe("second-resource");
      editor.commands.insertContent("继续编写");
      expect(editor.state.doc.child(2).textContent).toBe("继续编写");
    });

    it("在段落中插入时保留前后文本，后续换链不移动光标", () => {
      const editor = createEditor("<p>前文后文</p>");
      insertMedia(editor.view, editor.schema.nodes[type].create({ src: "test-resource" }), 3);
      expect(editor.state.doc.firstChild!.textContent).toBe("前文");
      expect(editor.state.doc.lastChild!.textContent).toBe("后文");
      editor.commands.insertContent("继续编写");
      const selection = editor.state.selection.from;
      const mediaPosition = editor.state.doc.firstChild!.nodeSize;
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(mediaPosition, undefined, { src: "uploaded-resource" }),
      );
      expect(editor.state.selection.from).toBe(selection);
      expect(editor.state.selection.$from.parent.textContent).toBe("继续编写");
    });
  },
);

it("视频公开命令支持链式调用，can 检查不修改文档", () => {
  const editor = createEditor("<p></p>");
  const original = editor.getJSON();
  const can = editor.can() as { insertVideo: (options: { src: string }) => boolean };
  const chain = editor.chain() as ReturnType<Editor["chain"]> & {
    insertVideo: (options: { src: string }) => ReturnType<Editor["chain"]>;
  };
  expect(can.insertVideo({ src: "test.mp4" })).toBe(true);
  expect(editor.getJSON()).toEqual(original);
  expect(chain.insertVideo({ src: "test.mp4" }).insertContent("视频后正文").run()).toBe(true);
  expect(editor.state.doc.firstChild!.type.name).toBe("videoEmbed");
  expect(editor.state.doc.lastChild!.textContent).toBe("视频后正文");
});
