/**
 * AutoSkeleton —— 自动骨架屏组件
 *
 * 原地测量：真实内容从不移动、从不被包裹，仅通过根容器上的
 * qs-skeleton-measuring 类透明化（保留布局）；覆盖层以 portal
 * 形式挂载到 body，坐标对齐根容器。任何框架（React/Vue/vanilla）
 * 的 DOM 所有权都保持完整，加载态期间 re-render/卸载零风险。
 *
 * 动画样式按容器：颜色/时长/时序函数通过 per-instance CSS 变量
 * （--qs-sk-*）写在 overlay 元素上，全局样式单例注入（引用计数），
 * 多容器并存零互相覆盖。
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
import { extractElementInfo, structureSignature } from "./core";
import { MIN_ANIMATED_HEIGHT, MIN_ANIMATED_WIDTH, SKELETON_STATIC_STYLES } from "./styles";

// ─── 视口增量渲染常量 ───
// 预取：视口外 ±1 屏范围内的块也渲染（滚动体感无缝，合成层仍约两屏量级）
const RENDER_PREFETCH_VIEWPORTS = 1;
// 已渲染块上限：极端长页滚到底也不会无限堆积 DOM/合成层，
// 超限后淘汰视口外（±1 屏外）的块，滚回时按需重渲染
const MAX_RENDERED_BLOCKS = 500;

const DEFAULT_OPTIONS: Required<
  Pick<
    AutoSkeletonOptions,
    "shimmerColor" | "backgroundColor" | "duration" | "staggerDelay" | "zIndex" | "fallbackBorderRadius" | "maxElements"
  >
> = {
  shimmerColor: "#f0f0f0",
  backgroundColor: "#e0e0e0",
  duration: 1500,
  staggerDelay: 80,
  zIndex: 9999,
  fallbackBorderRadius: 4,
  maxElements: 500,
};

// ─── 单例样式注入（引用计数） ───
// 注入内容完全静态（无实例参数），多实例共享同一个 style 节点，
// 最后一个实例销毁时移除。
let sharedStyleEl: HTMLStyleElement | null = null;
let sharedStyleRefs = 0;

function injectStaticStyles(): void {
  if (sharedStyleRefs === 0) {
    sharedStyleEl = document.createElement("style");
    sharedStyleEl.textContent = SKELETON_STATIC_STYLES;
    document.head.appendChild(sharedStyleEl);
  }
  sharedStyleRefs++;
}

function releaseStaticStyles(): void {
  sharedStyleRefs--;
  if (sharedStyleRefs <= 0 && sharedStyleEl) {
    sharedStyleEl.parentNode?.removeChild(sharedStyleEl);
    sharedStyleEl = null;
    sharedStyleRefs = 0;
  }
}

export class AutoSkeleton {
  private root: HTMLElement;
  private options: AutoSkeletonOptions;

  private overlayEl: HTMLDivElement | null = null;

  private elements: SkeletonElement[] = [];
  private isDestroyed = false;

  private resizeRaf: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scrollHandler: (() => void) | null = null;

  // refetch 自适应：结构变化观察（rAF 合并 + 签名比对）
  private mutationObserver: MutationObserver | null = null;
  private mutationRaf: number | null = null;
  private structureHash: string | null = null;

  // 视口增量渲染簿记（滚动增量 rAF 独立，避免与结构变化的 rAF 互相吞掉）
  private scrollRaf: number | null = null;
  private renderedFlags: boolean[] = [];
  private renderedBlocks: Array<{
    div: HTMLDivElement;
    y: number;
    height: number;
    index: number;
  }> = [];

  // 加载期位置守卫：rAF 每帧比对根容器文档坐标（rect + scroll），
  // 变化即重定位 + 重测。纯滚动时文档坐标恒定（rect 与 scrollY 抵消），
  // 布局沉降/内容重排会变——ResizeObserver 只报尺寸变化，管不到这些。
  private watchRaf: number | null = null;
  private lastDocPos: { left: number; top: number } | null = null;
  private lastMeasureAt = 0;

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

    if (this.options.loading) {
      this.renderLoading();
    }
  }

  /**
   * 覆盖层 DOM（portal 挂载于 body，加载态存在）。
   * 可用于自定义退出动画，如 overlay.classList.add("is-exiting") 后延迟 update。
   */
  get overlay(): HTMLDivElement | null {
    return this.overlayEl;
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
      this.renderLoading();
    } else if (nowLoading) {
      // 仍在加载态但配置变化：重测 DOM + 刷新动画变量
      this.applyAnimationVars();
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
  }

  // ─── 私有方法 ───

  /** 进入加载态 */
  private renderLoading(): void {
    this.elements = [];

    // 注入静态样式（单例）
    injectStaticStyles();

    // 覆盖层 portal：挂载到 body，坐标对齐根容器
    this.overlayEl = document.createElement("div");
    this.overlayEl.className = "qs-skeleton-overlays";
    this.overlayEl.setAttribute("aria-hidden", "true");
    this.applyAnimationVars();
    this.positionOverlay();
    document.body.appendChild(this.overlayEl);

    // 原地测量：透明化真实内容（不移动、不包裹）
    this.root.classList.add("qs-skeleton-measuring");

    // 测量 DOM 并渲染覆盖层
    this.measureAndRender();

    // 记录当前结构签名（作为 refetch 自适应重测的比对基线）
    this.structureHash = structureSignature(this.root);

    // 监听尺寸、滚动与结构变化；启动位置守卫（平移跟随）
    this.setupObservers();
    this.startPositionWatch();
  }

  /** 将 per-instance 动画变量写入覆盖层（多容器互不覆盖） */
  private applyAnimationVars(): void {
    if (!this.overlayEl) return;

    const style = this.overlayEl.style;
    style.setProperty(
      "--qs-sk-shimmer",
      this.options.shimmerColor ?? DEFAULT_OPTIONS.shimmerColor,
    );
    style.setProperty(
      "--qs-sk-bg",
      this.options.backgroundColor ?? DEFAULT_OPTIONS.backgroundColor,
    );
    style.setProperty(
      "--qs-sk-duration",
      `${this.options.duration ?? DEFAULT_OPTIONS.duration}ms`,
    );
    style.setProperty("--qs-sk-timing", this.options.timingFunction ?? "ease-in-out");

    // z-index：默认压在页面上层；页面 chrome 需在骨架之上时调低
    style.zIndex = String(this.options.zIndex ?? DEFAULT_OPTIONS.zIndex);

    // reduced-motion：静态色块降级
    this.overlayEl.classList.toggle("is-static", this.options.reducedMotion === true);
  }

  /** 将覆盖层定位到根容器当前坐标（文档坐标）；rect 可传入已读取值避免二次回流 */
  private positionOverlay(rect?: DOMRect): void {
    if (!this.overlayEl) return;

    const r = rect ?? this.root.getBoundingClientRect();
    this.overlayEl.style.left = `${r.left + window.scrollX}px`;
    this.overlayEl.style.top = `${r.top + window.scrollY}px`;
    this.overlayEl.style.width = `${r.width}px`;
    this.overlayEl.style.height = `${r.height}px`;
  }

  /**
   * 加载期位置守卫：rAF 每帧比对根容器**文档坐标**（rect + scroll，
   * 布局干净时读取为缓存命中，无额外回流）：
   * - 纯滚动：文档坐标恒定（rect 与 scrollY 抵消）→ 零操作
   * - 布局沉降/内容重排（路由回退、上方内容高度变化等）：文档坐标变化
   *   → 重定位覆盖层 + 重测重渲染块几何（节流 100ms，防持续位移抖动）
   * ResizeObserver 只报尺寸变化，此守卫补其盲区。
   */
  private startPositionWatch(): void {
    const init = this.root.getBoundingClientRect();
    this.lastDocPos = { left: init.left + window.scrollX, top: init.top + window.scrollY };
    this.lastMeasureAt = 0;

    const tick = () => {
      this.watchRaf = requestAnimationFrame(tick);
      if (this.isDestroyed || !this.options.loading) return;

      const rect = this.root.getBoundingClientRect();
      const docX = rect.left + window.scrollX;
      const docY = rect.top + window.scrollY;
      const last = this.lastDocPos;
      this.lastDocPos = { left: docX, top: docY };
      if (!last || (docX === last.left && docY === last.top)) return;

      // 文档位置变了：先跟随定位（每帧都跟），再重测块几何（节流）
      this.positionOverlay(rect);
      const now = performance.now();
      if (now - this.lastMeasureAt > 100) {
        this.lastMeasureAt = now;
        this.measureAndRender();
      }
    };
    this.watchRaf = requestAnimationFrame(tick);
  }

  /** 测量 DOM 结构并生成骨架覆盖层 */
  private measureAndRender(): void {
    if (!this.overlayEl) return;

    try {
      this.elements = extractElementInfo(
        this.root,
        this.options.maxElements ?? DEFAULT_OPTIONS.maxElements,
      );

      this.renderOverlays();
    } catch (err) {
      console.error("[AutoSkeleton] DOM 测量失败:", err);
    }
  }

  /** 渲染覆盖层（视口过滤：只渲染 ±1 屏范围内的块，滚动时增量补渲） */
  private renderOverlays(): void {
    if (!this.overlayEl) return;

    // 清空已有覆盖层
    this.overlayEl.textContent = "";
    this.renderedBlocks = [];
    this.renderedFlags = new Array(this.elements.length).fill(false);

    const range = this.renderRange();

    for (const [i, el] of this.elements.entries()) {
      // 视口外（±1 屏外）的块不渲染：省 DOM 与合成层，滚动时增量补渲
      if (el.y > range.bottom || el.y + el.height < range.top) continue;

      const div = this.createBlockDiv(el, i);
      this.renderedBlocks.push({ div, y: el.y, height: el.height, index: i });
      this.renderedFlags[i] = true;
      this.overlayEl!.appendChild(div);
    }

    this.pruneBlocks();
  }

  /** 当前渲染区间：视口 ±1 屏（预取，滚动体感无缝） */
  private renderRange(): { top: number; bottom: number } {
    const viewport = window.innerHeight * RENDER_PREFETCH_VIEWPORTS;
    return {
      top: window.scrollY - viewport,
      bottom: window.scrollY + window.innerHeight + viewport,
    };
  }

  /** 创建单个覆盖层块（门槛过滤 is-shimmer + 错峰负延迟） */
  private createBlockDiv(el: SkeletonElement, index: number): HTMLDivElement {
    const fallbackRadius = this.options.fallbackBorderRadius ??
      DEFAULT_OPTIONS.fallbackBorderRadius;

    const div = document.createElement("div");
    div.className = "qs-skeleton-overlay";

    div.style.cssText = [
      `left:${el.x}px;`,
      `top:${el.y}px;`,
      `width:${el.width}px;`,
      `height:${el.height}px;`,
      `border-radius:${el.borderRadius === "0px" ? `${fallbackRadius}px` : el.borderRadius};`,
    ].join("");

    // 门槛过滤：宽 ≥ 48px 且高 ≥ 8px 的块建动画层（::before 渐变滑动），
    // 小碎块（头像/图标/分隔线）保持静态，动画不可感知且省合成层
    if (el.width >= MIN_ANIMATED_WIDTH && el.height >= MIN_ANIMATED_HEIGHT) {
      div.classList.add("is-shimmer");
      // 错峰：按文档序递增负延迟（写在 cssText 之后，避免被覆盖），
      // 首帧即级联流水；0 关闭错峰
      const staggerDelay = this.options.staggerDelay ?? DEFAULT_OPTIONS.staggerDelay;
      if (staggerDelay > 0) {
        div.style.setProperty("--qs-sk-delay", `-${index * staggerDelay}ms`);
      }
    }
    return div;
  }

  /**
   * 滚动增量补渲（append-only）：渲染新进入 ±1 屏范围的块；
   * 超过 MAX_RENDERED_BLOCKS 上限时淘汰视口外（±1 屏外）的块，
   * 滚回时按需重渲（双向替换，DOM/合成层有界）。
   */
  private renderVisibleBlocks(): void {
    if (!this.overlayEl) return;

    const range = this.renderRange();

    for (const [i, el] of this.elements.entries()) {
      if (this.renderedFlags[i]) continue;
      if (el.y > range.bottom || el.y + el.height < range.top) continue;

      const div = this.createBlockDiv(el, i);
      this.renderedBlocks.push({ div, y: el.y, height: el.height, index: i });
      this.renderedFlags[i] = true;
      this.overlayEl!.appendChild(div);
    }

    this.pruneBlocks();
  }

  /** 上限保护：淘汰视口外（±1 屏外）的块，保持 DOM/合成层有界 */
  private pruneBlocks(): void {
    if (this.renderedBlocks.length <= MAX_RENDERED_BLOCKS) return;

    const range = this.renderRange();
    const kept: typeof this.renderedBlocks = [];
    for (const block of this.renderedBlocks) {
      if (block.y > range.bottom || block.y + block.height < range.top) {
        block.div.remove();
        this.renderedFlags[block.index] = false;
      } else {
        kept.push(block);
      }
    }
    this.renderedBlocks = kept;
  }

  /** 退出加载态，恢复真实内容 */
  private teardownLoading(): void {
    this.cleanupObservers();

    // 移除测量类，恢复真实内容可见性
    this.root.classList.remove("qs-skeleton-measuring");

    // 移除覆盖层 portal
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;

    // 释放单例样式
    releaseStaticStyles();

    this.elements = [];
  }

  /** 监听尺寸与滚动变化 */
  private setupObservers(): void {
    // ResizeObserver：尺寸变化时重定位 + 重测量（rAF 合并，单次回流）
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeRaf) {
        cancelAnimationFrame(this.resizeRaf);
      }
      this.resizeRaf = requestAnimationFrame(() => {
        if (!this.isDestroyed && this.options.loading) {
          this.positionOverlay();
          this.measureAndRender();
        }
        this.resizeRaf = null;
      });
    });

    this.resizeObserver.observe(this.root);

    // 滚动跟随：捕获阶段可收到任意滚动容器的滚动；
    // 同时 rAF 合并做增量补渲（独立 rAF，不与结构变化的 rAF 互吞）
    this.scrollHandler = () => {
      if (this.isDestroyed || !this.options.loading) return;

      // 防御：根容器已脱离文档（消费端未 destroy 就卸载）→ 自毁清理。
      // 否则孤儿实例的 positionOverlay 对 detached 元素取全零 rect，
      // 覆盖层会被钉在视口左上角跟随滚动，形成漂浮的位移骨架。
      if (!this.root.isConnected) {
        this.isDestroyed = true;
        this.teardownLoading();
        return;
      }

      this.positionOverlay();
      if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = requestAnimationFrame(() => {
        this.scrollRaf = null;
        if (this.isDestroyed || !this.options.loading) return;
        this.renderVisibleBlocks();
      });
    };
    window.addEventListener("scroll", this.scrollHandler, {
      capture: true,
      passive: true,
    });

    // refetch 自适应：结构变化 → rAF 合并 → 签名比对 → 变了才重测重渲。
    // 文本只比长度（换行数随长度变），同长内容变化不触发；宁可错报不可漏报。
    this.mutationObserver = new MutationObserver(() => {
      if (this.mutationRaf) cancelAnimationFrame(this.mutationRaf);
      this.mutationRaf = requestAnimationFrame(() => {
        this.mutationRaf = null;
        if (this.isDestroyed || !this.options.loading) return;
        const sig = structureSignature(this.root);
        if (sig !== this.structureHash) {
          this.structureHash = sig;
          this.measureAndRender();
        }
      });
    });
    this.mutationObserver.observe(this.root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  }

  /** 清理观察者与监听器 */
  private cleanupObservers(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler, {
        capture: true,
        passive: true,
      } as EventListenerOptions);
      this.scrollHandler = null;
    }
    if (this.resizeRaf !== null) {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = null;
    }
    if (this.mutationRaf !== null) {
      cancelAnimationFrame(this.mutationRaf);
      this.mutationRaf = null;
    }
    if (this.scrollRaf !== null) {
      cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = null;
    }
    if (this.watchRaf !== null) {
      cancelAnimationFrame(this.watchRaf);
      this.watchRaf = null;
    }
    this.lastDocPos = null;
    this.renderedBlocks = [];
    this.renderedFlags = [];
  }
}
