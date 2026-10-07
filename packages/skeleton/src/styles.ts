/**
 * 骨架屏 CSS 样式：全部规则静态化，颜色/时长/时序走容器级 --qs-sk-* 变量
 * （AutoSkeleton 写 overlay、renderSkeletonSnapshot 内联容器 div），
 * 无实例参数 → 可单例注入，多容器并存互不覆盖。
 */

/** 测量态样式：文本透明、媒体元素隐藏，保留背景/边框；原地测量不移动子节点 */
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

/** 覆盖层容器样式（挂载于 body，定位到根容器坐标） */
export const SKELETON_OVERLAY_STYLES = `
  .qs-skeleton-overlays {
    position: absolute;
    overflow: hidden;
    pointer-events: none;
    z-index: 9999;
  }
`;

/** 块级渐变位移的动画门槛（两渲染路径共享）：宽 ≥ 48px 且高 ≥ 8px 才建动画层，
 *  低于此宽度流光不可感知，静态灰块更干净 */
export const MIN_ANIMATED_WIDTH = 48;
export const MIN_ANIMATED_HEIGHT = 8;

/** 骨架块样式（纯背景色，读容器级变量）：is-shimmer 块的 ::before 渐变层
 *  transform 滑动（合成器线程零 repaint），overflow:hidden 裁切圆角溢出；
 *  错峰负延迟按文档序递增。 */
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

/** 静态样式全量（单例注入，无实例参数）：动画走合成器线程，全部读容器级变量 */
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
