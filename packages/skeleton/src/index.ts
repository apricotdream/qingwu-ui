/**
 * @qingwu-ui/skeleton
 *
 * 自动骨架屏：运行时 DOM 测量生成像素级骨架加载态。AutoSkeleton 原地测量
 * （不移动子节点）+ portal 覆盖层流光骨架；renderSkeletonSnapshot 将测量
 * 快照渲染为纯 CSS 静态 HTML；两阶段测量（TreeWalker 单遍收集 + 单次回流）。
 */

export { AutoSkeleton } from "./auto-skeleton";
export { extractElementInfo, isLeafElement, structureSignature } from "./core";
export { renderSkeletonSnapshot } from "./ssr";

export type {
  AutoSkeletonOptions,
  RenderSkeletonSnapshotOptions,
  SkeletonElement,
} from "./types";
