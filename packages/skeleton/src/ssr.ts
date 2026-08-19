/**
 * 静态骨架屏 HTML 渲染（快照渲染器）：几何来自 extractElementInfo 真实测量快照，
 * 与运行时 AutoSkeleton 同引擎（refetch 无缝切换）；样式走容器级 --qs-sk-* 变量，
 * 门槛常量共用，两条路径动画行为一致。
 */

import { MIN_ANIMATED_HEIGHT, MIN_ANIMATED_WIDTH } from "./styles";
import type { RenderSkeletonSnapshotOptions, SkeletonElement } from "./types";

const DEFAULT_MAX_BLOCKS = 200;
const DEFAULT_FALLBACK_BORDER_RADIUS = 4;

/** 将测量快照渲染为 CSS-only 骨架屏 HTML（内联样式 + 全部骨架块）。
 *  例：const snap = extractElementInfo(dom); renderSkeletonSnapshot(snap, { width: 1280 }) */
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
