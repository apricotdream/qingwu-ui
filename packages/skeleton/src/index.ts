/**
 * @qingwu/skeleton
 *
 * 自动骨架屏 —— 运行时 DOM 测量生成像素级骨架加载态
 *
 * 核心能力：
 *   - AutoSkeleton — 原地测量 DOM 结构（不移动子节点），
 *     portal 覆盖层生成流光骨架；任意框架（React/Vue/vanilla）
 *     使用零 DOM 所有权冲突
 *   - renderSkeletonSnapshot — 将测量快照渲染为纯 CSS 静态骨架 HTML
 *   - 两阶段 DOM 测量（Phase 1 TreeWalker 单遍叶子收集 /
 *     Phase 2 统一测量，单次回流）
 *   - 块级渐变位移动画（每块 ::before 渐变层 transform 滑动，
 *     合成器线程，零 repaint；门槛 48×8 过滤小块）
 *   - ResizeObserver 自适应布局变化、scroll 跟随
 *   - prefers-reduced-motion 动效适配
 *   - [data-skeleton-ignore] / [data-skeleton-no-children] 细粒度控制
 */

// ─── 主类 ───
export { AutoSkeleton } from "./auto-skeleton";
// ─── 核心引擎（高级用法） ───
export { extractElementInfo, isLeafElement, structureSignature } from "./core";
// ─── 静态骨架渲染（快照渲染器） ───
export { renderSkeletonSnapshot } from "./ssr";

// ─── 类型 ───
export type {
  AutoSkeletonOptions,
  RenderSkeletonSnapshotOptions,
  SkeletonElement,
} from "./types";
