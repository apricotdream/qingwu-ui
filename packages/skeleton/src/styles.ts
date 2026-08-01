/**
 * 骨架屏 CSS 样式
 *
 * 全部规则静态化 + CSS 变量驱动：
 * 颜色/时长/时序函数通过 per-instance 变量（--qs-sk-*）表达，
 * 变量由 AutoSkeleton 写在 overlay 元素上、renderSkeletonSnapshot
 * 内联在容器 div 上。注入的 CSS 无任何实例参数 → 可安全单例化，
 * 多容器并存零互相覆盖。
 */

/**
 * 测量态样式 —— 使文本透明、隐藏媒体元素
 * 保留元素背景和边框，让骨架流光显示在其上方
 *
 * 原地测量：真实内容留在原位，仅通过根容器上的
 * qs-skeleton-measuring 类透明化，不移动任何子节点。
 */
export const SKELETON_MEASURING_STYLES = `
  .qs-skeleton-measuring *:not([data-skeleton-ignore], [data-skeleton-ignore] *) {
    color: transparent !important;
  }
  .qs-skeleton-measuring img:not([data-skeleton-ignore], [data-skeleton-ignore] *),
  .qs-skeleton-measuring svg:not([data-skeleton-ignore], [data-skeleton-ignore] *),
  .qs-skeleton-measuring video:not([data-skeleton-ignore], [data-skeleton-ignore] *) {
    opacity: 0;
  }

  /* 隐藏 data-skeleton-no-children 子元素的背景 */
  .qs-skeleton-measuring [data-skeleton-no-children] * {
    background: transparent !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }
`;

/**
 * 覆盖层容器样式（挂载于 body，定位到根容器坐标）
 */
export const SKELETON_OVERLAY_STYLES = `
  .qs-skeleton-overlays {
    position: absolute;
    overflow: hidden;
    pointer-events: none;
    z-index: 9999;
  }
`;

/**
 * 块级渐变位移的动画门槛（共享常量，两条渲染路径强制一致）：
 * 块宽 ≥ 48px 且高 ≥ 8px 才建动画层——渐变色带高亮区约占块宽一半，
 * 低于此宽度扫过不可感知（闪一下而非扫过），纯静态灰块更干净且零层开销。
 */
export const MIN_ANIMATED_WIDTH = 48;
export const MIN_ANIMATED_HEIGHT = 8;

/**
 * 骨架块样式（纯背景色，读容器级变量）
 *
 * 块级渐变位移：满足门槛的块带 is-shimmer 类，其 ::before
 * 伪元素渐变层做 transform 滑动（合成器线程，零主线程 repaint），
 * 块 overflow:hidden 裁切圆角外溢出。错峰：每块 --qs-sk-delay
 * 负延迟递增（文档序），首帧即级联流水。
 */
export const SKELETON_BLOCK_STYLES = `
  .qs-skeleton-overlay {
    position: absolute;
    background: var(--qs-sk-bg, #e0e0e0);
  }
  .qs-skeleton-overlay.is-shimmer {
    overflow: hidden;
  }
  .qs-skeleton-overlay.is-shimmer::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    z-index: 1;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--qs-sk-shimmer, #f0f0f0) 50%,
      transparent 100%
    );
    animation: qs-shimmer-slide var(--qs-sk-duration, 1500ms)
      var(--qs-sk-timing, ease-in-out) infinite;
    /* 错峰：每块负延迟（--qs-sk-delay 写在块上，继承到 ::before） */
    animation-delay: var(--qs-sk-delay, 0ms);
    will-change: transform;
  }

  /* reduced-motion 降级：隐藏全部动画层，块退回静态色 */
  .qs-skeleton-overlays.is-static .qs-skeleton-overlay.is-shimmer::before {
    display: none !important;
  }
`;

/**
 * 静态样式全量（单例注入，无实例参数）
 *
 * 动画：每块 ::before 渐变层 transform 滑动（合成器线程，
 * 零主线程 repaint）；时长/颜色/时序函数全部读容器级变量。
 */
export const SKELETON_STATIC_STYLES = [
  SKELETON_MEASURING_STYLES,
  SKELETON_OVERLAY_STYLES,
  SKELETON_BLOCK_STYLES,
  `
  @keyframes qs-shimmer-slide {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
  }
  `,
].join("\n");
