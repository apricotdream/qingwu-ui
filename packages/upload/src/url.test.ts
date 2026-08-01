import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ImageUpload } from "./upload";

/** 构造带真实文件头签名的图片 Blob */
function imageBlob(kind: "png" | "jpeg" | "gif" | "webp" | "avif" | "svg" | "bmp"): Blob {
  switch (kind) {
    case "png":
      return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])]);
    case "jpeg":
      return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])]);
    case "gif":
      return new Blob(["GIF89a", new Uint8Array([0, 0, 0, 0])]);
    case "webp":
      return new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])]);
    case "avif":
      return new Blob([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])]);
    case "svg":
      return new Blob(['<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>']);
    case "bmp":
      return new Blob([new Uint8Array([0x42, 0x4d, 0, 0, 0, 0])]);
  }
}

/** 生成带指定签名的响应 */
function imageResponse(blob: Blob, status = 200, headers?: Record<string, string>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers ?? {}),
    blob: async () => blob,
  } as unknown as Response;
}

type FetchCalls = { method: string; url: string }[];

/** 轮询等待条件成立（批量导入为异步火发，避免固定 sleep 的时序抖动） */
async function waitFor(cond: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor 超时");
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** stub 全局 fetch，返回调用记录；handler 按需返回响应 */
function stubFetch(
  handler: (method: string, url: string) => Promise<Response>,
): FetchCalls {
  const calls: FetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ method, url });
      return handler(method, url);
    }),
  );
  return calls;
}

describe("URL 导入", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("https 图片导入成功：识别格式、文件名、溯源标记", async () => {
    const calls = stubFetch(async (method) =>
      method === "HEAD"
        ? imageResponse(imageBlob("png"))
        : imageResponse(imageBlob("png")),
    );
    const uploader = new ImageUpload(root, { compress: false });

    const item = await uploader.addFromUrl("https://cdn.example.com/img/photo.png?v=2");

    expect(item).not.toBeNull();
    expect(item!.status).toBe("success");
    expect(item!.name).toBe("photo.png");
    expect(item!.mime).toBe("image/png");
    expect(item!.source).toBe("url");
    expect(item!.originalUrl).toBe("https://cdn.example.com/img/photo.png?v=2");
    // HEAD 预检 + GET 下载
    expect(calls.map((c) => c.method)).toEqual(["HEAD", "GET"]);
    uploader.destroy();
  });

  test("各格式 magic bytes 识别", async () => {
    const cases: [string, "gif" | "webp" | "avif" | "svg" | "bmp", string][] = [
      ["https://a.com/a.gif", "gif", "image/gif"],
      ["https://a.com/a.webp", "webp", "image/webp"],
      ["https://a.com/a.avif", "avif", "image/avif"],
      ["https://a.com/a.svg", "svg", "image/svg+xml"],
      ["https://a.com/a.bmp", "bmp", "image/bmp"],
    ];
    for (const [url, kind, expectMime] of cases) {
      stubFetch(async (method) => imageResponse(imageBlob(kind)));
      const uploader = new ImageUpload(root, { compress: false });
      const item = await uploader.addFromUrl(url);
      expect(item!.mime, url).toBe(expectMime);
      uploader.destroy();
      vi.unstubAllGlobals();
    }
  });

  test("HEAD 预检 Content-Length 超限 → 拒绝且不发起 GET", async () => {
    const calls = stubFetch(async (method) => {
      if (method === "HEAD") return imageResponse(imageBlob("png"), 200, { "content-length": String(20 * 1024 * 1024) });
      throw new Error("不应发起 GET");
    });
    const uploader = new ImageUpload(root, { compress: false, maxSizeMB: 10 });

    const item = await uploader.addFromUrl("https://a.com/big.png");

    expect(item).toBeNull();
    expect(uploader.getItems()).toHaveLength(1);
    expect(uploader.getItems()[0]!.status).toBe("error");
    expect(uploader.getItems()[0]!.error).toContain("大小上限");
    expect(calls).toHaveLength(1);
    uploader.destroy();
  });

  test("HEAD 失败（405）→ 降级 GET 正常导入", async () => {
    const calls = stubFetch(async (method) => {
      if (method === "HEAD") throw new TypeError("Failed to fetch");
      return imageResponse(imageBlob("png"));
    });
    const uploader = new ImageUpload(root, { compress: false });

    const item = await uploader.addFromUrl("https://a.com/a.png");

    expect(item).not.toBeNull();
    expect(item!.status).toBe("success");
    expect(calls.map((c) => c.method)).toEqual(["HEAD", "GET"]);
    uploader.destroy();
  });

  test("GET 失败（404）→ error 条目，addFromUrl 返回 null", async () => {
    stubFetch(async (method) => {
      if (method === "HEAD") return imageResponse(imageBlob("png"));
      return imageResponse(imageBlob("png"), 404);
    });
    const uploader = new ImageUpload(root, { compress: false });

    const item = await uploader.addFromUrl("https://a.com/missing.png");

    expect(item).toBeNull();
    expect(uploader.getItems()[0]!.error).toBe("HTTP 404");
    uploader.destroy();
  });

  test("CORS 失败 → error 条目提示跨域", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const uploader = new ImageUpload(root, { compress: false });

    const item = await uploader.addFromUrl("https://a.com/a.png");

    expect(item).toBeNull();
    expect(uploader.getItems()[0]!.error).toBe("跨域或网络错误");
    uploader.destroy();
  });

  test("非图片内容 → 无法识别为图片", async () => {
    stubFetch(async (method) =>
      method === "HEAD"
        ? imageResponse(new Blob(["hello"]))
        : imageResponse(new Blob(["hello world"])),
    );
    const uploader = new ImageUpload(root, { compress: false });

    const item = await uploader.addFromUrl("https://a.com/note.txt");

    expect(item).toBeNull();
    expect(uploader.getItems()[0]!.error).toBe("无法识别为图片");
    uploader.destroy();
  });

  test("scheme 白名单：javascript:/file: 拒绝，data: 放行", async () => {
    const calls = stubFetch(async (method) =>
      method === "HEAD" ? imageResponse(imageBlob("png")) : imageResponse(imageBlob("png")),
    );
    const uploader = new ImageUpload(root, { compress: false });

    const js = await uploader.addFromUrl("javascript:alert(1)");
    expect(js).toBeNull();
    expect(uploader.getItems()[0]!.error).toBe("不支持 javascript: 协议");

    const file = await uploader.addFromUrl("file:///C:/img.png");
    expect(file).toBeNull();
    expect(uploader.getItems()[1]!.error).toBe("不支持 file: 协议");

    // data: URL 跳过 HEAD 预检，直接 GET 解析
    const dataUrl =
      "data:image/png;base64," + btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
    const item = await uploader.addFromUrl(dataUrl);
    expect(item).not.toBeNull();
    expect(item!.name).toBe("url-image.png");
    expect(item!.mime).toBe("image/png");
    expect(calls.every((c) => c.method !== "HEAD")).toBe(true);
    uploader.destroy();
  });

  test("supportedFormats 白名单拒绝识别结果不符的图片", async () => {
    stubFetch(async (method) => imageResponse(imageBlob("jpeg")));
    const uploader = new ImageUpload(root, { compress: false, supportedFormats: ["png"] });

    const item = await uploader.addFromUrl("https://a.com/a.jpg");

    expect(item).toBeNull();
    expect(uploader.getItems()[0]!.error).toBe("不支持 image/jpeg");
    uploader.destroy();
  });

  test("无扩展名 URL → 回退文件名 url-image.<ext>", async () => {
    stubFetch(async (method) => imageResponse(imageBlob("png")));
    const uploader = new ImageUpload(root, { compress: false });

    const item = await uploader.addFromUrl("https://a.com/image?id=1");

    expect(item!.name).toBe("url-image.png");
    uploader.destroy();
  });

  test("maxCount 对 URL 导入生效", async () => {
    stubFetch(async (method) => imageResponse(imageBlob("png")));
    const uploader = new ImageUpload(root, { compress: false, maxCount: 1 });

    const item = await uploader.addFromUrl("https://a.com/first.png");
    expect(item).not.toBeNull();

    const second = await uploader.addFromUrl("https://a.com/second.png");
    expect(second).toBeNull();
    expect(uploader.getItems()[1]!.error).toBe("已达数量上限");
    uploader.destroy();
  });

  test("error 条目可删除", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const uploader = new ImageUpload(root, { compress: false });

    await uploader.addFromUrl("https://a.com/a.png");
    expect(uploader.getItems()).toHaveLength(1);
    const id = uploader.getItems()[0]!.id;
    uploader.remove(id);
    expect(uploader.getItems()).toHaveLength(0);
    uploader.destroy();
  });

  test("UI：多行批量导入 + 部分失败提示 + 面板关闭", async () => {
    stubFetch(async (method, url) => {
      if (url.includes("bad")) throw new TypeError("Failed to fetch");
      return imageResponse(imageBlob("png"));
    });
    const uploader = new ImageUpload(root, { compress: false });

    const panel = root.querySelector<HTMLElement>(".qw-upload-urlpanel")!;
    expect(panel.hidden).toBe(true);
    (root.querySelector<HTMLElement>(".qw-upload-urlbtn")!).click();
    expect(panel.hidden).toBe(false);

    const input = root.querySelector<HTMLTextAreaElement>(".qw-upload-urlinput")!;
    input.value = "https://a.com/good.png\nhttps://a.com/bad.png";
    (root.querySelector<HTMLButtonElement>(".qw-upload-urlgo")!).click();

    // 等待批量导入完成（成功项 + 失败项）
    await waitFor(() => uploader.getItems().length === 2);
    expect(uploader.getItems()).toHaveLength(2);
    expect(uploader.getItems().filter((i) => i.status === "success")).toHaveLength(1);
    expect(uploader.getItems().filter((i) => i.status === "error")).toHaveLength(1);
    // 导入完成后面板关闭且输入框清空
    expect(panel.hidden).toBe(true);
    expect(input.value).toBe("");
    uploader.destroy();
  });

  test("urlImport: false 时无 URL 导入入口", () => {
    const uploader = new ImageUpload(root, { compress: false, urlImport: false });
    expect(root.querySelector(".qw-upload-urlbar")).toBeNull();
    uploader.destroy();
  });

  test("无扩展名 SVG 识别为 svg+xml 并跳过压缩（原图上传）", async () => {
    stubFetch(async (method) => imageResponse(imageBlob("svg")));
    const uploader = new ImageUpload(root, { compress: true, formats: ["webp"] });

    const item = await uploader.addFromUrl("https://a.com/vector");

    expect(item).not.toBeNull();
    expect(item!.mime).toBe("image/svg+xml");
    uploader.destroy();
  });
});
