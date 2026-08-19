/** 青梧UI 下拉选择器：单选 · 错峰动画 · 自适应翻转 · 零依赖纯 DOM + ARIA */

import { ICON_CHECK, ICON_CHEVRON_DOWN } from "../../../icon/icons";
import type { SelectOption, SelectOptions } from "./types";

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

export class Select {
  private root: HTMLElement;
  private options: SelectOption[];
  private placeholder: string;
  private customClass: string;
  private readonly width: "trigger" | "auto";
  private readonly duration: number;
  private readonly stagger: number;
  private readonly animate: boolean;
  private readonly maxStagger: number;
  private frosted: boolean;
  private readonly onOpenChangeCb?: (open: boolean) => void;
  private readonly onChangeCb?: (value: string | null, option: SelectOption | null) => void;

  private readonly controlledValue: boolean;
  private displayValue: string | null;

  private isOpen = false;
  private isDisabled = false;
  private active = -1;
  private dir: "down" | "up" = "down";
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  private trigger!: HTMLButtonElement;
  private valueEl!: HTMLElement;
  private list!: HTMLUListElement;
  private panel!: HTMLElement;

  private onDocPointerDown: ((e: PointerEvent) => void) | null = null;
  private onWinScroll: (() => void) | null = null;

  constructor(root: HTMLElement, opts: SelectOptions = {}) {
    this.root = root;
    this.options = opts.options ?? [];
    this.placeholder = opts.placeholder ?? "";
    this.customClass = opts.className ?? "";
    this.width = opts.width ?? "trigger";
    this.duration = opts.duration ?? 380;
    this.stagger = opts.stagger ?? 28;
    this.animate = opts.animate !== false;
    this.maxStagger = opts.maxStagger ?? 12;
    this.frosted = opts.frosted !== false;
    this.onOpenChangeCb = opts.onOpenChange;
    this.onChangeCb = opts.onChange;

    this.controlledValue = "value" in opts;
    this.displayValue = opts.value ?? opts.defaultValue ?? null;
    this.isDisabled = opts.disabled === true;

    this.build(opts);

    if (opts.open === true || (opts.defaultOpen === true && opts.open == null)) {
      this.open();
    }
  }

  /* 一次性创建全部 DOM */
  private build(opts: SelectOptions): void {
    const ariaLabel = opts.ariaLabel ?? (this.placeholder || "请选择");

    this.root.classList.add("qsel");
    if (this.customClass) this.root.classList.add(this.customClass);
    this.root.classList.toggle("is-disabled", this.isDisabled);

    this.trigger = el("button", "qsel-trigger") as HTMLButtonElement;
    this.trigger.type = "button";
    this.trigger.setAttribute("role", "combobox");
    this.trigger.setAttribute("aria-haspopup", "listbox");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.setAttribute("aria-label", ariaLabel);
    this.trigger.disabled = this.isDisabled;

    this.valueEl = el("span", "qsel-value");
    const chev = el("span", "qsel-chevron", ICON_CHEVRON_DOWN);
    chev.setAttribute("aria-hidden", "true");
    this.trigger.append(this.valueEl, chev);
    this.root.append(this.trigger);

    /* 面板（挂 body，避免宿主 transform/filter/overflow 裁剪） */
    this.panel = el("div", "qsel-panel");
    this.panel.classList.toggle("is-frosted", this.frosted);
    this.panel.hidden = true;
    this.panel.id = `qsel-panel-${++UID}`;
    this.panel.setAttribute("role", "listbox");
    this.panel.setAttribute("aria-label", ariaLabel);
    this.list = el("ul", "qsel-list") as HTMLUListElement;
    this.panel.append(this.list);
    document.body.append(this.panel);

    this.syncValue();
    this.renderOptions();

    this.trigger.addEventListener("click", () => {
      if (this.isDisabled) return;
      this.isOpen ? this.close() : this.open();
    });
    this.trigger.addEventListener("keydown", (e) => this.onTriggerKey(e));

    /* 阻止 pointerdown，避免列表抢占焦点破坏 aria-activedescendant */
    this.list.addEventListener("pointerdown", (e) => e.preventDefault());
    this.list.addEventListener("click", (e) => {
      const opt = (e.target as HTMLElement).closest<HTMLElement>(".qsel-opt");
      if (opt) this.select(Number(opt.dataset.index));
    });
  }

  private renderOptions(): void {
    this.list.textContent = "";
    const frag = document.createDocumentFragment();
    const shouldStagger = this.shouldStagger();

    this.options.forEach((opt, i) => {
      const li = el("li", "qsel-opt");
      li.dataset.index = String(i);
      li.id = `qsel-opt-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(opt.value === this.displayValue));
      if (opt.disabled) {
        li.classList.add("is-disabled");
        li.setAttribute("aria-disabled", "true");
      }
      if (shouldStagger) li.classList.add("is-enter");

      const glyph = opt.glyph ?? opt.label.slice(0, 1);
      li.innerHTML =
        `<span class="qsel-opt-ico">${escapeHTML(glyph)}</span>` +
        `<span class="qsel-opt-main"><span class="qsel-opt-label">${escapeHTML(opt.label)}</span>` +
        (opt.hint ? `<span class="qsel-opt-hint">${escapeHTML(opt.hint)}</span>` : "") +
        `</span>` +
        `<span class="qsel-check" aria-hidden="true">${ICON_CHECK}</span>`;
      frag.append(li);
    });
    this.list.append(frag);
  }

  /** 是否启用逐项错峰动画（尊重 reduced-motion 与超大列表降级） */
  private shouldStagger(): boolean {
    return this.animate && !PREFERS_REDUCED && this.options.length <= this.maxStagger;
  }

  private syncValue(): void {
    const opt = this.currentOption;
    this.valueEl.textContent = opt ? opt.label : this.placeholder;
    this.valueEl.classList.toggle("is-placeholder", !opt);
  }

  private get currentOption(): SelectOption | null {
    return this.options.find((o) => o.value === this.displayValue) ?? null;
  }

  /** 打开下拉面板 */
  open(): void {
    if (this.isOpen || this.isDisabled) return;
    this.isOpen = true;
    this.renderOptions();

    this.panel.hidden = false;
    this.root.classList.add("is-open");
    this.trigger.setAttribute("aria-expanded", "true");

    this.position();
    this.setActive(this.startIndex(), false);
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
    this.trigger.removeAttribute("aria-activedescendant");
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

  /** 计算面板位置：宽度跟随触发器、向上/向下翻转 */
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

  /** 错峰动画：按展开方向给每个选项设置递增 / 递减延迟 */
  private applyStagger(): void {
    if (!this.shouldStagger()) return;
    const opts = this.list.querySelectorAll<HTMLElement>(".qsel-opt.is-enter");
    const n = opts.length;
    opts.forEach((o, i) => {
      const delay = this.dir === "up" ? (n - 1 - i) * this.stagger : i * this.stagger;
      o.style.animationDelay = `${delay}ms`;
      o.style.animationDuration = `${this.duration}ms`;
    });
  }

  private select(index: number): void {
    const opt = this.options[index];
    if (!opt || opt.disabled) return;

    if (!this.controlledValue) {
      this.displayValue = opt.value;
      this.syncValue();
    }
    this.onChangeCb?.(opt.value, opt);
    this.close();
  }

  private setActive(idx: number, scroll = true): void {
    const opts = this.list.querySelectorAll<HTMLElement>(".qsel-opt");
    if (!opts.length) return;
    this.active = Math.max(0, Math.min(idx, opts.length - 1));
    opts.forEach((o, i) => {
      const on = i === this.active;
      o.classList.toggle("is-active", on);
      if (on) {
        this.trigger.setAttribute("aria-activedescendant", o.id);
        if (scroll) o.scrollIntoView({ block: "nearest" });
      }
    });
  }

  /* 键盘导航（焦点保持在触发器，aria-activedescendant 指向列表） */
  private onTriggerKey(e: KeyboardEvent): void {
    if (this.isDisabled) return;
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
          if (this.active >= 0) this.select(this.active);
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

  /** 在可用选项中移动（跳过禁用项，支持环绕） */
  private nextEnabled(from: number, dir: 1 | -1): number {
    const n = this.options.length;
    if (!n) return -1;
    for (let step = 1; step <= n; step++) {
      const i = (from + dir * step + n) % n;
      const o = this.options[i];
      if (o && !o.disabled) return i;
    }
    return -1;
  }

  private firstEnabled(): number {
    return this.options.findIndex((o) => !o.disabled);
  }

  private lastEnabled(): number {
    for (let i = this.options.length - 1; i >= 0; i--) {
      const o = this.options[i];
      if (o && !o.disabled) return i;
    }
    return -1;
  }

  private startIndex(): number {
    const idx = this.options.findIndex((o) => o.value === this.displayValue && !o.disabled);
    return idx >= 0 ? idx : this.firstEnabled();
  }

  private moveActive(delta: number): void {
    if (delta === Number.MIN_SAFE_INTEGER) {
      const i = this.firstEnabled();
      if (i >= 0) this.setActive(i);
      return;
    }
    if (delta === Number.MAX_SAFE_INTEGER) {
      const i = this.lastEnabled();
      if (i >= 0) this.setActive(i);
      return;
    }
    const from = this.active < 0 ? this.startIndex() : this.active;
    const next = this.nextEnabled(from, delta > 0 ? 1 : -1);
    if (next >= 0) this.setActive(next);
  }

  /** 当前选中值（无选中为 null） */
  get value(): string | null {
    return this.displayValue;
  }

  /** 是否展开 */
  get expanded(): boolean {
    return this.isOpen;
  }

  /** 外部同步 / 更新配置。value 同步显示但不触发 onChange（UI 选择才会回调） */
  update(patch: Partial<SelectOptions>): void {
    if ("options" in patch && patch.options) {
      this.options = patch.options;
      this.renderOptions();
      this.syncValue();
    }
    if ("value" in patch) {
      this.displayValue = patch.value ?? null;
      this.syncValue();
      if (this.isOpen) this.renderOptions();
    }
    if ("disabled" in patch && patch.disabled !== undefined) {
      this.setDisabled(patch.disabled);
    }
    if ("open" in patch && patch.open !== undefined) {
      patch.open ? this.open() : this.close();
    }
    if ("placeholder" in patch && patch.placeholder !== undefined) {
      this.placeholder = patch.placeholder;
      this.syncValue();
    }
    if ("ariaLabel" in patch && patch.ariaLabel !== undefined) {
      this.trigger.setAttribute("aria-label", patch.ariaLabel);
    }
    if ("frosted" in patch && patch.frosted !== undefined) {
      this.frosted = patch.frosted;
      this.panel.classList.toggle("is-frosted", this.frosted);
    }
  }

  /** 程序化选中（等价 update({ value })） */
  setValue(value: string | null): void {
    this.update({ value });
  }

  /** 动态切换整体禁用 */
  setDisabled(v: boolean): void {
    this.isDisabled = v;
    this.root.classList.toggle("is-disabled", v);
    this.trigger.disabled = v;
    if (v) this.close();
  }

  /** 销毁组件，清空宿主容器并移除 body 上的面板 */
  destroy(): void {
    if (this.closeTimer !== null) clearTimeout(this.closeTimer);
    this.close();
    this.panel.remove();
    this.root.classList.remove("qsel", "is-open", "is-disabled");
    if (this.customClass) this.root.classList.remove(this.customClass);
    this.root.textContent = "";
  }
}
