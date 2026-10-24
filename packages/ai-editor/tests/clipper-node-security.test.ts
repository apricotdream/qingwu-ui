// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startClipperReceiver } from "../src/editor/clipper/receiver-node";
import type { ClipperReceiver } from "../src/editor/clipper/types";

let receiver: ClipperReceiver;
const onClip = vi.fn();
beforeEach(async () => {
  onClip.mockReset();
  receiver = await startClipperReceiver({ port: 0, onClip });
});
afterEach(async () => {
  await receiver.close();
});

function send(body: string, headers: Record<string, string> = {}) {
  return fetch(`${receiver.url}/clip`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("本地剪藏 HTTP 安全边界", () => {
  it("合法原生 JSON 请求正常处理", async () => {
    expect((await send(JSON.stringify({ markdown: "# 正文" }))).status).toBe(200);
    expect(onClip).toHaveBeenCalledOnce();
  });
  it.each(["https://foreign.example", "null"])("拒绝不可信网页 %s", async (origin) => {
    const response = await send('{"markdown":"test"}', { Origin: origin });
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(onClip).not.toHaveBeenCalled();
  });
  it("拒绝可由网页直接发起的 text/plain 请求", async () => {
    expect((await send('{"markdown":"test"}', { "Content-Type": "text/plain" })).status).toBe(415);
    expect(onClip).not.toHaveBeenCalled();
  });
  it.each(["null", "{}", '{"markdown":1}', '{"markdown":{}}'])(
    "无效 JSON 结构不会使服务崩溃：%s",
    async (body) => {
      expect((await send(body)).status).toBe(422);
      expect((await send('{"markdown":"正常"}')).status).toBe(200);
    },
  );
  it("限制请求体大小", async () => {
    expect((await send(JSON.stringify({ markdown: "x".repeat(10 * 1024 * 1024) }))).status).toBe(
      413,
    );
    expect(onClip).not.toHaveBeenCalled();
  });
  it("显式允许的宿主来源可正常推送", async () => {
    await receiver.close();
    receiver = await startClipperReceiver({
      port: 0,
      onClip,
      allowedOrigins: ["https://trusted.example"],
    });
    const response = await send('{"markdown":"test"}', { Origin: "https://trusted.example" });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://trusted.example");
  });
});
