import { Blob as NodeBlob } from "node:buffer";
import { Editor } from "@tiptap/core";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";
import * as signedFetch from "../src/editor/storage/signed-fetch";
import {
  createMarkdownDownload,
  createPrintHtml,
  getExportContent,
  waitForPrintImages,
} from "../src/editor/utils/document-export";

const IMAGE_URL = "https://resources.example/image.png";
const FILE_URL = "https://resources.example/report.pdf";
const DATA_IMAGE = "data:image/png;base64,aW1hZ2U=";
let editor: Editor;
const fetchResource = vi.fn();

function createEditor(content: string | object) {
  editor = new Editor({ extensions: getEditorExtensions(), content });
  return editor;
}

function mediaContent(image = IMAGE_URL, file = FILE_URL) {
  return `<h1>导出测试</h1><p>正文和 <strong>格式</strong></p><img src="${image}" alt="示意图.png"><div data-attachment-embed data-src="${file}" data-name="报告.pdf"><a href="${file}" download="报告.pdf">报告.pdf</a></div><p>结尾</p>`;
}

beforeEach(() => {
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("fetch", fetchResource);
  fetchResource.mockImplementation(
    async (src: string) =>
      new Response(src.includes("pdf") ? "pdf-bytes" : "image-bytes", {
        headers: { "content-type": src.includes("pdf") ? "application/pdf" : "image/png" },
      }),
  );
});

afterEach(() => {
  editor?.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fetchResource.mockReset();
});

describe("Markdown 资源打包", () => {
  it("无资源时直接下载 Markdown", async () => {
    createEditor("<h1>标题</h1><p>正文</p>");
    const result = await createMarkdownDownload(editor);
    expect(result.filename).toBe("qingwu-doc.md");
    expect(await result.blob.text()).toContain("# 标题");
    expect(fetchResource).not.toHaveBeenCalled();
  });

  it("ZIP 内含 Markdown、图片和附件，并使用能解析到文件的相对路径", async () => {
    createEditor(mediaContent());
    editor.commands.setTextSelection(3);
    const before = editor.getJSON();
    const result = await createMarkdownDownload(editor);
    expect(result.filename).toBe("qingwu-doc.zip");
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const markdown = await zip.file("qingwu-doc.md")!.async("string");
    const references = [...markdown.matchAll(/\]\(([^)]+)\)/g)].map((match) => decodeURI(match[1]));
    expect(references).toEqual(["assets/1-示意图.png", "assets/2-报告.pdf"]);
    expect(await zip.file(references[0])!.async("string")).toBe("image-bytes");
    expect(await zip.file(references[1])!.async("string")).toBe("pdf-bytes");
    expect(markdown).toContain("[📎 报告.pdf]");
    expect(markdown).not.toContain(IMAGE_URL);
    expect(markdown).not.toContain(FILE_URL);
    expect(editor.getJSON()).toEqual(before);
    expect(editor.state.selection.from).toBe(3);
  });

  it("同一资源只下载一次，同名不同资源互不覆盖", async () => {
    createEditor(
      `<img src="${IMAGE_URL}" alt="same.png"><img src="${IMAGE_URL}" alt="same.png"><img src="https://resources.example/other.png" alt="same.png">`,
    );
    const result = await createMarkdownDownload(editor);
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    expect(fetchResource).toHaveBeenCalledTimes(2);
    expect(zip.file("assets/1-same.png")).not.toBeNull();
    expect(zip.file("assets/2-same.png")).not.toBeNull();
  });

  it("Base64、Blob 资源写入真实文件，不保留临时地址", async () => {
    createEditor(mediaContent(DATA_IMAGE, "blob:http://localhost/file"));
    const result = await createMarkdownDownload(editor);
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const markdown = await zip.file("qingwu-doc.md")!.async("string");
    expect(markdown).not.toMatch(/data:|blob:/);
    expect(zip.file("assets/1-示意图.png")).not.toBeNull();
    expect(zip.file("assets/2-报告.pdf")).not.toBeNull();
  });

  it("资源读取失败时拒绝生成不完整的 ZIP", async () => {
    createEditor(mediaContent());
    fetchResource.mockResolvedValue(new Response("not found", { status: 404 }));
    await expect(createMarkdownDownload(editor)).rejects.toThrow("示意图.png");
  });

  it("资源读取时优先使用私有存储签名地址", async () => {
    createEditor(`<img src="${IMAGE_URL}">`);
    vi.spyOn(signedFetch, "signPreviewUrl").mockResolvedValue("https://signed.example/image.png");
    await createMarkdownDownload(editor);
    expect(fetchResource).toHaveBeenCalledWith("https://signed.example/image.png");
  });

  it("下载过程中继续编辑，不影响本次导出的内容快照", async () => {
    createEditor(`<p>下载前正文</p><img src="${IMAGE_URL}">`);
    let resolveFetch!: (response: Response) => void;
    fetchResource.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const resultPromise = createMarkdownDownload(editor);
    await vi.waitFor(() => expect(resolveFetch).toBeDefined());
    editor.commands.setContent("<p>下载过程中修改的正文</p>");
    resolveFetch(new Response("image", { headers: { "content-type": "image/png" } }));
    const result = await resultPromise;
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const markdown = await zip.file("qingwu-doc.md")!.async("string");
    expect(markdown).toContain("下载前正文");
    expect(markdown).not.toContain("过程中修改");
  });
});

describe("PDF 与其他导出格式", () => {
  it("HTML、纯文本用链接表示资源，JSON 保留原资源地址", () => {
    createEditor(mediaContent());
    const html = getExportContent(editor, "html");
    expect(html).not.toContain("<img");
    expect(html).toContain(`href="${IMAGE_URL}"`);
    expect(html).toContain(`href="${FILE_URL}"`);
    const text = getExportContent(editor, "text");
    expect(text).toContain(`🖼 示意图.png (${IMAGE_URL})`);
    expect(text).toContain(`📎 报告.pdf (${FILE_URL})`);
    expect(JSON.parse(getExportContent(editor, "json"))).toEqual(editor.getJSON());
    expect(fetchResource).not.toHaveBeenCalled();
  });

  it("HTML 中 Base64 附件保留可下载链接，危险地址不被放行", () => {
    const dataFile = "data:text/plain;base64,dGVzdA==";
    createEditor(mediaContent(DATA_IMAGE, dataFile));
    const container = document.createElement("div");
    container.innerHTML = getExportContent(editor, "html");
    const attachment = [...container.querySelectorAll("a")].find((link) =>
      link.textContent?.includes("报告.pdf"),
    )!;
    expect(attachment.getAttribute("href")).toBe(dataFile);
    expect(attachment.download).toBe("报告.pdf");
    editor.commands.setContent({
      type: "doc",
      content: [{ type: "image", attrs: { src: "javascript:alert(1)", alt: "危险" } }],
    });
    expect(getExportContent(editor, "html")).not.toContain("javascript:");
  });

  it("PDF 内嵌图片，附件显示图标和名称，附件本身不重复读取", async () => {
    createEditor(mediaContent());
    const html = await createPrintHtml(editor);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.images).toHaveLength(1);
    expect(doc.images[0].src).toMatch(/^data:image\/png;base64,/);
    expect(doc.body.textContent).toContain("📎 报告.pdf");
    expect(doc.querySelector("a")!.getAttribute("href")).toBe(FILE_URL);
    expect(fetchResource).toHaveBeenCalledTimes(1);
    expect(html).not.toMatch(/<iframe|<object|<embed/);
  });

  it("图片与附件共用地址时，PDF 中附件仍指向原地址", async () => {
    createEditor(mediaContent(IMAGE_URL, IMAGE_URL));
    const doc = new DOMParser().parseFromString(await createPrintHtml(editor), "text/html");
    expect(doc.images[0].src).toMatch(/^data:image\/png/);
    expect(doc.querySelector("a")!.getAttribute("href")).toBe(IMAGE_URL);
  });

  it("附件在图片之前引用同一地址时，图片也会被内嵌", async () => {
    createEditor(
      `<div data-attachment-embed data-src="${IMAGE_URL}" data-name="图片附件.png"></div><img src="${IMAGE_URL}">`,
    );
    const doc = new DOMParser().parseFromString(await createPrintHtml(editor), "text/html");
    expect(doc.images[0].src).toMatch(/^data:image\/png;base64,/);
    expect(doc.querySelector("a")!.getAttribute("href")).toBe(IMAGE_URL);
    expect(fetchResource).toHaveBeenCalledTimes(1);
  });

  it("等待图片加载和解码完成后才能进入打印", async () => {
    const doc = document.implementation.createHTMLDocument();
    const image = doc.createElement("img");
    doc.body.appendChild(image);
    Object.defineProperty(image, "complete", { configurable: true, value: false });
    Object.defineProperty(image, "naturalWidth", { value: 1 });
    image.decode = vi.fn().mockResolvedValue(undefined);
    let ready = false;
    const pending = waitForPrintImages(doc).then(() => {
      ready = true;
    });
    await Promise.resolve();
    expect(ready).toBe(false);
    image.dispatchEvent(new Event("load"));
    await pending;
    expect(image.decode).toHaveBeenCalled();
    expect(ready).toBe(true);
  });

  it("损坏图片阻止打印，避免生成缺图 PDF", async () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.appendChild(doc.createElement("img"));
    await expect(waitForPrintImages(doc)).rejects.toThrow("图片加载失败");
  });
});
