/**
 * 附件上传大小限制：类型、文档总大小统计与校验。
 *
 * 校验规则（先查单文件，命中即报单文件超限；再查总大小）：
 * 1. 单文件大小 ≤ maxAttachmentSize
 * 2. 文档内所有附件（attachmentEmbed / videoEmbed / audioEmbed / image 节点
 *    的 size 属性之和）+ 新文件 ≤ maxTotalAttachmentSize
 */
import type { Node as PMNode } from "@tiptap/pm/model";

export interface AttachmentLimits {
  /** 单文件上传大小上限（字节） */
  maxAttachmentSize: number;
  /** 文档内所有附件总大小上限（字节） */
  maxTotalAttachmentSize: number;
}

/** 参与总大小统计的节点类型（均携带 size 属性） */
const SIZE_NODE_TYPES = new Set(["attachmentEmbed", "videoEmbed", "audioEmbed", "image"]);

/** 文档内已存在附件的总大小（字节） */
export function getDocAttachmentTotal(doc: PMNode): number {
  let total = 0;
  doc.descendants((node) => {
    if (SIZE_NODE_TYPES.has(node.type.name)) {
      total += Number(node.attrs?.size) || 0;
    }
  });
  return total;
}

/** 字节数格式化为可读文本（1024 进制） */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  // 整数直接显示（如 "10 MB"），否则保留一位小数（如 "1.5 KB"）
  const text = i === 0 || value >= 100 ? `${Math.round(value)}` : `${Math.round(value * 10) / 10}`;
  return `${text} ${units[i]}`;
}

/**
 * 校验文件上传是否允许（同步校验，不通过即拒绝插入）。
 *
 * 0 / undefined 视为不限制。返回错误消息；通过返回 null。
 */
export function validateAttachmentFile(
  doc: PMNode,
  file: File,
  limits: AttachmentLimits | Partial<AttachmentLimits>,
): string | null {
  const { maxAttachmentSize, maxTotalAttachmentSize } = limits;

  if (maxAttachmentSize && file.size > maxAttachmentSize) {
    return `单文件大小不能超过 ${formatBytes(maxAttachmentSize)}（当前 ${formatBytes(file.size)}）`;
  }

  if (maxTotalAttachmentSize) {
    const total = getDocAttachmentTotal(doc) + file.size;
    if (total > maxTotalAttachmentSize) {
      return `附件总大小不能超过 ${formatBytes(maxTotalAttachmentSize)}（当前合计 ${formatBytes(total)}）`;
    }
  }

  return null;
}
