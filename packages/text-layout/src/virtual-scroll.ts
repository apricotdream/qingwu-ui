/** 虚拟滚动高度计算：prepare 一次性测宽 + layout 精确高度，避免 DOM 测量回流 */

import { layout } from "./engine";
import type { VirtualHeightResult, VirtualItem } from "./types";

/** 批量计算虚拟列表项高度 */
export function computeVirtualHeights(
  items: VirtualItem[],
  containerWidth: number,
  lineHeight: number,
  font: string = "16px system-ui",
  paddingVertical: number = 0,
  maxLines?: number,
): VirtualHeightResult {
  const heights = new Map<string, number>();
  const offsets: number[] = [];
  let cumulative = 0;

  for (const item of items) {
    const result = layout(item.text, { maxWidth: containerWidth, lineHeight, maxLines }, font);
    const h = result.totalHeight + paddingVertical;
    heights.set(item.id, h);
    offsets.push(cumulative);
    cumulative += h;
  }

  return { heights, offsets, totalHeight: cumulative };
}

/** 根据滚动偏移查找可见项范围（含两端 overscan） */
export function findVisibleRange(
  offsets: number[],
  scrollTop: number,
  viewportHeight: number,
  overscan: number = 3,
): [number, number] {
  // 二分查找起始索引
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((offsets[mid] ?? 0) < scrollTop) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const start = Math.max(0, lo - overscan);

  // 查找结束索引
  const endScroll = scrollTop + viewportHeight;
  hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((offsets[mid] ?? 0) < endScroll) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const end = Math.min(offsets.length, lo + overscan + 1);

  return [start, end];
}
