export type ScrollFabMode = "to-bottom" | "to-top";

/** 悬浮位置（px）；bottom 缺省时自动叠加 safe-area，显式传入则按原值生效 */
export interface ScrollFabPosition {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/** Lenis 实例的最小结构性类型（组件不硬依赖 lenis 包，按结构识别） */
export interface LenisLike {
  scrollTo: (
    target: number | string | HTMLElement,
    options?: Record<string, unknown>,
  ) => void;
  raf?: (time: number) => void;
  destroy?: () => void;
  start?: () => void;
  stop?: () => void;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  off?: (event: string, callback: (...args: unknown[]) => void) => void;
  isScrolling?: boolean;
}

/** 内部自建 Lenis 时的构造配置（lenis 官方选项子集，允许透传其他字段） */
export interface ScrollFabLenisConfig {
  wrapper?: HTMLElement | Window;
  content?: HTMLElement;
  duration?: number;
  easing?: (t: number) => number;
  /** 默认强制 false：自建实例不劫持用户滚轮，只驱动按钮触发的程序滚动；显式置 true 则接管全局 */
  smoothWheel?: boolean;
  smoothTouch?: boolean;
  wheelMultiplier?: number;
  touchMultiplier?: number;
  [key: string]: unknown;
}

/**
 * 异形按钮形状（如银杏叶）。
 * 双 path 才能保证进度描边「完全包裹」：fill 是叶片实体，outline 是外扩一圈的闭合轮廓，
 * SVG 描边居中于路径，单条 path 必有一半笔画压进形状内部。
 * outline 的起点约定在 12 点钟方向（描边顺时针推进）。
 */
export interface ScrollFabShape {
  /** SVG viewBox，默认 "0 0 48 48"；自定义 path 建议按 48×48 绘制 */
  viewBox?: string;
  /** 形状实体 path d（被填充） */
  fill: string;
  /** 外扩进度轮廓 path d（track + 进度描边沿它走）；可与 fill 同形再配 outlineTransform 外扩 */
  outline: string;
  /** 作用于 outline path 的 SVG transform，如 "translate(24 24) scale(1.1) translate(-24 -24)" */
  outlineTransform?: string;
}

export interface ScrollFabOptions {
  /** 滚动容器，null（默认）为 window */
  target?: HTMLElement | null;
  /** 本体直径 px，默认 48，内部钳制最小 44（触控命中区） */
  size?: number;
  /** 绕满一圈的时长 ms（桌面悬停推进 / 触屏按住推进），默认 800 */
  ringDuration?: number;
  /** 离开/松手后描边衰减倒转的时长 ms，默认 300 */
  decayDuration?: number;
  /** 触屏按住期间指针位移超过该值（px）视为放弃描边、放行页面手势，默认 10 */
  cancelThreshold?: number;
  /** 中心内容自定义：HTML 字符串或节点，缺省为方向箭头 */
  content?: string | HTMLElement;
  /** 悬浮位置，默认右下 right 24 / bottom 24（含 safe-area） */
  position?: ScrollFabPosition;
  /** z-index，默认 9999 */
  zIndex?: number;
  /** 附加类名 */
  className?: string;
  /** 动画开关，关闭或 prefers-reduced-motion 时程序滚动瞬时到位，默认 true */
  animate?: boolean;
  /**
   * Lenis 平滑滚动（lenis 为 optional peerDependency，未安装静默回退内置 rAF）：
   * - 传 Lenis 实例：复用宿主实例，组件不负责销毁；
   * - true：点击时动态 import lenis 并自建实例（仅驱动按钮程序滚动，不劫持滚轮）；
   * - 传配置对象：自建实例并透传配置（target 容器自动映射为 wrapper）；
   * - false / 缺省：内置 rAF 缓动。
   */
  lenis?: boolean | ScrollFabLenisConfig | LenisLike;
  /** 异形形状（银杏叶等）；传入后圆形外壳消失，进度沿外扩轮廓包裹 */
  shape?: ScrollFabShape;
  /** 自建 Lenis 实例就绪回调（外部实例注入时不触发），与 onEditorReady 模式对齐 */
  onLenisReady?: (lenis: LenisLike) => void;
  /** 模式①（滚动到底部）无障碍标签 */
  ariaLabelToBottom?: string;
  /** 模式②（返回顶部）无障碍标签 */
  ariaLabelToTop?: string;
  /** 模式翻转回调 */
  onModeChange?: (mode: ScrollFabMode) => void;
}
