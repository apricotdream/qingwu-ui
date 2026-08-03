/**
 * 多行文本截断
 *
 * 规则：二分查找截断位置，O(log n) 而非逐行构建
 *
 * 算法：
 *   1. 先 layout 全文获得总行数
 *   2. 若总行数 ≤ maxLines，直接返回全文
 *   3. 否则在 segment 数组中二分查找截断位置
 *   4. 在截断处末尾追加省略号（…）
 *   5. 重新 layout 验证行数
 *
 * 与 CSS line-clamp 对比：
 *   - CSS line-clamp：浏览器黑盒，无法获取截断文本、截断位置、实际行数
 *   - Pretext 方案：精确知道截断位置，可返回截断后的文本和元信息
 */

import { layout, prepare } from "./engine";
import type { TruncateResult } from "./types";

/**
 * 将文本截断到指定行数
 *
 * @param text - 原始文本
 * @param maxWidth - 容器宽度 (px)
 * @param maxLines - 最大行数
 * @param font - CSS font 字符串
 * @param ellipsis - 省略号字符
 * @returns 截断结果（含截断文本和元信息）
 */
export function truncateToLines(
  text: string,
  maxWidth: number,
  maxLines: number,
  font: string = "16px system-ui",
  ellipsis: string = "…",
): TruncateResult {
  // 先计算全文布局
  const fullResult = layout(text, { maxWidth, lineHeight: 1, maxLines: undefined }, font);
  const fullLineCount = fullResult.lineCount;

  if (fullLineCount <= maxLines || maxLines <= 0) {
    return {
      text,
      truncated: false,
      lineCount: fullLineCount,
      fullLineCount,
    };
  }

  // 二分查找截断位置
  // 在 segment 级别二分，找到第 maxLines 行的最后一个 segment
  const segments = prepare(text, font);

  let lo = 0;
  let hi = segments.length;

  // 二分查找最大的 segment index 使得 layout 结果 ≤ maxLines
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const testText = segments
      .slice(0, mid)
      .map((s) => s.text)
      .join("");
    const testResult = layout(testText + ellipsis, { maxWidth, lineHeight: 1 }, font);

    if (testResult.lineCount <= maxLines) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  // 构建截断文本
  const truncSegments = segments.slice(0, lo);
  const truncText =
    truncSegments
      .map((s) => s.text)
      .join("")
      .trimEnd() + ellipsis;

  // 验证最终行数
  const verifyResult = layout(truncText, { maxWidth, lineHeight: 1 }, font);

  return {
    text: truncText,
    truncated: true,
    lineCount: verifyResult.lineCount,
    fullLineCount,
  };
}

/**
 * 截断到最大高度（而非行数）
 */
export function truncateToHeight(
  text: string,
  maxWidth: number,
  maxHeight: number,
  lineHeight: number,
  font?: string,
  ellipsis?: string,
): TruncateResult {
  const maxLines = Math.floor(maxHeight / lineHeight);
  return truncateToLines(text, maxWidth, maxLines, font, ellipsis);
}
