/**
 * @qingwu/skeleton
 *
 * 自动骨架屏 —— 运行时 DOM 测量生成像素级骨架加载态
 *
 * 核心能力：
 *   - AutoSkeleton — 自动测量 DOM 结构，生成流光骨架覆盖层
 *   - createSSRSkeleton — 无 JavaScript 的纯 CSS 骨架 HTML 生成
 *   - 两阶段 DOM 测量（Phase 1 叶子收集 / Phase 2 统一测量，单次回流）
 *   - ResizeObserver 自适应布局变化
 *   - prefers-reduced-motion 动效适配
 *   - [data-skeleton-ignore] / [data-skeleton-no-children] 细粒度控制
 */

// ─── 主类 ───
export { AutoSkeleton } from "./auto-skeleton";

// ─── SSR 骨架生成 ───
export { createSSRSkeleton, computeTextSkeleton } from "./ssr";

// ─── 核心引擎（高级用法） ───
export { extractElementInfo, isLeafElement } from "./core";

// ─── 类型 ───
export type {
  AutoSkeletonOptions,
  SkeletonElement,
  SSRSkeletonConfig,
  SSRSkeletonTextConfig,
  SSRSkeletonRectConfig,
} from "./types";
