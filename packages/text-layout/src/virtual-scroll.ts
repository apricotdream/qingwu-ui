/**
 * 虚拟滚动高度计算
 *
 * 规则：预计算每一项的精确高度，而非渲染后 DOM 测量
 *
 * 算法：
 *   prepare() 每项文本（在数据加载时完成）→ layout() 每项在目标宽度下
 *   → 存储 id→height 映射 → 虚拟滚动组件 O(1) 查找
 *
 * 与 DOM 方案对比：
 *   - DOM 测量：每次渲染触发回流，~0.05ms/项，大列表卡顿
 *   - Pretext 方案：prepare 一次性（与数据加载并行），layout ~0.0002ms/项
 */

import { layout } from "./engine";
import type { VirtualHeightResult, VirtualItem } from "./types";

/**
 * 批量计算虚拟列表项高度
 *
 * @param items - 列表项数组
 * @param containerWidth - 容器宽度 (px)
 * @param lineHeight - 行高 (px)
 * @param font - CSS font 字符串
 * @param paddingVertical - 每项的垂直内边距 (px)
 * @param maxLines - 每项最大行数（超出截断）
 * @returns 高度映射 + 累计偏移 + 总高度
 */
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

/**
 * 根据滚动偏移查找可见项范围
 *
 * @param offsets - computeVirtualHeights 返回的累计偏移数组
 * @param scrollTop - 当前滚动偏移
 * @param viewportHeight - 视口高度
 * @returns [startIndex, endIndex] 包含两端 overscan
 */
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
