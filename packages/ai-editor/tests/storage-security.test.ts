// @vitest-environment node
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createS3Storage } from "../src/editor/storage/providers/s3";
import { registerS3PreviewConfig, signPreviewUrl } from "../src/editor/storage/signed-fetch";

const config = {
  endpoint: "https://storage.example.com",
  bucket: "documents",
  region: "test",
  accessKeyId: "test-key",
  secretAccessKey: "test-secret",
};

afterEach(() => {
  registerS3PreviewConfig(null);
  vi.unstubAllGlobals();
});

describe("云端资源边界", () => {
  it.each([
    "https://foreign.example/documents/file.png",
    "https://storage.example.com/other/file.png",
    "https://storage.example.com/documents/../other/file.png",
    "http://storage.example.com/documents/file.png",
    "file.png",
  ])("外部地址不能被转换成当前桶的删除请求：%s", async (url) => {
    vi.stubGlobal("crypto", webcrypto);
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    await createS3Storage(config).remove(url);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("合法资源的预签名参数不会混入删除对象名", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    await createS3Storage(config).remove(
      "https://storage.example.com/documents/qingwu/file.png?signature=test",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://storage.example.com/documents/qingwu/file.png",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it.each([
    "http://storage.example.com/documents/file.png",
    "https://storage.example.com/other/file.png",
  ])("不为配置范围以外的地址签名：%s", async (url) => {
    vi.stubGlobal("crypto", webcrypto);
    registerS3PreviewConfig(config);
    expect(await signPreviewUrl(url)).toBeNull();
  });
});
