/* ============================================================
   青梧UI · 扇形动作菜单（ActionMenu）
   - 悬浮展开扇形 · 两段式披露：打开仅图标，hover 扇区沿切向伸出该扇区 label（旋转钳制 ±45°）
   - hover 扇区不收起菜单，点击扇区才触发动作并收起
   - FAB 内置触发 / 外部元素锚定 双模式 · ESC / 外部点击 收起 · 键盘导航
   - ARIA: menu / menuitem + aria-activedescendant
   ============================================================ */

import { ICON_PLUS } from "../../../icon/icons";
import type { ActionMenuItem, ActionMenuOptions, ActionMenuPosition } from "./types";

const PREFERS_REDUCED =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHTML(s: string): string {
  return s.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);
}

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/* ---- 扇形几何 ---- */
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** label 圆心到扇区图标的径向间距 px */
const LABEL_GAP = 48;
/** 悬停收起延迟 ms：跨越 trigger 与扇区间隙时防抖 */
const HOVER_CLOSE_DELAY = 140;

function normalizeAngle(rad: number): number {
  let a = ((rad % TAU) + TAU) % TAU;
  if (a > Math.PI) a -= TAU;
  return a;
}

interface ItemLayout {
  x: number;
  y: number;
  lx: number;
  ly: number;
  rot: number;
}

/**
 * 计算每个扇区的位置与 label 旋转：
 * - 图标圆心：沿 angle 方向、距触发中心 radius px
 * - label 圆心：沿 angle 方向再向外 LABEL_GAP px
 * - label 旋转：沿切向（angle + 90°），先归一化到 [-90°, 90°] 防倒置，再钳制 ±45° 保证可读
 */
function layoutItems(
  count: number,
  direction: "left" | "right",
  spreadDeg: number,
  radius: number,
): ItemLayout[] {
  const layouts: ItemLayout[] = [];
  if (count === 0) return layouts;
  const spread = spreadDeg * DEG;
  const base = direction === "right" ? 0 : Math.PI;
  for (let i = 0; i < count; i++) {
    const angle = count === 1 ? base : base - spread / 2 + (spread / (count - 1)) * i;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const lx = Math.cos(angle) * LABEL_GAP;
    const ly = Math.sin(angle) * LABEL_GAP;
    let rel = normalizeAngle(angle + Math.PI / 2);
    if (rel > Math.PI / 2) rel -= Math.PI;
    if (rel < -Math.PI / 2) rel += Math.PI;
    const clamp = Math.PI / 4;
    const rot = (Math.max(-clamp, Math.min(clamp, rel)) * 180) / Math.PI;
    layouts.push({ x, y, lx, ly, rot });
  }
  return layouts;
}

let UID = 0;

/* ============================================================ */
export class ActionMenu {
  /* ---- 配置 ---- */
  private root: HTMLElement;
  private items: ActionMenuItem[];
  private direction: "left" | "right";
  private spread: number;
  private radius: number;
  private readonly position: ActionMenuPosition;
  private readonly fabIcon: string;
  private readonly customClass: string;
  private ariaLabel: string;
  private closeRadius: number;
  private readonly duration: number;
  private readonly animate: boolean;
  private readonly onOpenChangeCb?: (open: boolean) => void;
  private readonly onActionCb?: (item: ActionMenuItem, index: number) => void;

  /* ---- 运行时状态 ---- */
  private isOpen = false;
  private active = -1;
  private triggerHovered = false;
  private fanHovered = false;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  /* ---- DOM 引用 ---- */
  private trigger!: HTMLElement;
  private fan!: HTMLElement;
  private itemsWrap!: HTMLElement;

  /* ---- 监听器 ---- */
  private onDocPointerDown: ((e: PointerEvent) => void) | null = null;
  private onWinScroll: (() => void) | null = null;

  constructor(root: HTMLElement, opts: ActionMenuOptions = {}) {
    this.root = root;
    this.items = opts.items ?? [];
    this.direction = opts.direction ?? "right";
    this.spread = opts.spread ?? 180;
    this.radius = opts.radius ?? 56;
    this.position = opts.position ?? { right: 24, bottom: 24 };
    this.fabIcon = opts.fabIcon ?? ICON_PLUS;
    this.customClass = opts.className ?? "";
    this.ariaLabel = opts.ariaLabel ?? "快捷操作";
    // 覆盖扇区 + 展开后的 label（半径 + LABEL_GAP + label 半长），避免指针悬停 label 时越界收起
    this.closeRadius = opts.closeRadius ?? this.radius + 130;
    this.duration = opts.duration ?? 220;
    this.animate = opts.animate !== false;
    this.onOpenChangeCb = opts.onOpenChange;
    this.onActionCb = opts.onAction;

    this.build(opts);
  }

  /* ============================================================
     Build：创建触发器 + 扇区面板（挂 body）
     ============================================================ */
  private build(opts: ActionMenuOptions): void {
    this.root.classList.add("qam-root");
    if (this.customClass) this.root.classList.add(this.customClass);

    if (opts.trigger) {
      this.trigger = opts.trigger;
    } else {
      const fab = el("button", "qam-trigger qam-trigger-fab") as HTMLButtonElement;
      fab.type = "button";
      fab.style.position = "fixed";
      fab.style.zIndex = "301";
      for (const k of ["top", "right", "bottom", "left"] as const) {
        const v = this.position[k];
        if (v != null) fab.style[k] = `${v}px`;
      }
      const ico = el("span", "qam-trigger-ico", this.fabIcon);
      ico.setAttribute("aria-hidden", "true");
      fab.append(ico);
      this.root.append(fab);
      this.trigger = fab;
    }
    this.trigger.classList.add("qam-trigger");
    this.trigger.setAttribute("aria-haspopup", "menu");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.setAttribute("aria-label", this.ariaLabel);

    /* 面板挂 body，避免宿主 transform/overflow 裁剪 */
    this.fan = el("div", "qam-fan");
    this.fan.hidden = true;
    this.fan.id = `qam-fan-${++UID}`;
    this.fan.setAttribute("role", "menu");
    this.fan.setAttribute("aria-label", this.ariaLabel);
    this.itemsWrap = el("div", "qam-items");
    this.fan.append(this.itemsWrap);
    document.body.append(this.fan);

    this.renderItems();

    this.trigger.addEventListener("mouseenter", this.onTriggerEnter);
    this.trigger.addEventListener("mouseleave", this.onTriggerLeave);
    this.trigger.addEventListener("click", this.onTriggerClick);
    this.trigger.addEventListener("keydown", this.onTriggerKey);
    this.itemsWrap.addEventListener("mouseenter", this.onFanEnter);
    this.itemsWrap.addEventListener("mouseleave", this.onFanLeave);
    this.fan.addEventListener("click", this.onFanClick);
  }

  /* ============================================================
     渲染扇区
     ============================================================ */
  private renderItems(): void {
    this.itemsWrap.textContent = "";
    const layouts = layoutItems(this.items.length, this.direction, this.spread, this.radius);
    const frag = document.createDocumentFragment();

    this.items.forEach((item, i) => {
      const l = layouts[i];
      const it = el("div", "qam-item");
      it.dataset.index = String(i);
      it.id = `${this.fan.id}-item-${i}`;
      it.setAttribute("role", "menuitem");
      it.setAttribute("aria-label", item.label);
      if (item.disabled) it.setAttribute("aria-disabled", "true");
      it.style.setProperty("--i", String(i));
      if (l) it.style.transform = `translate(${l.x.toFixed(2)}px, ${l.y.toFixed(2)}px)`;

      const ico = el("span", "qam-item-ico", item.icon);
      ico.setAttribute("aria-hidden", "true");
      ico.addEventListener("mouseenter", () => this.setActive(i));
      it.append(ico);

      const label = el("span", "qam-item-label", escapeHTML(item.label));
      label.addEventListener("mouseenter", () => this.setActive(i));
      if (l) {
        label.style.left = `${l.lx.toFixed(2)}px`;
        label.style.top = `${l.ly.toFixed(2)}px`;
        label.style.setProperty("--qam-rot", `${l.rot.toFixed(1)}deg`);
      }
      it.append(label);

      frag.append(it);
    });

    this.itemsWrap.append(frag);
  }

  /** 高亮扇区：仅保留一个展开的 label，同时维护 aria-activedescendant */
  private setActive(idx: number): void {
    this.active = idx;
    const items = this.itemsWrap.querySelectorAll<HTMLElement>(".qam-item");
    items.forEach((it, i) => {
      const on = i === idx;
      it.classList.toggle("is-active", on);
    });
    const target = items[idx];
    if (idx >= 0 && target) {
      this.trigger.setAttribute("aria-activedescendant", target.id);
    } else {
      this.trigger.removeAttribute("aria-activedescendant");
    }
  }

  /* ============================================================
     展开 / 收起 / 定位
     ============================================================ */
  open(): void {
    if (this.isOpen || this.items.length === 0) return;
    this.isOpen = true;
    this.renderItems();
    this.setActive(-1);

    this.fan.hidden = false;
    this.root.classList.add("is-open");
    this.trigger.setAttribute("aria-expanded", "true");

    this.reposition();
    requestAnimationFrame(() => this.fan.classList.add("is-open"));

    this.onDocPointerDown = (e) => {
      if (!this.isOpen) return;
      const t = e.target as Node;
      if (this.fan.contains(t) || t === this.trigger || this.trigger.contains(t)) return;
      this.close();
    };
    document.addEventListener("pointerdown", this.onDocPointerDown);
    this.onWinScroll = () => this.reposition();
    window.addEventListener("scroll", this.onWinScroll, true);
    window.addEventListener("resize", this.onWinScroll);

    this.onOpenChangeCb?.(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.triggerHovered = false;
    this.fanHovered = false;
    this.root.classList.remove("is-open");
    this.fan.classList.remove("is-open");
    this.trigger.setAttribute("aria-expanded", "false");
    this.setActive(-1);

    if (this.onDocPointerDown) {
      document.removeEventListener("pointerdown", this.onDocPointerDown);
      this.onDocPointerDown = null;
    }
    if (this.onWinScroll) {
      window.removeEventListener("scroll", this.onWinScroll, true);
      window.removeEventListener("resize", this.onWinScroll);
      this.onWinScroll = null;
    }

    this.clearHoverTimer();
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(
      () => {
        if (!this.isOpen) this.fan.hidden = true;
      },
      this.animate && !PREFERS_REDUCED ? this.duration : 0,
    );

    this.onOpenChangeCb?.(false);
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  /** 扇形面板中心对齐触发元素中心 */
  private reposition(): void {
    const tr = this.trigger.getBoundingClientRect();
    const cx = tr.left + tr.width / 2;
    const cy = tr.top + tr.height / 2;
    const half = this.closeRadius;
    this.fan.style.left = `${(cx - half).toFixed(1)}px`;
    this.fan.style.top = `${(cy - half).toFixed(1)}px`;
    this.fan.style.width = `${(half * 2).toFixed(1)}px`;
    this.fan.style.height = `${(half * 2).toFixed(1)}px`;
  }

  /* ============================================================
     触发 / 交互
     ============================================================ */
  private onTriggerEnter = (): void => {
    this.triggerHovered = true;
    this.fanHovered = true; // 扇形覆盖触发器，指针必然在其命中圆内
    this.clearHoverTimer();
    this.open();
  };

  private onTriggerLeave = (): void => {
    this.triggerHovered = false;
    this.maybeClose();
  };

  private onFanEnter = (): void => {
    this.fanHovered = true;
    this.clearHoverTimer();
  };

  private onFanLeave = (): void => {
    this.fanHovered = false;
    this.maybeClose();
  };

  private maybeClose(): void {
    if (this.triggerHovered || this.fanHovered) return;
    this.clearHoverTimer();
    this.hoverTimer = setTimeout(() => this.close(), HOVER_CLOSE_DELAY);
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  private onTriggerClick = (): void => {
    if (this.items.length === 0) return;
    this.isOpen ? this.close() : this.open();
  };

  private onFanClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const itemEl = target.closest<HTMLElement>(".qam-item");
    if (!itemEl) return;
    this.triggerItem(Number(itemEl.dataset.index));
  };

  private triggerItem(index: number): void {
    const item = this.items[index];
    if (!item || item.disabled) return;
    this.onActionCb?.(item, index);
    item.onClick?.();
    this.close();
  }

  /* ============================================================
     键盘导航（焦点保持在触发器，aria-activedescendant 指向扇区）
     ============================================================ */
  private onTriggerKey = (e: KeyboardEvent): void => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
          this.setActive(this.firstEnabled());
        } else {
          this.moveActive(1);
        }
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
          this.setActive(this.lastEnabled());
        } else {
          this.moveActive(-1);
        }
        break;
      case "Home":
        if (this.isOpen) {
          e.preventDefault();
          this.setActive(this.firstEnabled());
        }
        break;
      case "End":
        if (this.isOpen) {
          e.preventDefault();
          this.setActive(this.lastEnabled());
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (this.isOpen) {
          if (this.active >= 0) this.triggerItem(this.active);
        } else {
          this.open();
          this.setActive(this.firstEnabled());
        }
        break;
      case "Escape":
        if (this.isOpen) {
          e.preventDefault();
          this.close();
        }
        break;
      case "Tab":
        if (this.isOpen) this.close();
        break;
    }
  };

  private firstEnabled(): number {
    return this.items.findIndex((i) => !i.disabled);
  }

  private lastEnabled(): number {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it && !it.disabled) return i;
    }
    return -1;
  }

  private nextEnabled(from: number, dir: 1 | -1): number {
    const n = this.items.length;
    if (!n) return -1;
    for (let step = 1; step <= n; step++) {
      const i = (from + dir * step + n) % n;
      const it = this.items[i];
      if (it && !it.disabled) return i;
    }
    return -1;
  }

  private moveActive(delta: number): void {
    const from = this.active < 0 ? (delta > 0 ? -1 : 0) : this.active;
    const next = this.nextEnabled(from, delta > 0 ? 1 : -1);
    if (next >= 0) this.setActive(next);
  }

  /* ============================================================
     Public API
     ============================================================ */

  /** 是否展开 */
  get expanded(): boolean {
    return this.isOpen;
  }

  /** 当前高亮扇区下标（-1 无） */
  get activeIndex(): number {
    return this.active;
  }

  /** 更新配置：换项 / 换向 / 几何 / 无障碍标签 */
  update(patch: Partial<ActionMenuOptions>): void {
    let reLayout = false;
    if ("items" in patch && patch.items) {
      this.items = patch.items;
      reLayout = true;
    }
    if ("direction" in patch && patch.direction !== undefined) {
      this.direction = patch.direction;
      reLayout = true;
    }
    if ("spread" in patch && patch.spread !== undefined) {
      this.spread = patch.spread;
      reLayout = true;
    }
    if ("radius" in patch && patch.radius !== undefined) {
      this.radius = patch.radius;
      reLayout = true;
    }
    if ("closeRadius" in patch && patch.closeRadius !== undefined) {
      this.closeRadius = patch.closeRadius;
      reLayout = true;
    }
    if ("ariaLabel" in patch && patch.ariaLabel !== undefined) {
      this.ariaLabel = patch.ariaLabel;
      this.trigger.setAttribute("aria-label", patch.ariaLabel);
      this.fan.setAttribute("aria-label", patch.ariaLabel);
    }
    if (reLayout) {
      this.renderItems();
      if (this.isOpen) this.reposition();
    }
  }

  /** 销毁组件：移除监听、清空宿主容器并移除 body 上的面板 */
  destroy(): void {
    if (this.hoverTimer !== null) clearTimeout(this.hoverTimer);
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
    this.close();
    this.fan.remove();
    this.root.classList.remove("qam-root", "is-open");
    if (this.customClass) this.root.classList.remove(this.customClass);
    this.root.textContent = "";
  }
}
