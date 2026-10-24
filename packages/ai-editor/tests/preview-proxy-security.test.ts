// @vitest-environment node
import dns from "node:dns/promises";
import { EventEmitter } from "node:events";
import http, { type ClientRequest, type IncomingMessage, type RequestOptions } from "node:http";
import https from "node:https";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPublicIp, previewResource, resolvePublicTarget } from "../tooling/preview-proxy";

vi.mock("node:dns/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:dns/promises")>();
  const lookup = vi.fn();
  return { ...original, lookup, default: { ...original.default, lookup } };
});
vi.mock("node:http", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:http")>();
  const get = vi.fn();
  return { ...original, get, default: { ...original.default, get } };
});
vi.mock("node:https", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:https")>();
  const get = vi.fn();
  return { ...original, get, default: { ...original.default, get } };
});
afterEach(() => vi.resetAllMocks());
const encoded = (url: string) => Buffer.from(encodeURIComponent(url)).toString("base64url");

describe("预览代理 SSRF 与响应隔离", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "100.100.100.200",
    "169.254.169.254",
    "192.168.1.1",
    "172.16.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:a00:1",
    "fc12::1",
    "fd00::1",
    "fe81::1",
    "2002:7f00:1::",
    "224.0.0.1",
    "240.1.1.1",
  ])("拒绝私有、保留及映射地址 %s", (ip) => expect(isPublicIp(ip)).toBe(false));
  it.each(["8.8.8.8", "1.1.1.1", "2001:4860:4860::8888", "2606:4700:4700::1111"])(
    "接受正常公网地址 %s",
    (ip) => expect(isPublicIp(ip)).toBe(true),
  );
  it.each([
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://2130706433/",
    "file:///secret",
    "http://user:password@8.8.8.8/",
  ])("危险 URL 在联网前被拒绝：%s", async (url) => {
    const request = vi.mocked(http.get);
    expect((await previewResource(encoded(url))).status).toBe(403);
    expect(request).not.toHaveBeenCalled();
  });
  it("DNS 同时包含公网和私网地址时拒绝", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ] as never);
    await expect(resolvePublicTarget("https://files.example/test")).rejects.toThrow(
      "Forbidden address",
    );
  });
  it("连接固定到已验证的 IP，响应带隔离头，保持文件字节不变", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "8.8.8.8", family: 4 }] as never);
    const upstream = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: { "content-type": "text/html" },
    });
    let pinnedLookup: RequestOptions["lookup"];
    vi.mocked(https.get).mockImplementation((_url, options, callback) => {
      pinnedLookup = options.lookup;
      callback?.(upstream as unknown as IncomingMessage);
      queueMicrotask(() => upstream.end("<html>file bytes</html>"));
      return new EventEmitter() as unknown as ClientRequest;
    });
    const response = await previewResource(encoded("https://files.example/test"));
    expect(response.status).toBe(200);
    if (!pinnedLookup) throw new Error("缺少固定 IP 的 DNS 解析函数");
    const lookup = pinnedLookup;
    await new Promise<void>((resolve) =>
      lookup("files.example", {}, (error: unknown, address: string, family: number) => {
        expect(error).toBeNull();
        expect(address).toBe("8.8.8.8");
        expect(family).toBe(4);
        resolve();
      }),
    );
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(response.headers.get("Content-Disposition")).toBe("attachment");
    expect(await response.text()).toBe("<html>file bytes</html>");
    expect(dns.lookup).toHaveBeenCalledTimes(1);
  });
  it("不跟随上游到内网地址的重定向", async () => {
    const upstream = Object.assign(new PassThrough(), {
      statusCode: 302,
      headers: { location: "http://127.0.0.1/secret" },
    });
    vi.mocked(http.get).mockImplementation((_url, _options, callback) => {
      callback?.(upstream as unknown as IncomingMessage);
      return new EventEmitter() as unknown as ClientRequest;
    });
    expect((await previewResource(encoded("http://8.8.8.8/redirect"))).status).toBe(403);
    expect(http.get).toHaveBeenCalledOnce();
  });
});
