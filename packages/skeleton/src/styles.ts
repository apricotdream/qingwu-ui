/**
 * 骨架屏 CSS 样式
 */

/**
 * 测量容器样式 —— 使文本透明、隐藏媒体元素
 * 保留元素背景和边框，让骨架流光显示在其上方
 */
export const SKELETON_MEASURE_STYLES = `
  .qs-skeleton-measure *:not([data-skeleton-ignore], [data-skeleton-ignore] *) {
    color: transparent !important;
  }
  .qs-skeleton-measure img:not([data-skeleton-ignore], [data-skeleton-ignore] *),
  .qs-skeleton-measure svg:not([data-skeleton-ignore], [data-skeleton-ignore] *),
  .qs-skeleton-measure video:not([data-skeleton-ignore], [data-skeleton-ignore] *) {
    opacity: 0;
  }

  /* 隐藏 data-skeleton-no-children 子元素的背景 */
  .qs-skeleton-measure [data-skeleton-no-children] * {
    background: transparent !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }
`;

/**
 * 生成闪光动画 CSS
 */
export function shimmerAnimationKeyframes({
  shimmerColor = "#f0f0f0",
  backgroundColor = "#e0e0e0",
  duration = 1500,
  reducedMotion = false,
}: {
  shimmerColor?: string;
  backgroundColor?: string;
  duration?: number;
  reducedMotion?: boolean;
}): string {
  if (reducedMotion) {
    return `
      .qs-skeleton-overlay {
        background: ${backgroundColor} !important;
        animation: none !important;
      }
    `;
  }
  return `
    @keyframes qs-shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
    .qs-skeleton-overlay {
      background: linear-gradient(
        90deg,
        ${backgroundColor} 0%,
        ${shimmerColor} 40%,
        ${shimmerColor} 60%,
        ${backgroundColor} 100%
      );
      background-size: 200% 100%;
      animation: qs-shimmer ${duration}ms ease-in-out infinite;
    }
  `;
}

/** 容器 wrapper 样式 */
export const SKELETON_WRAPPER_STYLES = `
  .qs-skeleton-wrapper {
    position: relative;
    overflow: hidden;
  }
`;
