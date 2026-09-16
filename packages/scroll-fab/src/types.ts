export type ScrollFabMode = "to-bottom" | "to-top";

/** 悬浮位置（px）；bottom 缺省时自动叠加 safe-area，显式传入则按原值生效 */
export interface ScrollFabPosition {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface ScrollFabOptions {
  /** 滚动容器，null（默认）为 window */
  target?: HTMLElement | null;
  /** 本体直径 px，默认 48，内部钳制最小 44（触控命中区） */
  size?: number;
  /** 按住绕满一圈的时长 ms，默认 800 */
  holdDuration?: number;
  /** 未绕满松手后描边衰减倒转的时长 ms，默认 300 */
  decayDuration?: number;
  /** 按住期间指针位移超过该值（px）视为放弃描边、放行页面手势，默认 10 */
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
  /** 模式①（滚动到底部）无障碍标签 */
  ariaLabelToBottom?: string;
  /** 模式②（返回顶部）无障碍标签 */
  ariaLabelToTop?: string;
  /** 模式翻转回调 */
  onModeChange?: (mode: ScrollFabMode) => void;
}
