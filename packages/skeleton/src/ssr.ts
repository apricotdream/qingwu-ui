/**
 * 静态骨架屏 HTML 渲染（快照渲染器）
 *
 * 几何来源：extractElementInfo 的真实 DOM 测量快照
 * （构建时对真实页面测量，非估算）。
 *
 * 与运行时 AutoSkeleton 使用同一测量引擎，几何按构造相等：
 * 构建时快照 → 静态 HTML，运行时覆盖层 → 动态 DOM，
 * 两者形状一致，refetch 场景无缝切换。
 *
 * 动画样式按容器：颜色/时长/时序函数以 CSS 变量（--qs-sk-*）
 * 内联在容器 div 上，块规则读变量——多份快照同页共存互不覆盖。
 *
 * 块级渐变位移：满足门槛（宽 ≥ 48px 且高 ≥ 8px）的块带
 * is-shimmer 类，::before 渐变层 transform 滑动；门槛常量与
 * 运行时 AutoSkeleton 共用，两条路径动画行为一致。
 */

import { MIN_ANIMATED_HEIGHT, MIN_ANIMATED_WIDTH } from "./styles";
import type { RenderSkeletonSnapshotOptions, SkeletonElement } from "./types";

const DEFAULT_MAX_BLOCKS = 200;
const DEFAULT_FALLBACK_BORDER_RADIUS = 4;

/**
 * 将测量快照渲染为 CSS-only 骨架屏 HTML
 *
 * @param snapshot - extractElementInfo 的测量结果（骨架块几何）
 * @param options - 渲染配置
 * @returns 包含内联样式和全部骨架块（含块级渐变动画层）的完整 HTML 字符串
 *
 * @example
 * ```ts
 * import { extractElementInfo, renderSkeletonSnapshot } from "@qingwu-ui/skeleton";
 *
 * // 构建时：对真实页面测量
 * const snapshot = extractElementInfo(document.querySelector(".card-list")!);
 *
 * // 生成静态骨架（桌面断点，宽 1280）
 * const html = renderSkeletonSnapshot(snapshot, { width: 1280 });
 * ```
 */
export function renderSkeletonSnapshot(
  snapshot: SkeletonElement[],
  options: RenderSkeletonSnapshotOptions,
): string {
  const {
    width,
    height,
    shimmerColor = "#f0f0f0",
    backgroundColor = "#e0e0e0",
    duration = 1500,
    timingFunction = "ease-in-out",
    staggerDelay = 80,
    reducedMotion = false,
    maxBlocks = DEFAULT_MAX_BLOCKS,
  } = options;

  // 块数上限截断（性能保护，防止静态骨架 HTML 膨胀）
  const blocks = snapshot.slice(0, maxBlocks);

  const totalHeight = height ?? Math.max(0, ...blocks.map((b) => b.y + b.height));

  // 动画 CSS：每块 ::before 渐变层 transform 滑动（合成器线程），全部读容器级变量
  const animCss = `
    @keyframes qs-shimmer-slide {
      from { transform: translateX(-100%); }
      to { transform: translateX(100%); }
    }
    .qs-skel-block { background: var(--qs-sk-bg, ${backgroundColor}); }
    .qs-skel-block.is-shimmer { overflow: hidden; }
    .qs-skel-block.is-shimmer::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 100%;
      z-index: 1;
      background: linear-gradient(90deg,
        transparent 0%,
        var(--qs-sk-shimmer, ${shimmerColor}) 50%,
        transparent 100%
      );
      animation: qs-shimmer-slide var(--qs-sk-duration, ${duration}ms)
        var(--qs-sk-timing, ${timingFunction}) infinite;
      animation-delay: var(--qs-sk-delay, 0ms);
      will-change: transform;
    }
    .qs-skel-container.is-static .qs-skel-block.is-shimmer::before {
      display: none !important;
    }
  `;

  const blocksHtml = blocks
    .map((b, i) => {
      const br = b.borderRadius === "0px" ? DEFAULT_FALLBACK_BORDER_RADIUS : b.borderRadius;
      // 门槛过滤（与运行时 AutoSkeleton 共用常量）：小块静态，宽块动画
      const isShimmer = b.width >= MIN_ANIMATED_WIDTH && b.height >= MIN_ANIMATED_HEIGHT;
      // 错峰：按文档序递增负延迟（0 关闭错峰）
      const delay = isShimmer && staggerDelay > 0 ? `--qs-sk-delay:-${i * staggerDelay}ms;` : "";
      return `<div class="${isShimmer ? "qs-skel-block is-shimmer" : "qs-skel-block"}" style="
        position:absolute;
        top:${b.y}px;
        left:${b.x}px;
        width:${b.width}px;
        height:${b.height}px;
        border-radius:${br};
        ${delay}
      "></div>`;
    })
    .join("\n");

  return [
    "<style>",
    animCss,
    "</style>",
    `<div class="qs-skel-container${reducedMotion ? " is-static" : ""}" style="
      position:relative;
      width:${width}px;
      height:${totalHeight}px;
      overflow:hidden;
      --qs-sk-shimmer:${shimmerColor};
      --qs-sk-bg:${backgroundColor};
      --qs-sk-duration:${duration}ms;
      --qs-sk-timing:${timingFunction};
    " role="status" aria-label="加载中">`,
    blocksHtml,
    "<span style='position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)'>加载中...</span>",
    "</div>",
  ].join("\n");
}
