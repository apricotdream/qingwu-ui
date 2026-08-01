import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QingWuEditor } from "../src/editor";

const CODE_BLOCK_HTML = '<pre><code class="language-ts">const value = 1</code></pre>';

// 上传限制为必填 props，测试统一传 100MB / 500MB
const UPLOAD_LIMITS = { maxAttachmentSize: 100 * 1024 * 1024, maxTotalAttachmentSize: 500 * 1024 * 1024 };

function getCodeBlockEnd(editor: Editor) {
  let codeBlockEnd = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") {
      codeBlockEnd = pos + node.nodeSize - 1;
      return false;
    }
  });
  return codeBlockEnd;
}

describe("代码块视图", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("代码内容区鼠标事件应交给 ProseMirror 同步光标", async () => {
    const onDocumentMouseDown = vi.fn();
    const originalElementFromPoint = document.elementFromPoint;
    document.addEventListener("mousedown", onDocumentMouseDown);

    try {
      render(<QingWuEditor {...UPLOAD_LIMITS} initialContent={CODE_BLOCK_HTML} />);

      await waitFor(() => expect(document.querySelector(".cb-code-pre code")).toBeInTheDocument());
      const codeContent = document.querySelector(".cb-code-pre code");
      expect(codeContent).toBeInTheDocument();
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: vi.fn(() => codeContent),
      });

      fireEvent.mouseDown(codeContent!);

      expect(onDocumentMouseDown).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });

  it("代码块工具栏鼠标事件仍不冒泡到编辑器外层", async () => {
    const onDocumentMouseDown = vi.fn();
    document.addEventListener("mousedown", onDocumentMouseDown);

    try {
      render(<QingWuEditor {...UPLOAD_LIMITS} initialContent={CODE_BLOCK_HTML} />);

      await waitFor(() => expect(document.querySelector(".cb-header")).toBeInTheDocument());
      const header = document.querySelector(".cb-header");
      expect(header).toBeInTheDocument();

      fireEvent.mouseDown(header!);

      expect(onDocumentMouseDown).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("mousedown", onDocumentMouseDown);
    }
  });

  it("点击删除控件并确认后移除代码块", async () => {
    let editor: Editor | null = null;

    render(
      <QingWuEditor
        {...UPLOAD_LIMITS}
        initialContent={`<p>before</p>${CODE_BLOCK_HTML}<p>after</p>`}
        onEditorReady={(instance) => {
          editor = instance;
        }}
      />,
    );

    await waitFor(() => expect(editor).not.toBeNull());
    await waitFor(() => expect(document.querySelector(".cb-btn--del")).toBeInTheDocument());

    fireEvent.click(document.querySelector(".cb-btn--del")!);

    const confirmButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.className.includes("bg-red-500"),
    );
    expect(confirmButton).toBeInTheDocument();

    fireEvent.click(confirmButton!);

    await waitFor(() => expect(editor?.getHTML()).not.toContain("const value = 1"));
    expect(document.querySelector(".cb-code-pre code")).not.toBeInTheDocument();
  });

  it("代码块输入不触发首页无用 setTimeout 慢任务", async () => {
    let editor: Editor | null = null;
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    });

    render(
      <QingWuEditor
        {...UPLOAD_LIMITS}
        initialContent={`<h1>标题</h1>${CODE_BLOCK_HTML}`}
        onEditorReady={(instance) => {
          editor = instance;
        }}
      />,
    );

    await waitFor(() => expect(editor).not.toBeNull());
    await waitFor(() => expect(document.querySelector(".toc-item")).toBeInTheDocument());

    act(() => {
      editor?.commands.setTextSelection(getCodeBlockEnd(editor!));
    });

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    act(() => {
      editor?.commands.insertContent("x");
    });

    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 300)).toBe(false);

    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: originalIntersectionObserver,
    });
  });
});
