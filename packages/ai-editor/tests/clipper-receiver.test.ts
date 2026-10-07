import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startBrowserClipperReceiver } from "../src/editor/clipper/receiver";

/**
 * 浏览器 Web Clipper 接收器（postMessage 通道）联动测试
 *
 * 验证：插件通过 chrome.tabs.create + 注入脚本 postMessage 推送剪藏内容，
 * 编辑器页面能正确接收并调用 onClip 回调把 markdown 写入编辑器。
 */
describe("startBrowserClipperReceiver", () => {
  let receiver: ReturnType<typeof startBrowserClipperReceiver> | undefined;

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    receiver?.close();
    receiver = undefined;
    vi.restoreAllMocks();
  });

  it("收到合法 clip 消息时调用 onClip，传入 markdown", async () => {
    const onClip = vi.fn().mockResolvedValue(undefined);
    receiver = startBrowserClipperReceiver({ onClip });

    const clip = {
      title: "测试文章",
      markdown: "# 标题\n\n正文内容",
      sourceUrl: "https://example.com/a",
    };
    window.postMessage({ kind: "qingwu-clip", clip }, "*");

    await vi.waitFor(() => expect(onClip).toHaveBeenCalledTimes(1));
    expect(onClip).toHaveBeenCalledWith(
      expect.objectContaining({ markdown: "# 标题\n\n正文内容" }),
      expect.anything(),
    );
  });

  it("忽略 kind 不匹配的消息", async () => {
    const onClip = vi.fn();
    receiver = startBrowserClipperReceiver({ onClip });

    window.postMessage({ kind: "other-message", clip: { markdown: "x" } }, "*");
    await new Promise((r) => setTimeout(r, 50));
    expect(onClip).not.toHaveBeenCalled();
  });

  it("忽略无 markdown 的 payload", async () => {
    const onClip = vi.fn();
    receiver = startBrowserClipperReceiver({ onClip });

    window.postMessage({ kind: "qingwu-clip", clip: { title: "无内容" } }, "*");
    await new Promise((r) => setTimeout(r, 50));
    expect(onClip).not.toHaveBeenCalled();
  });

  it("onClip 抛错时不影响后续消息（错误被吞掉）", async () => {
    const onClip = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    receiver = startBrowserClipperReceiver({ onClip });

    window.postMessage({ kind: "qingwu-clip", clip: { markdown: "first" } }, "*");
    await vi.waitFor(() => expect(onClip).toHaveBeenCalledTimes(1));

    // 第二条应该照常处理
    window.postMessage({ kind: "qingwu-clip", clip: { markdown: "second" } }, "*");
    await vi.waitFor(() => expect(onClip).toHaveBeenCalledTimes(2));
    expect(console.warn).toHaveBeenCalled();
  });

  it("close 后不再接收消息", async () => {
    const onClip = vi.fn();
    receiver = startBrowserClipperReceiver({ onClip });
    receiver.close();
    receiver = undefined;

    window.postMessage({ kind: "qingwu-clip", clip: { markdown: "x" } }, "*");
    await new Promise((r) => setTimeout(r, 50));
    expect(onClip).not.toHaveBeenCalled();
  });
});
