import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatBytes,
  getDocAttachmentTotal,
  validateAttachmentFile,
} from "../src/editor/attachment-limits";
import { QingWuAIEditor } from "../src/editor";

const MB = 1024 * 1024;
const LIMITS = { maxAttachmentSize: 10 * MB, maxTotalAttachmentSize: 30 * MB };
const UPLOAD_LIMITS = { maxAttachmentSize: 100 * MB, maxTotalAttachmentSize: 500 * MB };

/** 仅用校验所需字段构造 File（无需真实文件内容） */
function fakeFile(size: number, name = "test.bin"): File {
  return { size, name, type: "" } as File;
}

async function getEditor(): Promise<Editor> {
  let editor: Editor | null = null;
  render(<QingWuAIEditor {...UPLOAD_LIMITS} onEditorReady={(instance) => (editor = instance)} />);
  await vi.waitFor(() => expect(editor).not.toBeNull());
  return editor as Editor;
}

/** 在文档末尾插入节点（与真实上传路径一致：tr.insert，而非替换选区的 insertContent） */
function insertNode(editor: Editor, node: ReturnType<Editor["schema"]["nodes"]["paragraph"]["create"]>) {
  act(() => {
    const pos = editor.state.doc.content.size;
    editor.view.dispatch(editor.state.tr.insert(pos, node));
  });
}

describe("formatBytes", () => {
  it("格式化字节数为可读文本", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10 * MB)).toBe("10 MB");
    expect(formatBytes(1024 ** 3)).toBe("1 GB");
  });
});

describe("getDocAttachmentTotal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("统计 attachment/video/audio/image 节点的 size 之和", async () => {
    const editor = await getEditor();
    const { attachmentEmbed, videoEmbed, audioEmbed, image } = editor.schema.nodes;

    insertNode(editor, attachmentEmbed.create({ src: "blob:a", name: "a", size: 1 * MB, type: "" }));
    insertNode(editor, videoEmbed.create({ src: "blob:v", source: "direct", name: "v", size: 2 * MB }));
    insertNode(editor, audioEmbed.create({ src: "blob:o", name: "o", size: 3 * MB }));
    insertNode(editor, image.create({ src: "blob:i", alt: "i", size: 4 * MB }));

    expect(getDocAttachmentTotal(editor.state.doc)).toBe(10 * MB);
  });
});

describe("validateAttachmentFile", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("单文件与总大小均未超限时通过", async () => {
    const editor = await getEditor();
    expect(validateAttachmentFile(editor.state.doc, fakeFile(5 * MB), LIMITS)).toBeNull();
  });

  it("单文件超限 → 报单文件错误（先查单文件）", async () => {
    const editor = await getEditor();
    expect(validateAttachmentFile(editor.state.doc, fakeFile(12 * MB), LIMITS)).toMatch(/单文件/);
  });

  it("单文件与总大小同时超限 → 只报单文件错误，不合并", async () => {
    const editor = await getEditor();
    // 60MB 既超单文件 10MB，也超总大小 30MB
    expect(validateAttachmentFile(editor.state.doc, fakeFile(60 * MB), LIMITS)).toMatch(/单文件/);
    expect(validateAttachmentFile(editor.state.doc, fakeFile(60 * MB), LIMITS)).not.toMatch(/总大小/);
  });

  it("总大小超限（单文件未超）→ 报总大小错误", async () => {
    const editor = await getEditor();
    const { attachmentEmbed } = editor.schema.nodes;
    // 文档已有 21MB 附件
    insertNode(
      editor,
      attachmentEmbed.create({ src: "blob:a", name: "a", size: 21 * MB, type: "" }),
    );

    // 21 + 9 = 30 ≤ 30 → 通过
    expect(validateAttachmentFile(editor.state.doc, fakeFile(9 * MB), LIMITS)).toBeNull();
    // 21 + 10 = 31 > 30，且单文件 10MB 未超 → 总大小错误
    expect(validateAttachmentFile(editor.state.doc, fakeFile(10 * MB), LIMITS)).toMatch(/总大小/);
  });

  it("限制为 0 时不限制", async () => {
    const editor = await getEditor();
    expect(
      validateAttachmentFile(editor.state.doc, fakeFile(999 * MB), {
        maxAttachmentSize: 0,
        maxTotalAttachmentSize: 0,
      }),
    ).toBeNull();
  });
});
