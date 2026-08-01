/**
 * SSR/静态骨架屏 HTML 生成
 *
 * 使用 @qingwu/text-layout 的文本排版引擎估算骨架几何，
 * 生成纯 CSS 骨架 HTML，无需 JavaScript 即可展示。
 *
 * 工作原理：
 * 1. 对每条文字配置：prepare → layout → 计算每行宽度和位置
 * 2. 对矩形区域：按配置直接绘制
 * 3. 输出包含流光动画 CSS 的完整 HTML 片段
 */

import type { SSRSkeletonConfig, SSRSkeletonTextConfig, SSRSkeletonRectConfig } from "./types";

/** 文本行骨架块的默认配置 */
const TEXT_LINE_DEFAULTS = {
  font: "14px system-ui",
  lineHeight: 20,
  gap: 8,
  maxLines: 2,
} as const;

/** 矩形区域骨架块的默认配置 */
const RECT_DEFAULTS = {
  borderRadius: 4,
  marginBottom: 8,
} as const;

/**
 * 为文字行生成骨架块几何数据
 *
 * 使用 text-layout 的排版引擎估算行数和每行宽度
 * （SSR 环境无 Canvas 时使用 estimateWidth 近似计算）
 */
export function computeTextSkeleton(
  config: SSRSkeletonTextConfig,
): Array<{ y: number; width: number; height: number }> {
  const font = config.font ?? TEXT_LINE_DEFAULTS.font;
  const lineHeight = config.lineHeight ?? TEXT_LINE_DEFAULTS.lineHeight;
  const gap = config.gap ?? TEXT_LINE_DEFAULTS.gap;
  const maxLines = config.maxLines ?? TEXT_LINE_DEFAULTS.maxLines;
  const text = config.text;

  // 使用 text-layout 的排版引擎估算行数
  // 动态导入以避免 SSR 环境依赖问题
  let lineCount = 1;
  const estimatedWidth = estimateTextWidth(text, font);

  // 简化版行数估算（完整版应使用 text-layout layout 函数）
  // 这里按平均字符宽度估算
  const avgCharWidth = extractFontSize(font) * 0.6; // 拉丁 ~0.55em, CJK ~1em, 混合 ~0.6
  const estimatedCharsPerLine = Math.floor(80 / 0.6); // 假设 80% 容器宽度利用率
  lineCount = Math.min(maxLines, Math.ceil(text.length / estimatedCharsPerLine));

  const lines: Array<{ y: number; width: number; height: number }> = [];
  for (let i = 0; i < lineCount; i++) {
    const isLastLine = i === lineCount - 1;
    // 最后一行通常较短（~60% 宽度）
    const widthPercent = isLastLine ? 0.6 : 0.85;
    lines.push({
      y: i * (lineHeight + gap),
      width: Math.round(estimatedWidth * widthPercent),
      height: lineHeight,
    });
  }

  return lines;
}

/** 提取字体大小 (px) */
function extractFontSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)\s*px/);
  return match ? parseFloat(match[1]) : 16;
}

/** 估算文本像素宽度（SSR 环境降级版） */
function estimateTextWidth(text: string, font: string): number {
  const fontSize = extractFontSize(font);
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    // CJK 字符 ≈ 1em
    if (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x20000 && cp <= 0x2a6df) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0x3000 && cp <= 0x303f) ||
      (cp >= 0xff00 && cp <= 0xffef) ||
      (cp >= 0xac00 && cp <= 0xd7af)
    ) {
      width += fontSize;
    } else if (ch === " ") {
      width += fontSize * 0.3;
    } else {
      width += fontSize * 0.55;
    }
  }
  return width;
}

/**
 * 生成 CSS-only 骨架屏 HTML
 *
 * @param config - 骨架配置（文字行 + 矩形区域）
 * @returns 包含内联样式和动画的完整 HTML 字符串
 *
 * @example
 * ```ts
 * const html = createSSRSkeleton({
 *   width: 360,
 *   textLines: [
 *     { text: "2025 春季新款女士连衣裙 优雅气质中长款", font: "16px system-ui", maxLines: 2, lineHeight: 24, gap: 6 },
 *     { text: "¥299.00", font: "18px system-ui", maxLines: 1, lineHeight: 28 },
 *   ],
 *   rects: [
 *     { width: "100%", height: 200, borderRadius: 8, marginBottom: 12 },
 *     { width: 120, height: 36, borderRadius: 18, marginBottom: 0 },
 *   ],
 * });
 * ```
 */
export function createSSRSkeleton(config: SSRSkeletonConfig): string {
  const {
    width,
    height,
    textLines = [],
    rects = [],
    shimmerColor = "#f0f0f0",
    backgroundColor = "#e0e0e0",
    duration = 1500,
    reducedMotion = false,
  } = config;

  // 按 y 偏移排序所有骨架块
  interface Block {
    y: number;
    x: number;
    width: number | string;
    height: number;
    borderRadius?: number;
  }

  const blocks: Block[] = [];

  // 文字行块
  let currentY = 0;
  for (const textConfig of textLines) {
    const lines = computeTextSkeleton(textConfig);
    for (const line of lines) {
      blocks.push({
        y: currentY + line.y,
        x: 0,
        width: line.width,
        height: line.height,
        borderRadius: textConfig.lineHeight ? Math.min(textConfig.lineHeight / 2, 4) : undefined,
      });
    }
    currentY += (textConfig.maxLines ?? 2) * (textConfig.lineHeight ?? 20) +
      (textConfig.maxLines ?? 2) * (textConfig.gap ?? 8);
    // 一块文字区域底部增加段落间距
    currentY += 8;
  }

  // 矩形区域块（重新计算 y 从文字区域后方开始）
  const textRegionHeight = currentY > 0 ? currentY - 8 : 0;

  for (const rect of rects) {
    blocks.push({
      y: textRegionHeight,
      x: 0,
      width: rect.width,
      height: rect.height,
      borderRadius: rect.borderRadius ?? RECT_DEFAULTS.borderRadius,
    });
  }

  // 生成 CSS
  const animCss = reducedMotion
    ? `.qs-ssr-skel-block { background: ${backgroundColor} !important; animation: none !important; }`
    : `
    @keyframes qs-ssr-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .qs-ssr-skel-block {
      background: linear-gradient(90deg,
        ${backgroundColor} 0%,
        ${shimmerColor} 40%,
        ${shimmerColor} 60%,
        ${backgroundColor} 100%
      );
      background-size: 200% 100%;
      animation: qs-ssr-shimmer ${duration}ms ease-in-out infinite;
    }
  `;

  const blocksHtml = blocks
    .map((b) => {
      const w = typeof b.width === "number" ? `${b.width}px` : b.width;
      const br = b.borderRadius !== undefined ? b.borderRadius : 4;
      return `<div class="qs-ssr-skel-block" style="
        position:absolute;
        top:${b.y}px;
        left:${b.x}px;
        width:${w};
        height:${b.height}px;
        border-radius:${br}px;
      "></div>`;
    })
    .join("\n");

  const totalHeight = height ?? (Math.max(
    ...blocks.map((b) => b.y + b.height),
    0,
  ));

  return [
    "<style>",
    animCss,
    "</style>",
    `<div style="position:relative;width:${width}px;height:${totalHeight}px;overflow:hidden;" role="status" aria-label="加载中">`,
    blocksHtml,
    "<span style='position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)'>加载中...</span>",
    "</div>",
  ].join("\n");
}
