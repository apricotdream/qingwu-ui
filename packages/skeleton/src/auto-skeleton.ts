/**
 * AutoSkeleton —— 自动骨架屏组件
 *
 * 包装任意 DOM 内容，在加载态自动测量 DOM 结构并生成闪烁骨架覆盖层。
 * 零布局重复：真实内容只写一次，骨架由运行时测量自动生成。
 *
 * 用法：
 * ```ts
 * import { AutoSkeleton } from "@qingwu/skeleton";
 * import "@qingwu/skeleton/style.css";
 *
 * const container = document.getElementById("product-card");
 * const skeleton = new AutoSkeleton(container, { loading: true });
 *
 * // 数据加载完成后
 * skeleton.update({ loading: false });
 *
 * // 销毁
 * skeleton.destroy();
 * ```
 */

import type { AutoSkeletonOptions, SkeletonElement } from "./types";
import { extractElementInfo } from "./core";
import {
  SKELETON_MEASURE_STYLES,
  SKELETON_WRAPPER_STYLES,
  shimmerAnimationKeyframes,
} from "./styles";

const DEFAULT_OPTIONS: Required<
  Pick<
    AutoSkeletonOptions,
    "shimmerColor" | "backgroundColor" | "duration" | "fallbackBorderRadius" | "ssr" | "maxElements"
  >
> = {
  shimmerColor: "#f0f0f0",
  backgroundColor: "#e0e0e0",
  duration: 1500,
  fallbackBorderRadius: 4,
  ssr: false,
  maxElements: 500,
};

export class AutoSkeleton {
  private root: HTMLElement;
  private options: AutoSkeletonOptions;

  private wrapper: HTMLDivElement | null = null;
  private measureEl: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private styleEl: HTMLStyleElement | null = null;

  private originalChildren: ChildNode[] = [];
  private elements: SkeletonElement[] = [];
  private isDestroyed = false;

  private resizeRaf: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(root: HTMLElement, options: AutoSkeletonOptions = { loading: true }) {
    this.root = root;
    this.options = options;

    // 检测 reduced-motion 偏好
    if (this.options.reducedMotion === undefined) {
      try {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        this.options.reducedMotion = mq.matches;
      } catch {
        this.options.reducedMotion = false;
      }
    }

    // 快照原始子节点
    this.originalChildren = Array.from(root.childNodes);

    if (this.options.loading) {
      this.renderLoading();
    }
  }

  /**
   * 更新配置并重新渲染
   */
  update(options: Partial<AutoSkeletonOptions>): void {
    if (this.isDestroyed) return;

    const prevLoading = this.options.loading;
    Object.assign(this.options, options);

    const nowLoading = this.options.loading;

    // 加载态切换
    if (prevLoading && !nowLoading) {
      this.teardownLoading();
    } else if (!prevLoading && nowLoading) {
      this.syncOriginalChildren();
      this.renderLoading();
    } else if (nowLoading) {
      // 仍在加载态但配置变化：重测 DOM
      this.measureAndRender();
    }
  }

  /**
   * 销毁骨架屏，恢复原始 DOM
   */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.teardownLoading();
    this.cleanupResizeObserver();

    if (this.resizeRaf !== null) {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = null;
    }
  }

  // ─── 私有方法 ───

  /** 进入加载态 */
  private renderLoading(): void {
    this.elements = [];

    // 创建 wrapper
    this.wrapper = document.createElement("div");
    this.wrapper.className = "qs-skeleton-wrapper";

    // 注入 CSS
    this.styleEl = document.createElement("style");
    this.styleEl.textContent = this.buildStyles();
    this.wrapper.appendChild(this.styleEl);

    // 测量容器：渲染原始内容，文本透明
    this.measureEl = document.createElement("div");
    this.measureEl.className = "qs-skeleton-measure";
    this.measureEl.style.cssText = "pointer-events:none;";
    this.measureEl.setAttribute("aria-hidden", "true");

    // 将原始子节点移入测量容器
    for (const child of this.originalChildren) {
      this.measureEl.appendChild(child);
    }
    this.wrapper.appendChild(this.measureEl);

    // 覆盖层容器
    this.overlayEl = document.createElement("div");
    this.overlayEl.style.cssText =
      "position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;";
    this.wrapper.appendChild(this.overlayEl);

    // 替换 root 内容
    this.root.textContent = "";
    this.root.appendChild(this.wrapper);

    // 测量 DOM 并渲染覆盖层
    this.measureAndRender();

    // 监听尺寸变化
    this.setupResizeObserver();
  }

  /** 测量 DOM 结构并生成骨架覆盖层 */
  private measureAndRender(): void {
    if (!this.measureEl || !this.overlayEl) return;

    try {
      this.elements = extractElementInfo(
        this.measureEl,
        this.options.maxElements ?? DEFAULT_OPTIONS.maxElements,
      );

      this.renderOverlays();
    } catch (err) {
      console.error("[AutoSkeleton] DOM 测量失败:", err);
    }
  }

  /** 渲染覆盖层 */
  private renderOverlays(): void {
    if (!this.overlayEl) return;

    // 清空已有覆盖层
    this.overlayEl.textContent = "";

    const fallbackRadius = this.options.fallbackBorderRadius ??
      DEFAULT_OPTIONS.fallbackBorderRadius;
    const bg = this.options.backgroundColor ?? DEFAULT_OPTIONS.backgroundColor;

    for (const el of this.elements) {
      const div = document.createElement("div");
      div.className = "qs-skeleton-overlay";
      div.style.cssText = [
        `position:absolute;`,
        `left:${el.x}px;`,
        `top:${el.y}px;`,
        `width:${el.width}px;`,
        `height:${el.height}px;`,
        `border-radius:${el.borderRadius === "0px" ? `${fallbackRadius}px` : el.borderRadius};`,
      ].join("");

      // 非流光动画时使用静态背景
      if (this.options.reducedMotion) {
        div.style.background = bg;
      }

      this.overlayEl!.appendChild(div);
    }
  }

  /** 退出加载态，恢复真实内容 */
  private teardownLoading(): void {
    this.cleanupResizeObserver();

    // 如果原始子节点在测量容器内，但 wrapper 还在，先取回
    if (this.measureEl) {
      const children = Array.from(this.measureEl.childNodes);
      for (const child of children) {
        this.root.appendChild(child);
      }
    }

    // 如果测量容器已经被移除（子节点通过 wrapper 间接挂载），从 wrapper 取出
    if (this.wrapper && this.wrapper.parentNode === this.root) {
      // 检查是否有子节点在 measureEl 内
      if (this.measureEl) {
        const children = Array.from(this.measureEl.childNodes);
        for (const child of children) {
          this.root.appendChild(child);
        }
      }
      this.root.removeChild(this.wrapper);
    }

    this.wrapper = null;
    this.measureEl = null;
    this.overlayEl = null;
    this.styleEl = null;
    this.elements = [];
  }

  /** 同步最新子节点快照（用于 loading 来回切换） */
  private syncOriginalChildren(): void {
    this.originalChildren = Array.from(this.root.childNodes);
  }

  /** 构建 CSS 样式 */
  private buildStyles(): string {
    const reducedMotion = this.options.reducedMotion ?? false;
    return [
      SKELETON_WRAPPER_STYLES,
      SKELETON_MEASURE_STYLES,
      shimmerAnimationKeyframes({
        shimmerColor: this.options.shimmerColor ?? DEFAULT_OPTIONS.shimmerColor,
        backgroundColor: this.options.backgroundColor ?? DEFAULT_OPTIONS.backgroundColor,
        duration: this.options.duration ?? DEFAULT_OPTIONS.duration,
        reducedMotion,
      }),
    ].join("\n");
  }

  /** 设置 ResizeObserver 监听尺寸变化 */
  private setupResizeObserver(): void {
    if (!this.measureEl) return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeRaf) {
        cancelAnimationFrame(this.resizeRaf);
      }
      this.resizeRaf = requestAnimationFrame(() => {
        if (!this.isDestroyed && this.options.loading) {
          this.measureAndRender();
        }
        this.resizeRaf = null;
      });
    });

    this.resizeObserver.observe(this.measureEl);
  }

  /** 清理 ResizeObserver */
  private cleanupResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}
