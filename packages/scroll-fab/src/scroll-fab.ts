/** 青梧UI ScrollFab 悬浮滚动栏：默认“滚动到底部”，桌面悬停/触屏按住绕满描边一圈翻转为“返回顶部”，点击（轻点）直接执行当前模式动作 */

import { ICON_CHEVRON_DOWN } from "../../../icon/icons";
import type { ScrollFabMode, ScrollFabOptions } from "./types";

const RADIUS = 21;
const DEFAULT_LABEL_BOTTOM = "滚动到底部（悬停或按住绕圈可切换为返回顶部）";
const DEFAULT_LABEL_TOP = "返回顶部（悬停或按住绕圈可切换为滚动到底部）";

function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
}

export class ScrollFab {
  readonly el: HTMLButtonElement;

  private readonly ring: SVGCircleElement;
  private readonly track: SVGCircleElement;
  private readonly icon: HTMLElement;
  private readonly len: number;

  private readonly targetEl: HTMLElement | null;
  private readonly ringMs: number;
  private readonly decayMs: number;
  private readonly cancelPx: number;
  private readonly animate: boolean;
  private readonly labelBottom: string;
  private readonly labelTop: string;
  private readonly onModeChange?: (mode: ScrollFabMode) => void;

  private mode: ScrollFabMode = "to-bottom";
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
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private tapResetTimer: ReturnType<typeof setTimeout> | null = null;
  private touchTap = false;
  private ro: ResizeObserver | null = null;

  constructor(options: ScrollFabOptions = {}) {
    this.targetEl = options.target ?? null;
    this.ringMs = Math.max(100, Math.min(5000, options.ringDuration ?? 800));
    this.decayMs = Math.max(100, options.decayDuration ?? 300);
    this.cancelPx = Math.max(4, options.cancelThreshold ?? 10);
    this.animate = options.animate ?? true;
    this.labelBottom = options.ariaLabelToBottom ?? DEFAULT_LABEL_BOTTOM;
    this.labelTop = options.ariaLabelToTop ?? DEFAULT_LABEL_TOP;
    this.onModeChange = options.onModeChange;

    this.el = document.createElement("button");
    this.el.type = "button";
    this.el.className = `qsf-root${options.className ? ` ${options.className}` : ""}`;
    this.el.dataset.mode = this.mode;
    this.el.setAttribute("aria-label", this.labelBottom);
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

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "qsf-svg");
    svg.setAttribute("viewBox", "0 0 48 48");
    svg.setAttribute("aria-hidden", "true");
    this.track = this.makeCircle("qsf-track");
    this.ring = this.makeCircle("qsf-bar");
    svg.append(this.track, this.ring);
    let len = 2 * Math.PI * RADIUS;
    try {
      // 浏览器对未渲染 SVG 抛错（happy-dom 返回 NaN），失败时用几何公式回退
      const measured = this.ring.getTotalLength();
      if (Number.isFinite(measured)) len = measured;
    } catch {
      /* 回退 2πr */
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

    this.el.addEventListener("pointerenter", this.onEnter);
    this.el.addEventListener("pointerleave", this.onLeave);
    this.el.addEventListener("pointerdown", this.onDown);
    this.el.addEventListener("pointermove", this.onMove);
    this.el.addEventListener("pointerup", this.onUp);
    this.el.addEventListener("pointercancel", this.onCancel);
    this.el.addEventListener("keydown", this.onKey);
    this.el.addEventListener("click", this.onClick);
    window.addEventListener("resize", this.onRecheck);
    (this.targetEl ?? window).addEventListener("scroll", this.onRecheck, { passive: true });
    if (typeof ResizeObserver === "function") {
      this.ro = new ResizeObserver(this.onRecheck);
      this.ro.observe(this.targetEl ?? document.documentElement);
    }
    this.syncVisible();
  }

  /** 当前模式 */
  get currentMode(): ScrollFabMode {
    return this.mode;
  }

  /** 内容懒加载等外部高度变化后可显式触发重估（滚动/resize 时也会自动重估） */
  refresh(): void {
    this.onRecheck();
  }

  scrollToBottom(): void {
    this.animateScroll("bottom");
  }

  scrollToTop(): void {
    this.scrollTo(0);
  }

  destroy(): void {
    this.el.removeEventListener("pointerenter", this.onEnter);
    this.el.removeEventListener("pointerleave", this.onLeave);
    this.el.removeEventListener("pointerdown", this.onDown);
    this.el.removeEventListener("pointermove", this.onMove);
    this.el.removeEventListener("pointerup", this.onUp);
    this.el.removeEventListener("pointercancel", this.onCancel);
    this.el.removeEventListener("keydown", this.onKey);
    this.el.removeEventListener("click", this.onClick);
    window.removeEventListener("resize", this.onRecheck);
    (this.targetEl ?? window).removeEventListener("scroll", this.onRecheck);
    this.ro?.disconnect();
    this.cancelScroll();
    if (this.ringRaf != null) cancelAnimationFrame(this.ringRaf);
    this.ringRaf = null;
    if (this.flashTimer != null) clearTimeout(this.flashTimer);
    if (this.tapResetTimer != null) clearTimeout(this.tapResetTimer);
    this.el.remove();
  }

  private makeCircle(cls: string): SVGCircleElement {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("class", cls);
    c.setAttribute("cx", "24");
    c.setAttribute("cy", "24");
    c.setAttribute("r", String(RADIUS));
    return c;
  }

  /* ---------------- 输入状态机 ----------------
   * 桌面（mouse）：pointerenter 推进描边 / pointerleave 衰减倒转；click 恒为动作
   * 触屏（非 mouse）：pointerdown 按住推进（首指针独占，位移超阈值放弃并放行手势）；
   *   轻点 = 动作；绕满翻转过 → 本次释放被消费（不在同一手势里翻转+滚动）
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
    if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    this.setMode(this.mode === "to-bottom" ? "to-top" : "to-bottom");
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

  /* ---------------- 程序滚动：rAF 缓动 + 打断 + 懒加载追击 ---------------- */

  private doAction(): void {
    this.animateScroll(this.mode === "to-bottom" ? "bottom" : "top");
  }

  private animateScroll(dest: "bottom" | "top"): void {
    this.cancelScroll();
    if (!this.animate || this.reducedMotion()) {
      this.setScrollPos(this.targetPos(dest));
      return;
    }
    this.attachInterrupt();
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
        this.detachInterrupt();
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

  private attachInterrupt(): void {
    const src = this.interruptSource();
    for (const ev of ["wheel", "touchstart", "keydown"])
      src.addEventListener(ev, this.onInterrupt, { passive: true });
  }

  private detachInterrupt(): void {
    const src = this.interruptSource();
    for (const ev of ["wheel", "touchstart", "keydown"])
      src.removeEventListener(ev, this.onInterrupt);
  }

  private cancelScroll(): void {
    if (this.scrollRaf != null) {
      cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = null;
    }
    this.detachInterrupt();
  }

  /* ---------------- 度量与可见性（可滚动才渲染） ---------------- */

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

  private scrollTo(v: number): void {
    this.animateScroll(v === 0 ? "top" : "bottom");
  }

  private onRecheck = (): void => {
    this.syncVisible();
  };

  private syncVisible(): void {
    this.el.hidden = this.maxScroll() <= 1;
  }
}
