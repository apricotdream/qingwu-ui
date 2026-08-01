/**
 * 骨架屏核心测量引擎
 *
 * 两阶段 DOM 测量（参考 shimmer-from-structure 算法）：
 * Phase 1: 单遍 TreeWalker 遍历 DOM 树，收集叶子元素（纯读操作，零中间数组分配）
 * Phase 2: 统一 getBoundingClientRect 测量（触发单次回流）
 *
 * 叶子判定：img/svg/video/canvas/iframe/input/textarea/button
 *         + 不含真实元素子节点（仅有文本/void 元素）的元素
 */

import type { SkeletonElement, LeafTag, VoidTag } from "./types";

interface LeafCandidate {
  element: Element;
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
 * 跳过当前节点的整棵子树，返回子树后的下一个元素。
 *
 * TreeWalker 无原生"跳过子树"API，通过
 * nextSibling → 逐级 parentNode 的方式移动到
 * 子树末尾后的下一个元素，O(深度) 时间，常数内存。
 */
function advancePast(walker: TreeWalker, root: Element): Element | null {
  let next = walker.nextSibling() as Element | null;
  while (!next && walker.currentNode !== root) {
    const parent = walker.parentNode();
    if (!parent) break;
    next = walker.nextSibling() as Element | null;
  }
  return next;
}

/**
 * Phase 1: 单遍 TreeWalker 遍历，收集叶子元素（纯读操作，不触发回流）
 *
 * 特殊处理：
 * - data-skeleton-ignore: 跳过整棵子树（advancePast）
 * - data-skeleton-no-children: 该元素作为整体叶子，子元素不收集
 * - 叶子元素本身无子节点可收集，统一 advancePast 后继续
 *
 * 注：不修改任何 DOM（原地测量前提）；纯文本表格单元格
 * 直接以整个单元格矩形作为骨架块。
 */
function collectLeafElements(
  root: Element,
  leafCandidates: LeafCandidate[],
): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

  let node = walker.nextNode() as Element | null;
  while (node) {
    // 跳过忽略元素的整棵子树
    if (node.hasAttribute("data-skeleton-ignore")) {
      node = advancePast(walker, root);
      continue;
    }

    const isNoChildren = node.hasAttribute("data-skeleton-no-children");

    if (isNoChildren || isLeafElement(node)) {
      const computedStyle = window.getComputedStyle(node);
      leafCandidates.push({
        element: node,
        borderRadius: computedStyle.borderRadius || "0px",
      });

      // no-children 元素可能有子元素，跳过其子树避免重复收集
      if (isNoChildren) {
        node = advancePast(walker, root);
        continue;
      }
    }

    node = walker.nextNode() as Element | null;
  }
}

/**
 * 从元素中提取骨架几何信息
 *
 * @param element - 要测量的根元素
 * @param maxElements - 最大测量元素数（性能保护，默认 500）
 * @returns 叶子元素的几何信息数组
 */
export function extractElementInfo(
  element: Element,
  maxElements: number = 500,
): SkeletonElement[] {
  const leafCandidates: LeafCandidate[] = [];

  const parentRect = element.getBoundingClientRect();

  // Phase 1: 单遍收集（纯读，不触发回流，无中间数组分配）
  collectLeafElements(element, leafCandidates);

  // Phase 2: 统一测量（单次回流）
  const results: SkeletonElement[] = [];
  for (const { element: el, borderRadius } of leafCandidates) {
    if (results.length >= maxElements) break;

    const rect = el.getBoundingClientRect();

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

  return results;
}

/**
 * 结构签名 —— refetch 自适应重测的预筛哈希
 *
 * 哈希内容：标签 + class/style/data-skeleton-* 属性 + 子元素顺序 +
 * 文本节点长度之和。data-skeleton-ignore 子树跳过（不影响测量几何）。
 *
 * 原则：宁可错报（哈希碰撞 → 重测，无害），不可漏报（漏报 → 骨架僵死）。
 * 文本只进长度不进内容：换行数随长度变，同长文本内容变化不影响几何。
 * 与 collectLeafElements 不同：纯读、零分配数组，O(n) 但无回流。
 */
export function structureSignature(root: Element): string {
  let hash = 0;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );

  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      hash = (hash * 31 + (node.textContent?.length ?? 0)) | 0;
    } else {
      const el = node as Element;
      if (el.hasAttribute("data-skeleton-ignore")) {
        // 跳过整棵子树（与 collectLeafElements 相同的 advancePast 语义）
        let next = walker.nextSibling();
        while (!next && walker.currentNode !== root) {
          const parent = walker.parentNode();
          if (!parent) break;
          next = walker.nextSibling();
        }
        node = next;
        continue;
      }
      const tag = el.tagName;
      for (let i = 0; i < tag.length; i++) {
        hash = (hash * 31 + tag.charCodeAt(i)) | 0;
      }
      // 仅几何相关属性进哈希：class/style 变化会改布局，data-skeleton-*
      // 控制测量行为；其余属性（data-id 等）不触发重测
      for (const attr of el.attributes) {
        if (
          attr.name === "class" ||
          attr.name === "style" ||
          attr.name.startsWith("data-skeleton-")
        ) {
          hash = (hash * 31 + attr.name.length) | 0;
          const value = attr.value;
          for (let i = 0; i < value.length; i++) {
            hash = (hash * 31 + value.charCodeAt(i)) | 0;
          }
        }
      }
    }
    node = walker.nextNode();
  }
  return hash.toString(36);
}
