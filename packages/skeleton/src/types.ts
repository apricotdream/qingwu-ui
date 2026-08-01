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
  /** 默认圆角 (px)，用于 borderRadius 为 0 的元素 */
  fallbackBorderRadius?: number;
  /**
   * SSR 模式：使用文本排版引擎估算骨架几何
   * 生成 CSS-only 骨架，无需 JavaScript 即可展示
   * @default false
   */
  ssr?: boolean;
  /**
   * 禁用动画（遵循 prefers-reduced-motion）
   * 不传时自动检测系统偏好
   */
  reducedMotion?: boolean;
  /**
   * 骨架每行最大元素数量（性能保护，默认 500）
   */
  maxElements?: number;
}

/** SSR 骨架配置 */
export interface SSRSkeletonConfig {
  /** 容器宽度 (px) */
  width: number;
  /** 容器高度 (px) — 未提供时自动计算 */
  height?: number;
  /** 文字行骨架配置 */
  textLines?: SSRSkeletonTextConfig[];
  /** 矩形区域骨架配置 */
  rects?: SSRSkeletonRectConfig[];
  /** 流光颜色 */
  shimmerColor?: string;
  /** 背景色 */
  backgroundColor?: string;
  /** 动画时长 (ms) */
  duration?: number;
  /** 禁用动画 */
  reducedMotion?: boolean;
}

/** 单条文字行骨架配置 */
export interface SSRSkeletonTextConfig {
  /** 文字内容（用于估算行数和行宽） */
  text: string;
  /** CSS font 字符串，如 "14px system-ui" */
  font?: string;
  /** 最大显示行数 */
  maxLines?: number;
  /** 行高 (px) */
  lineHeight?: number;
  /** 行间距 (px) */
  gap?: number;
}

/** 矩形区域骨架配置 */
export interface SSRSkeletonRectConfig {
  /** 宽度（px 数字 或 CSS 百分比字符串） */
  width: number | string;
  /** 高度 (px) */
  height: number;
  /** 圆角 (px) */
  borderRadius?: number;
  /** 外边距下 (px) */
  marginBottom?: number;
}

/** 叶子元素类型 */
export type LeafTag = "img" | "svg" | "video" | "canvas" | "iframe" | "input" | "textarea" | "button";

/** 不占尺寸的元素（空格元素） */
export type VoidTag = "br" | "wbr" | "hr";
