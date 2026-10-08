/** 青梧UI ScrollFab 悬浮滚动栏：默认“滚动到底部”，桌面悬停/触屏按住绕满描边一圈翻转为“返回顶部”，点击（轻点）直接执行当前模式动作 */

import { ICON_CHEVRON_DOWN } from "../../../icon/icons";
import type {
  LenisLike,
  ScrollFabLenisConfig,
  ScrollFabMode,
  ScrollFabOptions,
  ScrollFabShape,
} from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const RADIUS = 21;
const FALLBACK_PATH_LEN = 100;
const DEFAULT_LABEL_BOTTOM = "滚动到底部（悬停或按住绕圈可切换为返回顶部）";
const DEFAULT_LABEL_TOP = "返回顶部（悬停或按住绕圈可切换为滚动到底部）";
const STATIC_LABEL_BOTTOM = "滚动到底部";
const STATIC_LABEL_TOP = "返回顶部";

function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
}

function isLenisInstance(v: unknown): v is LenisLike {
  return typeof v === "object" && v !== null && typeof (v as LenisLike).scrollTo === "function";
}

export class ScrollFab {
  readonly el: HTMLButtonElement;

  private ring: SVGGeometryElement;
  private track: SVGGeometryElement;
  private fillPath: SVGPathElement | null = null;
  private readonly icon: HTMLElement;
  private len: number;

  private readonly targetEl: HTMLElement | null;
  private readonly shape: ScrollFabShape | null;
  private readonly ringMs: number;
  private readonly decayMs: number;
  private readonly cancelPx: number;
  private readonly animate: boolean;
  private readonly labelBottom: string;
  private readonly labelTop: string;
  private readonly onModeChange?: (mode: ScrollFabMode) => void;
  private readonly onLenisReady?: (lenis: LenisLike) => void;
  private readonly onScroll?: (pct: number) => void;
  private readonly modes: ScrollFabMode[];
  private readonly single: boolean;
  private readonly threshold: number;

  /** 外部注入：宿主实例，组件永不销毁 */
  private externalLenis: LenisLike | null = null;
  /** 自建配置：null = 不走 lenis；true 形态也归一成对象 */
  private ownLenisConfig: ScrollFabLenisConfig | null = null;
  private ownLenis: LenisLike | null = null;
  private ownLenisPromise: Promise<LenisLike | null> | null = null;

  private mode: ScrollFabMode;
  private progress = 0;
  private hovering = false;
  private pressing = false;
  private flipped = false;
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private ringRaf: number | null = null;
  private lastTs: number | null = null;
  private scrollRaf: number | null = null;
  private lenisLoopRaf: number | null = null;
  private lenisScrolling = false;
  private lenisDest: "bottom" | "top" | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private tapResetTimer: ReturnType<typeof setTimeout> | null = null;
  private touchTap = false;
  private ro: ResizeObserver | null = null;
  private actionSeq = 0;
  private destroyed = false;
  private emitRaf: number | null = null;
  private lastPct = -1;

  constructor(options: ScrollFabOptions = {}) {
    this.targetEl = options.target ?? null;
    this.shape = options.shape ?? null;
    this.ringMs = Math.max(100, Math.min(5000, options.ringDuration ?? 800));
    this.decayMs = Math.max(100, options.decayDuration ?? 300);
    this.cancelPx = Math.max(4, options.cancelThreshold ?? 10);
    this.animate = options.animate ?? true;
    this.threshold = Math.max(0, options.showThreshold ?? 0);
    this.onModeChange = options.onModeChange;
    this.onLenisReady = options.onLenisReady;
    this.onScroll = options.onScroll;

    this.modes = this.normalizeModes(options.modes);
    this.single = this.modes.length === 1;
    this.mode = this.modes[0]!;

    this.labelBottom =
      options.ariaLabelToBottom ?? (this.single ? STATIC_LABEL_BOTTOM : DEFAULT_LABEL_BOTTOM);
    this.labelTop = options.ariaLabelToTop ?? (this.single ? STATIC_LABEL_TOP : DEFAULT_LABEL_TOP);

    if (isLenisInstance(options.lenis)) {
      this.externalLenis = options.lenis;
    } else if (options.lenis != null && options.lenis !== false) {
      const cfg = options.lenis === true ? {} : options.lenis;
      // 自建实例默认不劫持宿主滚轮：只驱动按钮触发的程序滚动
      this.ownLenisConfig = { smoothWheel: false, ...cfg };
    }

    this.el = document.createElement("button");
    this.el.type = "button";
    this.el.className = `qsf-root${options.className ? ` ${options.className}` : ""}`;
    this.el.dataset.mode = this.mode;
    if (this.shape) this.el.dataset.shape = "on";
    this.el.setAttribute(
      "aria-label",
      this.mode === "to-bottom" ? this.labelBottom : this.labelTop,
    );
    this.el.style.setProperty("--qsf-size", `${Math.max(44, options.size ?? 48)}px`);
    if (options.zIndex != null) this.el.style.setProperty("--qsf-z", String(options.zIndex));
    if (options.position?.right != null)
      this.el.style.setProperty("--qsf-right", `${options.position.right}px`);
    if (options.position?.bottom != null)
      this.el.style.setProperty("--qsf-bottom", `${options.position.bottom}px`);
    if (options.position?.left != null)
      this.el.style.setProperty("--qsf-left", `${options.position.left}px`);
    if (options.position?.top != null)
      this.el.style.setProperty("--qsf-top", `${options.position.top}px`);

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "qsf-svg");
    svg.setAttribute("viewBox", this.shape?.viewBox ?? "0 0 48 48");
    svg.setAttribute("aria-hidden", "true");

    if (this.shape) {
      this.fillPath = document.createElementNS(SVG_NS, "path");
      this.fillPath.setAttribute("class", "qsf-shape-fill");
      this.fillPath.setAttribute("d", this.shape.fill);
      this.track = this.makePath("qsf-track", this.shape.outline);
      this.ring = this.makePath("qsf-bar", this.shape.outline);
      if (this.shape.outlineTransform) {
        this.track.setAttribute("transform", this.shape.outlineTransform);
        this.ring.setAttribute("transform", this.shape.outlineTransform);
      }
      svg.append(this.fillPath, this.track, this.ring);
    } else {
      this.track = this.makeCircle("qsf-track");
      this.ring = this.makeCircle("qsf-bar");
      svg.append(this.track, this.ring);
    }

    let len: number;
    if (this.shape) {
      len = FALLBACK_PATH_LEN;
    } else {
      len = 2 * Math.PI * RADIUS;
    }
    try {
      // 浏览器对未渲染 SVG 抛错（happy-dom 返回 NaN），失败时用回退值
      const measured = this.ring.getTotalLength();
      if (Number.isFinite(measured) && measured > 0) len = measured;
    } catch {
      /* 几何/经验回退 */
    }
    this.len = len;
    this.ring.style.strokeDasharray = String(this.len);
    this.renderRing();

    this.icon = document.createElement("span");
    this.icon.className = "qsf-icon";
    this.icon.setAttribute("aria-hidden", "true");
    if (options.content != null) {
      if (typeof options.content === "string") this.icon.innerHTML = options.content;
      else this.icon.append(options.content);
    } else {
      this.icon.innerHTML = ICON_CHEVRON_DOWN;
    }

    this.el.append(svg, this.icon);
    document.body.append(this.el);

    // 单模式没有绕环翻转：不绑绕环手势，只保留按钮激活与（双模式的）方向键翻转
    if (!this.single) {
      this.el.addEventListener("pointerenter", this.onEnter);
      this.el.addEventListener("pointerleave", this.onLeave);
      this.el.addEventListener("pointerdown", this.onDown);
      this.el.addEventListener("pointermove", this.onMove);
      this.el.addEventListener("pointerup", this.onUp);
      this.el.addEventListener("pointercancel", this.onCancel);
    }
    this.el.addEventListener("keydown", this.onKey);
    this.el.addEventListener("click", this.onClick);
    window.addEventListener("resize", this.onRecheck);
    (this.targetEl ?? window).addEventListener("scroll", this.onRecheck, { passive: true });
    if (typeof ResizeObserver === "function") {
      this.ro = new ResizeObserver(this.onRecheck);
      this.ro.observe(this.targetEl ?? document.documentElement);
    }
    this.syncVisible();
    // 初始补发一次进度（同步吐出，宿主无需先滚再读）
    this.emitScroll();
  }

  /** 当前模式 */
  get currentMode(): ScrollFabMode {
    return this.mode;
  }

  /** 内容懒加载等外部高度变化后可显式触发重估（滚动/resize 时也会自动重估），并强制补发一次进度 */
  refresh(): void {
    this.syncVisible();
    this.lastPct = -1;
    this.emitScroll();
  }

  scrollToBottom(): void {
    this.animateScroll("bottom");
  }

  scrollToTop(): void {
    this.animateScroll("top");
  }

  destroy(): void {
    this.destroyed = true;
    if (!this.single) {
      this.el.removeEventListener("pointerenter", this.onEnter);
      this.el.removeEventListener("pointerleave", this.onLeave);
      this.el.removeEventListener("pointerdown", this.onDown);
      this.el.removeEventListener("pointermove", this.onMove);
      this.el.removeEventListener("pointerup", this.onUp);
      this.el.removeEventListener("pointercancel", this.onCancel);
    }
    this.el.removeEventListener("keydown", this.onKey);
    this.el.removeEventListener("click", this.onClick);
    window.removeEventListener("resize", this.onRecheck);
    (this.targetEl ?? window).removeEventListener("scroll", this.onRecheck);
    this.ro?.disconnect();
    this.cancelScroll();
    this.stopLenisLoop();
    // 只销毁自建实例；外部宿主实例交还宿主
    this.ownLenis?.destroy?.();
    this.ownLenis = null;
    if (this.ringRaf != null) cancelAnimationFrame(this.ringRaf);
    this.ringRaf = null;
    if (this.emitRaf != null) cancelAnimationFrame(this.emitRaf);
    this.emitRaf = null;
    if (this.flashTimer != null) clearTimeout(this.flashTimer);
    if (this.tapResetTimer != null) clearTimeout(this.tapResetTimer);
    this.el.remove();
  }

  /** 规范化 modes：缺省双模式；去重、过滤非法值；结果为空直接抛错 */
  private normalizeModes(input?: ScrollFabMode[]): ScrollFabMode[] {
    if (!input) return ["to-bottom", "to-top"];
    const out: ScrollFabMode[] = [];
    for (const m of input) {
      if ((m === "to-bottom" || m === "to-top") && !out.includes(m)) out.push(m);
    }
    if (out.length === 0) {
      throw new TypeError("ScrollFab: modes 至少需要一个有效模式（'to-bottom' | 'to-top'）");
    }
    return out;
  }

  private makeCircle(cls: string): SVGCircleElement {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("class", cls);
    c.setAttribute("cx", "24");
    c.setAttribute("cy", "24");
    c.setAttribute("r", String(RADIUS));
    return c;
  }

  private makePath(cls: string, d: string): SVGPathElement {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("class", cls);
    p.setAttribute("d", d);
    return p;
  }

  /* ---------------- 输入状态机 ----------------
   * 桌面（mouse）：pointerenter 推进描边 / pointerleave 衰减倒转；click 恒为动作
   * 触屏（非 mouse）：pointerdown 按住推进（首指针独占，位移超阈值放弃并放行手势）；
   *   轻点 = 动作；绕满翻转过 → 本次释放被消费（不在同一手势里翻转+滚动）
   * 键盘：Enter/Space 走原生按钮激活（click → doAction）；双模式下方向键翻转模式
   */

  private onEnter = (e: PointerEvent): void => {
    if (e.pointerType !== "mouse") return;
    this.hovering = true;
    this.kickRing();
  };

  private onLeave = (e: PointerEvent): void => {
    if (e.pointerType !== "mouse") return;
    this.hovering = false;
    this.flipped = false;
  };

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || this.pointerId !== null) return;
    // 桌面描边由 hover 驱动，鼠标按压不接管
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    this.touchTap = true;
    if (this.tapResetTimer != null) clearTimeout(this.tapResetTimer);
    this.pointerId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.pressing = true;
    this.flipped = false;
    this.kickRing();
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId || !this.pressing) return;
    // 超阈值 = 放弃描边且放行页面手势（不拦截 move，浏览器原生滚动照常）
    if (Math.hypot(e.clientX - this.startX, e.clientY - this.startY) > this.cancelPx) {
      this.pressing = false;
      this.pointerId = null;
      this.flipped = false;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.pressing = false;
    const consumed = this.flipped;
    this.flipped = false;
    // ghost click 兜底标记延迟复位，避免吞掉下一次真实鼠标点击
    this.tapResetTimer = setTimeout(() => {
      this.touchTap = false;
      this.tapResetTimer = null;
    }, 400);
    if (consumed) return;
    this.doAction();
  };

  private onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.pressing = false;
    this.flipped = false;
  };

  private onClick = (e: MouseEvent): void => {
    // 触屏 pointerdown 已 preventDefault，正常不合成 click；此处兜底吞掉，防双触发
    if (this.touchTap) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    this.doAction();
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.repeat || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    if (this.single) return;
    const want: ScrollFabMode = e.key === "ArrowUp" ? "to-top" : "to-bottom";
    if (want === this.mode) return;
    // 翻转与滚动正交：拦截方向键的原生页面滚动，只做模式翻转
    e.preventDefault();
    this.setMode(want);
  };

  /* ---------------- 描边 rAF：悬停/按住推进 · 离开/松手衰减倒转 ---------------- */

  private holding(): boolean {
    return this.hovering || this.pressing;
  }

  private kickRing(): void {
    if (this.ringRaf != null) return;
    this.lastTs = null;
    this.ringRaf = requestAnimationFrame(this.stepRing);
  }

  private stepRing = (ts: number): void => {
    const dt = this.lastTs == null ? 0 : ts - this.lastTs;
    this.lastTs = ts;
    if (this.holding()) {
      if (!this.flipped) {
        this.progress = Math.min(1, this.progress + dt / this.ringMs);
        if (this.progress >= 1) this.completeRing();
      }
    } else {
      this.progress = Math.max(0, this.progress - dt / this.decayMs);
    }
    this.renderRing();
    if (this.holding() || this.progress > 0) {
      this.ringRaf = requestAnimationFrame(this.stepRing);
    } else {
      this.ringRaf = null;
    }
  };

  /** 绕满一圈 = 纯模式翻转（不附带任何滚动） */
  private completeRing(): void {
    this.flipped = true;
    const next: ScrollFabMode = this.mode === "to-bottom" ? "to-top" : "to-bottom";
    this.setMode(next);
    this.el.classList.add("is-complete");
    if (this.flashTimer != null) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.el.classList.remove("is-complete");
      this.flashTimer = null;
    }, 350);
  }

  private renderRing(): void {
    const vis = this.progress > 0;
    this.track.toggleAttribute("hidden", !vis);
    this.ring.toggleAttribute("hidden", !vis);
    this.ring.style.strokeDashoffset = String(this.len * (1 - this.progress));
  }

  private setMode(mode: ScrollFabMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.el.dataset.mode = mode;
    this.el.setAttribute("aria-label", mode === "to-bottom" ? this.labelBottom : this.labelTop);
    this.onModeChange?.(mode);
  }

  /* ---------------- 程序滚动：Lenis 后端可插拔，缺省内置 rAF ---------------- */

  private doAction(): void {
    this.animateScroll(this.mode === "to-bottom" ? "bottom" : "top");
  }

  private animateScroll(dest: "bottom" | "top"): void {
    const seq = ++this.actionSeq;
    this.cancelScroll();
    if (!this.animate || this.reducedMotion()) {
      this.setScrollPos(this.targetPos(dest));
      return;
    }
    if (this.externalLenis) {
      this.scrollWithLenis(this.externalLenis, dest, false);
      return;
    }
    if (this.ownLenisConfig) {
      const seq = ++this.actionSeq;
      void this.resolveOwnLenis().then((lenis) => {
        // await 期间可能已被新动作或 destroy 取代
        if (this.destroyed || seq !== this.actionSeq) return;
        if (lenis) this.scrollWithLenis(lenis, dest, true);
        else this.animateRaf(dest);
      });
      return;
    }
    this.animateRaf(dest);
  }

  /** 首次点击时动态 import lenis 并自建实例；未安装（或加载失败）→ null 永久回退 rAF */
  private resolveOwnLenis(): Promise<LenisLike | null> {
    if (this.ownLenis) return Promise.resolve(this.ownLenis);
    if (this.ownLenisPromise) return this.ownLenisPromise;
    this.ownLenisPromise = import("lenis")
      .then((mod) => {
        const LenisCtor =
          (mod as { default?: new (opts: Record<string, unknown>) => LenisLike }).default ??
          (mod as unknown as new (
            opts: Record<string, unknown>,
          ) => LenisLike);
        const cfg: Record<string, unknown> = { ...this.ownLenisConfig };
        // target 容器映射为 Lenis wrapper；window 形态留空（Lenis 默认即 window）
        if (this.targetEl) cfg.wrapper = this.targetEl;
        this.ownLenis = new LenisCtor(cfg);
        this.onLenisReady?.(this.ownLenis);
        return this.ownLenis;
      })
      .catch(() => {
        // lenis 未安装/不可用：放弃 lenis 路线，避免每次点击重复尝试
        this.ownLenisConfig = null;
        this.ownLenisPromise = null;
        return null;
      });
    return this.ownLenisPromise;
  }

  /**
   * 用 Lenis 执行程序滚动。
   * 自建实例（own）：组件自跑 raf loop（Lenis 需外部驱动 raf），保留 wheel/touch/keydown 打断与到底追击；
   * 外部实例：宿主自带 raf loop 与手势处理，组件只发 scrollTo，不追击不打断。
   */
  private scrollWithLenis(lenis: LenisLike, dest: "bottom" | "top", own: boolean): void {
    const immediate = !this.animate || this.reducedMotion();
    const target = this.targetPos(dest);
    this.lenisDest = dest;
    if (own) {
      // 上次打断可能调过 stop，发起前复位
      (lenis as LenisLike & { start?: () => void }).start?.();
      lenis.scrollTo(target, {
        immediate,
        onComplete: () => this.endLenisScroll(),
      });
      if (!immediate) {
        this.lenisScrolling = true;
        this.attachInterrupt();
        this.startLenisLoop(lenis, dest);
      } else {
        this.endLenisScroll();
      }
    } else {
      lenis.scrollTo(target, { immediate });
      this.lenisDest = null;
    }
  }

  /** 自建实例的 raf 驱动 + 懒加载到底追击（对齐内置 rAF 语义） */
  private startLenisLoop(lenis: LenisLike, dest: "bottom" | "top"): void {
    let lastEnd = this.targetPos(dest);
    const loop = (time: number): void => {
      if (!this.lenisScrolling) return;
      if (dest === "bottom") {
        const live = this.targetPos("bottom");
        if (Math.abs(live - lastEnd) > 2) {
          // 内容变长：追击新底端（force 覆盖当前程序动画）
          lastEnd = live;
          lenis.scrollTo(live, {
            force: true,
            onComplete: () => this.endLenisScroll(),
          });
        }
      }
      lenis.raf?.(time);
      this.lenisLoopRaf = requestAnimationFrame(loop);
    };
    this.lenisLoopRaf = requestAnimationFrame(loop);
  }

  private stopLenisLoop(): void {
    if (this.lenisLoopRaf != null) {
      cancelAnimationFrame(this.lenisLoopRaf);
      this.lenisLoopRaf = null;
    }
  }

  /** 打断自建 Lenis 程序滚动：stop 冻结动画（下次发起前 start 复位） */
  private onLenisInterrupt = (): void => {
    if (!this.lenisScrolling) return;
    (this.ownLenis as (LenisLike & { stop?: () => void }) | null)?.stop?.();
    this.endLenisScroll();
  };

  private endLenisScroll(): void {
    this.lenisScrolling = false;
    this.lenisDest = null;
    this.stopLenisLoop();
    this.detachInterrupt();
  }

  /* ---------------- 内置 rAF：缓动 + 打断 + 懒加载追击 ---------------- */

  private animateRaf(dest: "bottom" | "top"): void {
    this.attachRafInterrupt();
    let init = false;
    let start = 0;
    let end = 0;
    let t0 = 0;
    let dur = 0;
    const step = (ts: number): void => {
      if (!init) {
        init = true;
        start = this.scrollPos();
        end = this.targetPos(dest);
        t0 = ts;
        dur = Math.min(1200, Math.max(400, Math.abs(end - start) / 3));
      } else if (dest === "bottom") {
        // 追击：懒加载变长时以当前实测底端为准重设行程
        const live = this.targetPos(dest);
        if (Math.abs(live - end) > 2) {
          end = live;
          start = this.scrollPos();
          t0 = ts;
          dur = Math.min(1200, Math.max(400, Math.abs(end - start) / 3));
        }
      }
      const p = Math.min(1, (ts - t0) / dur);
      this.setScrollPos(start + (end - start) * easeInOutCubic(p));
      if (p < 1) this.scrollRaf = requestAnimationFrame(step);
      else {
        this.scrollRaf = null;
        this.detachRafInterrupt();
      }
    };
    this.scrollRaf = requestAnimationFrame(step);
  }

  private reducedMotion(): boolean {
    return (
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  private onInterrupt = (): void => {
    this.cancelScroll();
  };

  private interruptSource(): Window | HTMLElement {
    return this.targetEl ?? window;
  }

  /** 自建 Lenis 路线的打断监听 */
  private attachInterrupt(): void {
    const src = this.interruptSource();
    for (const ev of ["wheel", "touchstart", "keydown"])
      src.addEventListener(ev, this.onLenisInterrupt, { passive: true });
  }

  private detachInterrupt(): void {
    const src = this.interruptSource();
    for (const ev of ["wheel", "touchstart", "keydown"])
      src.removeEventListener(ev, this.onLenisInterrupt);
  }

  /** 内置 rAF 路线的打断监听 */
  private attachRafInterrupt(): void {
    const src = this.interruptSource();
    for (const ev of ["wheel", "touchstart", "keydown"])
      src.addEventListener(ev, this.onInterrupt, { passive: true });
  }

  private detachRafInterrupt(): void {
    const src = this.interruptSource();
    for (const ev of ["wheel", "touchstart", "keydown"])
      src.removeEventListener(ev, this.onInterrupt);
  }

  private cancelScroll(): void {
    if (this.scrollRaf != null) {
      cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = null;
    }
    if (this.lenisScrolling) this.endLenisScroll();
    const src = this.interruptSource();
    for (const ev of ["wheel", "touchstart", "keydown"]) {
      src.removeEventListener(ev, this.onInterrupt);
      src.removeEventListener(ev, this.onLenisInterrupt);
    }
  }

  /* ---------------- 度量、显隐与进度（可滚动且越过阈值才渲染） ---------------- */

  private maxScroll(): number {
    if (this.targetEl) return Math.max(0, this.targetEl.scrollHeight - this.targetEl.clientHeight);
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  private targetPos(dest: "bottom" | "top"): number {
    return dest === "bottom" ? this.maxScroll() : 0;
  }

  private scrollPos(): number {
    if (this.targetEl) return this.targetEl.scrollTop;
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  private setScrollPos(v: number): void {
    if (this.targetEl) this.targetEl.scrollTop = v;
    else window.scrollTo(0, v);
  }

  private onRecheck = (): void => {
    this.syncVisible();
    this.scheduleScroll();
  };

  private syncVisible(): void {
    this.el.hidden = this.maxScroll() <= 1 || this.scrollPos() < this.threshold;
  }

  /** rAF 节流：一帧内多次重估只吐一次；按钮隐藏期间照常调度 */
  private scheduleScroll(): void {
    if (this.emitRaf != null || this.destroyed) return;
    this.emitRaf = requestAnimationFrame(() => {
      this.emitRaf = null;
      this.emitScroll();
    });
  }

  private emitScroll(): void {
    if (this.destroyed) return;
    const max = this.maxScroll();
    const pct = max <= 0 ? 0 : Math.min(1, Math.max(0, this.scrollPos() / max));
    if (pct === this.lastPct) return;
    this.lastPct = pct;
    this.onScroll?.(pct);
  }
}
