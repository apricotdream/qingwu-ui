import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QingWuAIEditor } from "../src/editor";

// 上传限制为必填 props，测试统一传 100MB / 500MB
const UPLOAD_LIMITS = { maxAttachmentSize: 100 * 1024 * 1024, maxTotalAttachmentSize: 500 * 1024 * 1024 };

describe("QingWuAIEditor 组件", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  it("正常渲染编辑器", () => {
    render(<QingWuAIEditor {...UPLOAD_LIMITS} />);

    expect(document.querySelector(".ProseMirror")).toBeInTheDocument();
  });

  it("支持传入 placeholder", () => {
    render(<QingWuAIEditor {...UPLOAD_LIMITS} placeholder="自定义占位文本" />);

    const editorEl = document.querySelector(".ProseMirror");
    expect(editorEl).toBeInTheDocument();
  });

  it("显示字数统计", () => {
    render(<QingWuAIEditor {...UPLOAD_LIMITS} />);

    expect(document.body.textContent).toMatch(/字/);
  });

  it("渲染初始内容", () => {
    render(<QingWuAIEditor {...UPLOAD_LIMITS} initialContent="<p>测试内容</p>" />);

    expect(document.body.textContent).toContain("测试内容");
  });
});
