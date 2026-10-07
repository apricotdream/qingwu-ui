/**
 * 图片压缩管线：createImageBitmap 解码（EXIF 修正）→ canvas 等比缩放 → 编码 webp/avif（不可用降级 png）。
 * GIF/SVG 不支持压缩，返回空数组由调用方按原图处理。
 */

import type { CompressedFile, OutputFormat } from "./types";

/** 各格式的降级链：请求格式不可用时依次尝试 */
const FALLBACK_CHAIN: Record<OutputFormat, string[]> = {
  avif: ["image/avif", "image/webp", "image/png"],
  webp: ["image/webp", "image/png"],
  original: ["image/*"],
};

/** 解析格式实际可用的 MIME；全部不可用返回 null */
export function resolveMime(format: OutputFormat, supported: ReadonlySet<string>): string | null {
  const chain = FALLBACK_CHAIN[format];
  if (!chain) return null;
  for (const mime of chain) {
    if (supported.has(mime)) return mime;
  }
  return null;
}

/** 探测浏览器可编码的图片格式 */
export async function detectEncodeMimes(): Promise<Set<string>> {
  const supported = new Set<string>();
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return supported;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 2, 2);
  for (const mime of ["image/webp", "image/avif"]) {
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.5));
      if (blob && blob.type === mime) supported.add(mime);
    } catch {
      /* 编码失败视为不支持 */
    }
  }
  // PNG 编码必然可用（canvas 规范要求）
  supported.add("image/png");
  return supported;
}

export interface CompressOptions {
  quality: number;
  maxWidth: number;
  maxHeight: number;
}

/** 等比缩放后的画布 */
function drawScaled(bitmap: ImageBitmap, maxW: number, maxH: number): HTMLCanvasElement {
  const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

function blobToFile(blob: Blob, name: string, mime: string): File {
  return new File([blob], name, { type: mime });
}

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** 压缩图片，按 formats 产出多份；GIF/SVG 不支持返回空数组 */
export async function compressImage(
  file: File,
  formats: OutputFormat[],
  opts: CompressOptions,
  supported?: ReadonlySet<string>,
): Promise<CompressedFile[]> {
  const type = file.type.toLowerCase();
  // 动图/矢量图压缩会丢失动画或不可行，交给调用方按原图处理
  if (type === "image/gif" || type === "image/svg+xml") return [];

  const encodable = supported ?? (await detectEncodeMimes());
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const canvas = drawScaled(bitmap, opts.maxWidth, opts.maxHeight);
    const results: CompressedFile[] = [];

    for (const format of formats) {
      if (format === "original") continue; // 原图由调用方直接取 file
      const mime = resolveMime(format, encodable);
      if (!mime) continue;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, opts.quality),
      );
      if (!blob) continue;

      const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "img";
      results.push({
        format,
        mime,
        blob: blobToFile(blob, `${baseName(file.name)}.${ext}`, mime),
      });
    }
    return results;
  } finally {
    bitmap.close();
  }
}
