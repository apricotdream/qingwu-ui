import type { Editor } from "@tiptap/core";
import { DOMSerializer, Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import JSZip from "jszip";
import { signPreviewUrl, signPreviewUrlHeaders } from "../storage/signed-fetch";
import { sanitizeHtml } from "./sanitize";

export type ExportFormat = "html" | "json" | "md" | "text" | "pdf";

interface Resource {
  src: string;
  name: string;
  kind: string;
}

const RESOURCE_ICONS: Record<string, string> = {
  image: "🖼",
  attachmentEmbed: "📎",
  audioEmbed: "🎵",
  videoEmbed: "🎬",
};

function resourceName(node: ProseMirrorNode): string {
  if (node.attrs.name || node.attrs.alt) return node.attrs.name || node.attrs.alt;
  const src = String(node.attrs.src || "");
  if (!/^(data|blob):/i.test(src) && src) {
    try {
      return decodeURIComponent(
        new URL(src, document.baseURI).pathname.split("/").pop() || "resource",
      );
    } catch {
      return "resource";
    }
  }
  return node.type.name === "image" ? "image" : "attachment";
}

function resourcesIn(doc: ProseMirrorNode): Resource[] {
  const resources = new Map<string, Resource>();
  doc.descendants((node) => {
    const src = node.attrs.src;
    if (!RESOURCE_ICONS[node.type.name] || !src) return;
    // 网页播放器只有页面地址，保留链接，不把网页 HTML 冒充视频文件打包。
    if (node.type.name === "videoEmbed" && ["bilibili", "xiaohongshu"].includes(node.attrs.source))
      return;
    const existing = resources.get(src);
    if (existing && node.type.name === "image") existing.kind = "image";
    if (!existing) resources.set(src, { src, name: resourceName(node), kind: node.type.name });
  });
  return [...resources.values()];
}

/** 只转换导出副本；不改编辑器内容、选区或撤销记录。 */
function exportDoc(
  editor: Editor,
  format: ExportFormat,
  urls: Map<string, string>,
  source: ProseMirrorNode,
  downloadLinks: Map<string, string>,
): ProseMirrorNode {
  const schema = editor.schema;
  const convert = (node: ProseMirrorNode): ProseMirrorNode => {
    const icon = RESOURCE_ICONS[node.type.name];
    if (icon) {
      const src =
        (format === "md" || node.type.name === "image" ? urls.get(node.attrs.src) : undefined) ??
        node.attrs.src ??
        "";
      if (node.type.name === "image" && (format === "md" || format === "pdf")) {
        return node.type.create({ ...node.attrs, src }, node.content, node.marks);
      }
      const label = `${icon} ${resourceName(node)}`;
      const text = format === "text" && src ? `${label} (${src})` : label;
      const marks =
        src && format !== "text"
          ? [schema.marks.link.create({ href: downloadLinks.get(src) ?? src })]
          : [];
      return schema.nodes.paragraph.create(null, schema.text(text, marks));
    }
    const marks = node.marks.map((mark) => {
      const href = format === "md" ? urls.get(mark.attrs.href) : undefined;
      return mark.type.name === "link" && href ? mark.type.create({ ...mark.attrs, href }) : mark;
    });
    if (node.isText) return node.mark(marks);
    const children: ProseMirrorNode[] = [];
    node.forEach((child) => children.push(convert(child)));
    return node.type.create(node.attrs, Fragment.from(children), marks);
  };
  return convert(source);
}

export function getExportContent(
  editor: Editor,
  format: ExportFormat,
  urls = new Map<string, string>(),
  source: ProseMirrorNode = editor.state.doc,
): string {
  if (format === "json") return JSON.stringify(source.toJSON(), null, 2);
  const downloads = resourcesIn(source).filter((resource) => /^(data|blob):/i.test(resource.src));
  // Link 扩展会提前清除 data: 地址，先用安全占位地址通过序列化，再恢复下载链接。
  const downloadLinks = new Map(
    format === "html" || format === "pdf"
      ? downloads.map((resource, index) => [
          resource.src,
          `https://qingwu-export.invalid/resource/${index}`,
        ])
      : [],
  );
  const doc = exportDoc(editor, format, urls, source, downloadLinks);
  if (format === "text") return doc.textBetween(0, doc.content.size, "\n\n");
  if (format === "md") {
    const markdown = (editor.storage as unknown as Record<string, unknown>).markdown as {
      serializer?: { serialize: (doc: ProseMirrorNode) => string };
    };
    if (markdown?.serializer) return markdown.serializer.serialize(doc);
  }
  const container = document.createElement("div");
  container.appendChild(DOMSerializer.fromSchema(editor.schema).serializeFragment(doc.content));
  // Base64/Blob 附件必须作为下载链接保留；清洗后仅恢复已知资源，并强制 download。
  container.querySelectorAll("a").forEach((link) => {
    const index = downloads.findIndex(
      (resource) => downloadLinks.get(resource.src) === link.getAttribute("href"),
    );
    if (index >= 0) link.dataset.exportDownload = String(index);
  });
  container.innerHTML = sanitizeHtml(container.innerHTML);
  container.querySelectorAll<HTMLAnchorElement>("a[data-export-download]").forEach((link) => {
    const resource = downloads[Number(link.dataset.exportDownload)];
    if (resource) {
      link.href = resource.src;
      link.download = resource.name;
      link.rel = "noopener noreferrer";
    }
    link.removeAttribute("data-export-download");
  });
  return container.innerHTML;
}

async function readResource(resource: Resource): Promise<Blob> {
  try {
    const presigned = await signPreviewUrl(resource.src);
    if (presigned) {
      try {
        const response = await fetch(presigned);
        if (response.ok) return await response.blob();
      } catch {
        // 私有桶预签名不可用时，继续使用签名头。
      }
    }
    const headers = await signPreviewUrlHeaders(resource.src);
    const response = await fetch(resource.src, headers ? { headers } : undefined);
    if (!response.ok) throw new Error(String(response.status));
    return await response.blob();
  } catch {
    throw new Error(`资源「${resource.name}」读取失败，请确认资源可访问后重试。`);
  }
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "video/mp4": "mp4",
};

function assetName(name: string, mime: string, index: number): string {
  let filename =
    name
      .replace(/[<>:"/\\|?*\p{Cc}]/gu, "_")
      .replace(/^\.+/, "")
      .trim() || "resource";
  const extension = MIME_EXTENSIONS[mime.split(";")[0]];
  if (!/\.[a-z0-9]{1,10}$/i.test(filename) && extension) filename += `.${extension}`;
  return `assets/${index + 1}-${filename}`;
}

export async function createMarkdownDownload(
  editor: Editor,
): Promise<{ blob: Blob; filename: string }> {
  const source = editor.state.doc;
  const resources = resourcesIn(source);
  if (resources.length === 0) {
    return {
      blob: new Blob([getExportContent(editor, "md", new Map(), source)], {
        type: "text/markdown;charset=utf-8",
      }),
      filename: "qingwu-doc.md",
    };
  }
  const archive = new JSZip();
  const urls = new Map<string, string>();
  for (const [index, resource] of resources.entries()) {
    const blob = await readResource(resource);
    const path = assetName(resource.name, blob.type, index);
    archive.file(path, await blob.arrayBuffer());
    urls.set(
      resource.src,
      encodeURI(path).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`),
    );
  }
  archive.file("qingwu-doc.md", getExportContent(editor, "md", urls, source));
  // 图片和附件多数已经压缩，STORE 避免重复压缩大文件导致界面卡顿。
  const data = await archive.generateAsync({ type: "arraybuffer", compression: "STORE" });
  return { blob: new Blob([data], { type: "application/zip" }), filename: "qingwu-doc.zip" };
}

async function imageDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

export async function createPrintHtml(editor: Editor): Promise<string> {
  const source = editor.state.doc;
  const urls = new Map<string, string>();
  for (const resource of resourcesIn(source)) {
    if (resource.kind !== "image") continue;
    urls.set(
      resource.src,
      resource.src.startsWith("data:")
        ? resource.src
        : await imageDataUrl(await readResource(resource)),
    );
  }
  const body = getExportContent(editor, "pdf", urls, source);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>青梧文档</title><style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { max-width: 800px; margin: 0 auto; padding: 24px; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.8; color: #27272a; overflow-wrap: anywhere; }
    h1,h2,h3,h4,h5,h6 { line-height: 1.35; break-after: avoid; }
    img { display: block; max-width: 100%; height: auto; margin: 12px 0; break-inside: avoid; }
    pre { padding: 16px; border-radius: 8px; background: #f4f4f5; white-space: pre-wrap; overflow-wrap: anywhere; }
    a { color: #0e7490; text-decoration: none; }
    table { width: 100%; border-collapse: collapse; } th,td { border: 1px solid #d4d4d8; padding: 6px 8px; }
    blockquote { margin: 16px 0; padding: 8px 16px; background: #f4f4f5; }
    @media (max-width: 480px) { body { padding: 16px; } }
    @media print { body { max-width: none; padding: 0; } }
  </style></head><body>${body}</body></html>`;
}

/** 图片已完整解码后才允许打印，避免定时器提前触发生成空白图片。 */
export async function waitForPrintImages(doc: Document): Promise<void> {
  await Promise.all(
    [...doc.images].map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => reject(new Error("图片加载失败，请重试导出。")), {
            once: true,
          });
        });
      }
      if (!image.naturalWidth) throw new Error("图片加载失败，请重试导出。");
      await image.decode();
    }),
  );
  await doc.fonts?.ready;
}
