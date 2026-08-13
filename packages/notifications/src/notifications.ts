/* ============================================================
   青梧UI · 通知铃铛组件（Notifications）
   - 铃铛触发器 · 未读红点徽标 · 手风琴错峰展开动画 · 向上/向下自适应翻转
   - 零框架依赖，纯 DOM + CSS
   - ARIA: button + menu / menuitem（键盘可达）
   ============================================================ */

import { ICON_BELL } from "../../../icon/icons";
import type { NotificationItem, NotificationsOptions } from "./types";

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

let UID = 0;

/* ============================================================ */
export class Notifications {
  /* ---- 配置 ---- */
  private root: HTMLElement;
  private items: NotificationItem[];
  private emptyText: string;
  private customClass: string;
  private readonly width: "trigger" | "auto";
  private readonly duration: number;
  private readonly stagger: number;
  private readonly animate: boolean;
  private readonly maxStagger: number;
  private readonly renderItemCb?: (item: NotificationItem) => HTMLElement;
  private readonly onItemClickCb?: (item: NotificationItem) => void;
  private readonly onOpenChangeCb?: (open: boolean) => void;

  /* ---- 运行时状态 ---- */
  private isOpen = false;
  private unreadCount = 0;
  private active = -1;
  private dir: "down" | "up" = "down";
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  /* ---- DOM 引用 ---- */
  private trigger!: HTMLButtonElement;
  private badge!: HTMLElement;
  private list!: HTMLUListElement;
  private panel!: HTMLElement;

  /* ---- 监听器 ---- */
  private onDocPointerDown: ((e: PointerEvent) => void) | null = null;
  private onWinScroll: (() => void) | null = null;

  constructor(root: HTMLElement, opts: NotificationsOptions = {}) {
    this.root = root;
    this.items = opts.items ?? [];
    this.emptyText = opts.emptyText ?? "暂无消息";
    this.customClass = opts.className ?? "";
    this.width = opts.width ?? "auto";
    this.duration = opts.duration ?? 380;
    this.stagger = opts.stagger ?? 28;
    this.animate = opts.animate !== false;
    this.maxStagger = opts.maxStagger ?? 12;
    this.renderItemCb = opts.renderItem;
    this.onItemClickCb = opts.onItemClick;
    this.onOpenChangeCb = opts.onOpenChange;
    this.unreadCount = opts.unreadCount ?? 0;

    this.build(opts);

    if (opts.open === true || (opts.defaultOpen === true && opts.open == null)) {
      this.open();
    }
  }

  /* ============================================================
     Build：一次性创建全部 DOM
     ============================================================ */
  private build(opts: NotificationsOptions): void {
    const ariaLabel = opts.ariaLabel ?? "消息";

    this.root.classList.add("qntf");
    if (this.customClass) this.root.classList.add(this.customClass);

    /* 触发器：铃铛按钮 + 红点徽标 */
    this.trigger = el("button", "qntf-trigger") as HTMLButtonElement;
    this.trigger.type = "button";
    this.trigger.setAttribute("aria-haspopup", "menu");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.setAttribute("aria-label", ariaLabel);

    const content = opts.triggerContent ?? ICON_BELL;
    if (typeof content === "string") {
      this.trigger.innerHTML = content;
    } else {
      this.trigger.append(content);
    }
    this.badge = el("span", "qntf-badge");
    this.badge.setAttribute("aria-hidden", "true");
    this.trigger.append(this.badge);
    this.syncBadge();
    this.root.append(this.trigger);

    /* 面板（挂 body，避免宿主 transform/filter/overflow 裁剪） */
    this.panel = el("div", "qntf-panel");
    this.panel.hidden = true;
    this.panel.id = `qntf-panel-${++UID}`;
    this.panel.setAttribute("role", "menu");
    this.panel.setAttribute("aria-label", ariaLabel);
    this.list = el("ul", "qntf-list") as HTMLUListElement;
    this.panel.append(this.list);
    document.body.append(this.panel);

    this.renderItems();

    this.trigger.addEventListener("click", () => {
      this.isOpen ? this.close() : this.open();
    });
    this.trigger.addEventListener("keydown", (e) => this.onTriggerKey(e));

    /* 阻止 pointerdown 默认行为：焦点留在触发器，键盘导航经 aria-activedescendant 驱动 */
    this.list.addEventListener("pointerdown", (e) => e.preventDefault());
    this.list.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>(".qntf-item");
      if (item) this.activate(Number(item.dataset.index));
    });
  }

  /* ============================================================
     渲染
     ============================================================ */
  private renderItems(): void {
    this.list.textContent = "";
    if (this.items.length === 0) {
      const empty = el("li", "qntf-empty", escapeHTML(this.emptyText));
      empty.setAttribute("role", "menuitem");
      empty.setAttribute("aria-disabled", "true");
      this.list.append(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    const shouldStagger = this.shouldStagger();

    this.items.forEach((item, i) => {
      const li = el("li", "qntf-item");
      li.dataset.index = String(i);
      li.id = `qntf-item-${UID}-${i}`;
      li.setAttribute("role", "menuitem");
      if (item.unread) li.classList.add("is-unread");
      if (shouldStagger) li.classList.add("is-enter");

      if (this.renderItemCb) {
        li.append(this.renderItemCb(item));
      } else {
        const glyph = item.glyph ?? item.title.slice(0, 1);
        li.innerHTML =
          `<span class="qntf-item-glyph">${escapeHTML(glyph)}</span>` +
          `<span class="qntf-item-main"><span class="qntf-item-title">${escapeHTML(item.title)}</span>` +
          (item.sub ? `<span class="qntf-item-sub">${escapeHTML(item.sub)}</span>` : "") +
          `</span>` +
          `<span class="qntf-item-dot" aria-hidden="true"></span>`;
      }
      frag.append(li);
    });
    this.list.append(frag);
  }

  /** 是否启用逐项错峰动画（尊重 reduced-motion 与超大列表降级） */
  private shouldStagger(): boolean {
    return this.animate && !PREFERS_REDUCED && this.items.length <= this.maxStagger;
  }

  private syncBadge(): void {
    this.badge.classList.toggle("is-visible", this.unreadCount > 0);
  }

  /* ============================================================
     展开 / 关闭 / 定位
     ============================================================ */
  /** 打开下拉面板 */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.renderItems();

    this.panel.hidden = false;
    this.root.classList.add("is-open");
    this.trigger.setAttribute("aria-expanded", "true");

    this.position();
    this.active = -1;
    this.applyStagger();

    requestAnimationFrame(() => this.panel.classList.add("is-open"));

    this.onDocPointerDown = (e) => {
      if (this.isOpen && !this.root.contains(e.target as Node)) this.close();
    };
    document.addEventListener("pointerdown", this.onDocPointerDown);
    this.onWinScroll = () => this.position();
    window.addEventListener("scroll", this.onWinScroll, true);
    window.addEventListener("resize", this.onWinScroll);

    this.onOpenChangeCb?.(true);
  }

  /** 关闭下拉面板 */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove("is-open");
    this.panel.classList.remove("is-open");
    this.trigger.setAttribute("aria-expanded", "false");
    this.active = -1;

    if (this.onDocPointerDown) {
      document.removeEventListener("pointerdown", this.onDocPointerDown);
      this.onDocPointerDown = null;
    }
    if (this.onWinScroll) {
      window.removeEventListener("scroll", this.onWinScroll, true);
      window.removeEventListener("resize", this.onWinScroll);
      this.onWinScroll = null;
    }

    if (this.closeTimer !== null) clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(
      () => {
        if (!this.isOpen) this.panel.hidden = true;
      },
      PREFERS_REDUCED ? 0 : this.duration,
    );

    this.onOpenChangeCb?.(false);
  }

  /** 切换展开状态 */
  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  /** 计算面板位置：宽度跟随触发器、向上/向下翻转、错峰方向随之反向 */
  private position(): void {
    const tr = this.trigger.getBoundingClientRect();
    const gap = 8;

    this.panel.style.width = this.width === "auto" ? "max-content" : `${tr.width}px`;
    if (this.width === "auto") {
      this.panel.style.minWidth = `${tr.width}px`;
    }

    /* 隐藏态测量：决定展开方向（不闪烁） */
    this.panel.style.visibility = "hidden";
    const panelH = this.panel.offsetHeight;
    const panelW = this.panel.offsetWidth;
    const spaceBelow = window.innerHeight - tr.bottom;
    const spaceAbove = tr.top;

    const flipUp = spaceBelow - gap < panelH && spaceAbove > spaceBelow;
    this.dir = flipUp ? "up" : "down";
    this.panel.classList.toggle("is-up", flipUp);

    let left = tr.left;
    if (this.width === "auto" && panelW > window.innerWidth - 16) {
      left = Math.max(8, window.innerWidth - panelW - 8);
    }
    this.panel.style.left = `${Math.max(8, left)}px`;

    if (flipUp) {
      this.panel.style.top = "auto";
      this.panel.style.bottom = `${Math.max(8, window.innerHeight - tr.top + gap)}px`;
    } else {
      this.panel.style.top = `${tr.bottom + gap}px`;
      this.panel.style.bottom = "auto";
    }
    this.panel.style.visibility = "";
  }

  /** 错峰动画：按展开方向给每个条目设置递增 / 递减延迟 */
  private applyStagger(): void {
    if (!this.shouldStagger()) return;
    const items = this.list.querySelectorAll<HTMLElement>(".qntf-item.is-enter");
    const n = items.length;
    items.forEach((o, i) => {
      const delay = this.dir === "up" ? (n - 1 - i) * this.stagger : i * this.stagger;
      o.style.animationDelay = `${delay}ms`;
      o.style.animationDuration = `${this.duration}ms`;
    });
  }

  /* ============================================================
     条目激活（点击 / 键盘）
     ============================================================ */
  private activate(index: number): void {
    const item = this.items[index];
    if (!item) return;
    this.onItemClickCb?.(item);
    this.close();
  }

  private setActive(idx: number, scroll = true): void {
    const items = this.list.querySelectorAll<HTMLElement>(".qntf-item:not(.qntf-empty)");
    if (!items.length) return;
    this.active = Math.max(0, Math.min(idx, items.length - 1));
    items.forEach((o, i) => {
      const on = i === this.active;
      o.classList.toggle("is-active", on);
      if (on) {
        this.trigger.setAttribute("aria-activedescendant", o.id);
        if (scroll) o.scrollIntoView({ block: "nearest" });
      }
    });
  }

  private moveActive(delta: number): void {
    const items = this.list.querySelectorAll<HTMLElement>(".qntf-item:not(.qntf-empty)");
    if (!items.length) return;
    if (delta === Number.MIN_SAFE_INTEGER) {
      this.setActive(0);
      return;
    }
    if (delta === Number.MAX_SAFE_INTEGER) {
      this.setActive(items.length - 1);
      return;
    }
    const next = this.active < 0 ? (delta > 0 ? 0 : items.length - 1) : this.active + delta;
    this.setActive(next);
  }

  /* ============================================================
     键盘导航（焦点保持在触发器，aria-activedescendant 指向列表）
     ============================================================ */
  private onTriggerKey(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!this.isOpen) this.open();
        else this.moveActive(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!this.isOpen) this.open();
        else this.moveActive(-1);
        break;
      case "Home":
        if (this.isOpen) {
          e.preventDefault();
          this.moveActive(Number.MIN_SAFE_INTEGER);
        }
        break;
      case "End":
        if (this.isOpen) {
          e.preventDefault();
          this.moveActive(Number.MAX_SAFE_INTEGER);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (this.isOpen) {
          if (this.active >= 0) this.activate(this.active);
        } else {
          this.open();
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
  }

  /* ============================================================
     Public API
     ============================================================ */

  /** 是否展开 */
  get expanded(): boolean {
    return this.isOpen;
  }

  /** 外部同步 / 更新配置 */
  update(patch: Partial<NotificationsOptions>): void {
    if ("items" in patch && patch.items) {
      this.items = patch.items;
      this.renderItems();
      if (this.isOpen) this.applyStagger();
    }
    if ("unreadCount" in patch && patch.unreadCount !== undefined) {
      this.unreadCount = patch.unreadCount;
      this.syncBadge();
    }
    if ("open" in patch && patch.open !== undefined) {
      patch.open ? this.open() : this.close();
    }
    if ("emptyText" in patch && patch.emptyText !== undefined) {
      this.emptyText = patch.emptyText;
      if (this.items.length === 0) this.renderItems();
    }
    if ("ariaLabel" in patch && patch.ariaLabel !== undefined) {
      this.trigger.setAttribute("aria-label", patch.ariaLabel);
    }
  }

  /** 销毁组件，清空宿主容器并移除 body 上的面板 */
  destroy(): void {
    if (this.closeTimer !== null) clearTimeout(this.closeTimer);
    this.close();
    this.panel.remove();
    this.root.classList.remove("qntf", "is-open");
    if (this.customClass) this.root.classList.remove(this.customClass);
    this.root.textContent = "";
  }
}
