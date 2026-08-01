/**
 * 骨架屏核心测量引擎
 *
 * 两阶段 DOM 测量（参考 shimmer-from-structure 算法）：
 * Phase 1: 遍历 DOM 树，收集叶子元素（无布局回流的纯写操作）
 * Phase 2: 统一 getBoundingClientRect 测量（触发单次回流）
 *
 * 叶子判定：img/svg/video/canvas/iframe/input/textarea/button
 *         + 不含真实元素子节点（仅有文本/void 元素）的元素
 */

import type { SkeletonElement, LeafTag, VoidTag } from "./types";

// Phase 1 叶子收集用的标记类型（不触发布局的纯写阶段）
interface LeafCandidate {
  element: Element;
  borderRadius: string;
}

interface WrappedCell {
  element: HTMLElement;
  span: HTMLSpanElement;
  borderRadius: string;
}

const ALWAYS_LEAF: Set<string> = new Set<LeafTag>([
  "img",
  "svg",
  "video",
  "canvas",
  "iframe",
  "input",
  "textarea",
  "button",
]);

const VOID_ELEMENTS: Set<string> = new Set<VoidTag>(["br", "wbr", "hr"]);

/**
 * 判断元素是否为测量用的"叶子"
 * - 某些标签总是叶子（如 img）
 * - 不含真实元素子节点（仅有文本 + br/wbr/hr）的元素视为叶子
 */
export function isLeafElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();

  if (ALWAYS_LEAF.has(tag)) {
    return true;
  }

  const hasRealChildren = Array.from(element.children).some(
    (child) => !VOID_ELEMENTS.has(child.tagName.toLowerCase()),
  );
  if (!hasRealChildren) {
    return true;
  }

  return false;
}

/**
 * Phase 1: 遍历 DOM 子树，收集叶子元素（纯写操作，不触发回流）
 *
 * 特殊处理：
 * - data-skeleton-ignore: 跳过该子树
 * - data-skeleton-no-children: 该元素作为整体叶子
 * - 表格纯文本单元格：包一层 inline span 确保文字块有尺寸
 */
function collectLeafElements(
  element: Element,
  leafCandidates: LeafCandidate[],
  wrappedCells: WrappedCell[],
): void {
  // 跳过忽略元素
  if (element.hasAttribute("data-skeleton-ignore")) {
    return;
  }

  const isNoChildren = element.hasAttribute("data-skeleton-no-children");

  if (isNoChildren || isLeafElement(element)) {
    const computedStyle = window.getComputedStyle(element);
    const borderRadius = computedStyle.borderRadius || "0px";

    // 表格纯文本单元格特殊处理：必须包 span 才能量到文字块尺寸
    const tag = element.tagName.toLowerCase();
    const isTableCell = tag === "td" || tag === "th";

    if (isTableCell && element.childNodes.length > 0) {
      const hasOnlyText = Array.from(element.childNodes).every(
        (node) => node.nodeType === Node.TEXT_NODE,
      );

      if (hasOnlyText) {
        const span = document.createElement("span");
        span.style.display = "inline";

        while (element.firstChild) {
          span.appendChild(element.firstChild);
        }
        element.appendChild(span);

        wrappedCells.push({
          element: element as HTMLElement,
          span,
          borderRadius,
        });
        return;
      }
    }

    leafCandidates.push({ element, borderRadius });
  } else {
    // 递归子节点
    Array.from(element.children).forEach((child) => {
      collectLeafElements(child, leafCandidates, wrappedCells);
    });
  }
}

/**
 * Phase 2: 对所有收集的元素执行统一测量
 *
 * 第一次 getBoundingClientRect() 触发回流，
 * 后续调用复用布局缓存。
 */
function measureCollectedElements(
  leafCandidates: LeafCandidate[],
  wrappedCells: WrappedCell[],
  parentRect: DOMRect,
  maxElements: number,
): SkeletonElement[] {
  const results: SkeletonElement[] = [];

  for (const { element, borderRadius } of leafCandidates) {
    if (results.length >= maxElements) break;

    const rect = element.getBoundingClientRect();

    // 过滤零尺寸元素
    if (rect.width === 0 || rect.height === 0) continue;

    results.push({
      x: rect.left - parentRect.left,
      y: rect.top - parentRect.top,
      width: rect.width,
      height: rect.height,
      borderRadius,
    });
  }

  // 表格单元格：用 span 的尺寸
  for (const { element, span, borderRadius } of wrappedCells) {
    if (results.length >= maxElements) break;

    const rect = span.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    results.push({
      x: rect.left - parentRect.left,
      y: rect.top - parentRect.top,
      width: rect.width,
      height: rect.height,
      borderRadius,
    });
  }

  return results;
}

/**
 * 从元素中提取骨架几何信息
 *
 * @param element - 要测量的根元素
 * @param maxElements - 最大测量元素数（性能保护）
 * @returns 叶子元素的几何信息数组
 */
export function extractElementInfo(
  element: Element,
  maxElements: number = 500,
): SkeletonElement[] {
  const leafCandidates: LeafCandidate[] = [];
  const wrappedCells: WrappedCell[] = [];

  const parentRect = element.getBoundingClientRect();

  // Phase 1: 收集（纯写，不触发回流）
  Array.from(element.children).forEach((child) => {
    collectLeafElements(child, leafCandidates, wrappedCells);
  });

  // Phase 2: 统一测量（单次回流）
  return measureCollectedElements(
    leafCandidates,
    wrappedCells,
    parentRect,
    maxElements,
  );
}
