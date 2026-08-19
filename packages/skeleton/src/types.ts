/**
 * 骨架屏类型定义
 */

/** 单个骨架块的几何信息 */
export interface SkeletonElement {
  /** 相对容器左边缘偏移 (px) */
  x: number;
  /** 相对容器上边缘偏移 (px) */
  y: number;
  /** 宽度 (px) */
  width: number;
  /** 高度 (px) */
  height: number;
  /** 圆角 (CSS 字符串，如 "4px") */
  borderRadius: string;
}

/** AutoSkeleton 配置项 */
export interface AutoSkeletonOptions {
  /** 是否处于加载态 */
  loading: boolean;
  /** 闪光颜色（CSS 颜色，默认 "#f0f0f0"） */
  shimmerColor?: string;
  /** 背景色（CSS 颜色，默认 "#e0e0e0"） */
  backgroundColor?: string;
  /** 闪光动画时长 (ms，默认 1500) */
  duration?: number;
  /** 闪光动画时序函数（CSS animation-timing-function，默认 "ease-in-out"） */
  timingFunction?: string;
  /** 错峰步进 (ms，默认 80)：按文档序递增负 delay，首帧级联流水；0 关闭错峰 */
  staggerDelay?: number;
  /** 覆盖层 z-index（默认 9999）；页面 chrome（sticky/fixed 头部、弹层）需在骨架之上时调低 */
  zIndex?: number;
  /** 默认圆角 (px)，用于 borderRadius 为 0 的元素 */
  fallbackBorderRadius?: number;
  /** 禁用动画（遵循 prefers-reduced-motion）；不传时自动检测 */
  reducedMotion?: boolean;
  /** 骨架最大元素数量（性能保护，默认 500） */
  maxElements?: number;
}

/** 静态骨架渲染配置 */
export interface RenderSkeletonSnapshotOptions {
  /** 容器宽度 (px) */
  width: number;
  /** 容器高度 (px) — 未提供时按块几何自动计算 */
  height?: number;
  /** 流光颜色 */
  shimmerColor?: string;
  /** 背景色 */
  backgroundColor?: string;
  /** 动画时长 (ms) */
  duration?: number;
  /** 动画时序函数（CSS animation-timing-function，默认 "ease-in-out"） */
  timingFunction?: string;
  /** 错峰步进 (ms，默认 80)：按文档序递增负 delay，首帧级联；0 关闭错峰 */
  staggerDelay?: number;
  /** 禁用动画 */
  reducedMotion?: boolean;
  /** 最大骨架块数（性能保护，默认 200，超出截断） */
  maxBlocks?: number;
}

/** 叶子元素类型 */
export type LeafTag =
  | "img"
  | "svg"
  | "video"
  | "canvas"
  | "iframe"
  | "input"
  | "textarea"
  | "button";

/** 不占尺寸的元素（空格元素） */
export type VoidTag = "br" | "wbr" | "hr";
