import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startBrowserClipperReceiver } from "../src/editor/clipper/receiver";

/**
 * 浏览器 Web Clipper 接收器（postMessage 通道）联动测试
 *
 * 验证：插件通过 chrome.tabs.create + 注入脚本 postMessage 推送剪藏内容，
 * 编辑器页面能正确接收并调用 onClip 回调把 markdown 写入编辑器。
 */
describe("startBrowserClipperReceiver", () => {
  const postClip = (clip: object, kind = "qingwu-clip") =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { kind, clip },
        origin: window.location.origin,
        source: window,
      }),
    );
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
    postClip(clip);

    await vi.waitFor(() => expect(onClip).toHaveBeenCalledTimes(1));
    expect(onClip).toHaveBeenCalledWith(
      expect.objectContaining({ markdown: "# 标题\n\n正文内容" }),
      expect.anything(),
    );
  });

  it("忽略 kind 不匹配的消息", async () => {
    const onClip = vi.fn();
    receiver = startBrowserClipperReceiver({ onClip });

    postClip({ markdown: "x" }, "other-message");
    await new Promise((r) => setTimeout(r, 50));
    expect(onClip).not.toHaveBeenCalled();
  });

  it("忽略无 markdown 的 payload", async () => {
    const onClip = vi.fn();
    receiver = startBrowserClipperReceiver({ onClip });

    postClip({ title: "无内容" });
    await new Promise((r) => setTimeout(r, 50));
    expect(onClip).not.toHaveBeenCalled();
  });

  it("onClip 抛错时不影响后续消息（错误被吞掉）", async () => {
    const onClip = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    receiver = startBrowserClipperReceiver({ onClip });

    postClip({ markdown: "first" });
    await vi.waitFor(() => expect(onClip).toHaveBeenCalledTimes(1));

    // 第二条应该照常处理
    postClip({ markdown: "second" });
    await vi.waitFor(() => expect(onClip).toHaveBeenCalledTimes(2));
    expect(console.warn).toHaveBeenCalled();
  });

  it("close 后不再接收消息", async () => {
    const onClip = vi.fn();
    receiver = startBrowserClipperReceiver({ onClip });
    receiver.close();
    receiver = undefined;

    postClip({ markdown: "x" });
    await new Promise((r) => setTimeout(r, 50));
    expect(onClip).not.toHaveBeenCalled();
  });

  it.each(["null", "", "https://foreign.example"])("拒绝不可信来源 %s", (origin) => {
    const onClip = vi.fn();
    receiver = startBrowserClipperReceiver({ onClip });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin,
        source: window,
        data: { kind: "qingwu-clip", clip: { markdown: "恶意推送" } },
      }),
    );
    expect(onClip).not.toHaveBeenCalled();
  });

  it("拒绝同源子窗口冒充当前页面的扩展消息", () => {
    const onClip = vi.fn();
    receiver = startBrowserClipperReceiver({ onClip });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        source: {} as Window,
        data: { kind: "qingwu-clip", clip: { markdown: "恶意推送" } },
      }),
    );
    expect(onClip).not.toHaveBeenCalled();
  });

  it.each([1, {}, ["text"]])("拒绝 markdown 非字符串的消息", (markdown) => {
    const onClip = vi.fn();
    receiver = startBrowserClipperReceiver({ onClip });
    postClip({ markdown });
    expect(onClip).not.toHaveBeenCalled();
  });
});
