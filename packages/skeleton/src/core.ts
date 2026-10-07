/**
 * 骨架屏核心测量引擎：两阶段 DOM 测量（Phase 1 TreeWalker 单遍收集叶子 /
 * Phase 2 统一 getBoundingClientRect 测量，单次回流）
 */

import type { LeafTag, SkeletonElement, VoidTag } from "./types";

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

/** 判断元素是否为测量用的"叶子"（总有叶子标签 / 不含真实元素子节点） */
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

/** 跳过整棵子树，返回其后元素；TreeWalker 无跳过 API，靠 nextSibling → 逐级 parentNode，O(深度) 时间 */
function advancePast(walker: TreeWalker, root: Element): Element | null {
  let next = walker.nextSibling() as Element | null;
  while (!next && walker.currentNode !== root) {
    const parent = walker.parentNode();
    if (!parent) break;
    next = walker.nextSibling() as Element | null;
  }
  return next;
}

/** Phase 1：单遍 TreeWalker 收集叶子（纯读不回流）；data-skeleton-ignore 跳过子树、
 *  data-skeleton-no-children 作整体叶子。不修改任何 DOM。 */
function collectLeafElements(root: Element, leafCandidates: LeafCandidate[]): void {
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

/** 从元素中提取骨架几何信息；maxElements 为性能保护，默认 500 */
export function extractElementInfo(element: Element, maxElements: number = 500): SkeletonElement[] {
  const leafCandidates: LeafCandidate[] = [];

  const parentRect = element.getBoundingClientRect();

  // Phase 1: 单遍收集（纯读，不触发回流，无中间数组分配）
  collectLeafElements(element, leafCandidates);

  // Phase 2: 统一测量（单次回流）
  const results: SkeletonElement[] = [];
  for (const { element: el, borderRadius } of leafCandidates) {
    if (results.length >= maxElements) break;

    const rect = el.getBoundingClientRect();

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
 * 结构签名 —— refetch 自适应重测的预筛哈希。
 * 哈希：标签 + class/style/data-skeleton-* 属性 + 子元素顺序 + 文本长度。
 * 宁可错报（碰撞→重测）不可漏报；文本只进长度（同长内容变化不影响几何）。
 */
export function structureSignature(root: Element): string {
  let hash = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

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
      // 仅几何相关属性进哈希：class/style 影响布局，data-skeleton-* 控制测量；其余不触发重测
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
