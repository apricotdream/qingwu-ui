/**
 * 多行文本截断：segment 级别二分查找截断位置 O(log n)，精确返回截断文本
 * 与元信息（优于 CSS line-clamp 的浏览器黑盒）
 */

import { layout, prepare } from "./engine";
import type { TruncateResult } from "./types";

/** 将文本截断到指定行数 */
export function truncateToLines(
  text: string,
  maxWidth: number,
  maxLines: number,
  font: string = "16px system-ui",
  ellipsis: string = "…",
): TruncateResult {
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

  // segment 级别二分，找到第 maxLines 行的最后一个 segment
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

/** 截断到最大高度（而非行数） */
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
