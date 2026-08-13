/* ============================================================
   青梧UI · 标签快捷插入组件（TagInput）
   - 输入框 + 下方标签快捷栏：点击标签按钮自动填入输入框
   - 已插入的标签从快捷栏消失，输入值中删除后自动重现
   - @apricotdream/text-layout 的 layoutChips 驱动展开/收起与标签栏高度
   - 受控 / 非受控双模式，全键盘可用（Tab + 方向键 + Enter）
   - 零框架依赖，纯 DOM + CSS
   ============================================================ */

import type { ChipItem } from "@apricotdream/text-layout";
import { layoutChips } from "@apricotdream/text-layout";
import type { TagInputOptions } from "./types";

/* ---------- 布局常量（与 style.css 对齐） ---------- */
/** 标签栏单行高度 px（chip 高 24 + 上下 margin 2） */
const LINE_HEIGHT = 28;
/** chip 额外宽度：插入按钮左右 padding 20 + × 按钮 18（tinted 风格无边框） */
const CHIP_EXTRA = 38;
/** "+N 更多" 按钮额外宽度：左右 padding 20 */
const MORE_EXTRA = 20;
/** 标签栏垂直内边距 */
const BAR_PAD_Y = 4;
/** 测量宽度回退（无样式/隐藏容器时） */
const FALLBACK_WIDTH = 400;
const FALLBACK_FONT = "14px system-ui";

/** Lucide xmark（16px 渲染 10px，细线） */
const CLOSE_ICON =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/* ---------- 默认解析：逗号分隔 ---------- */
function defaultParseTags(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ---------- 工具 ---------- */
function el(tag: string, cls?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

/* ============================================================ */
export class TagInput {
  /* ---- 配置 ---- */
  private readonly opts: TagInputOptions;
  private readonly controlledValue: boolean;
  private readonly controlledTags: boolean;
  private readonly inline: boolean;
  private readonly controlledSelected: boolean;

  /* ---- 运行时状态 ---- */
  private valueState: string;
  private tagsState: string[];
  /** inline 模式已选标签数组（一等公民；null = 非 inline） */
  private selectedState: string[] | null;
  private expanded = false;
  private disabled: boolean;
  private readOnly: boolean;

  /* ---- DOM ---- */
  private root!: HTMLElement;
  private inputWrap!: HTMLDivElement;
  private input!: HTMLInputElement;
  private bar!: HTMLDivElement;
  private ro: ResizeObserver | null = null;
  private onResize: (() => void) | null = null;

  constructor(root: HTMLElement, opts: TagInputOptions = {}) {
    this.opts = opts;
    this.controlledValue = opts.value !== undefined;
    this.controlledTags = opts.tags !== undefined;
    this.inline = opts.inline ?? false;
    this.controlledSelected = opts.selected !== undefined;
    /* inline 模式：已选 = 数组（selected/defaultSelected），input 只承载草稿，value 字符串不生效 */
    this.valueState = this.inline ? "" : (opts.value ?? opts.defaultValue ?? "");
    this.selectedState = this.inline ? (opts.selected ?? opts.defaultSelected ?? []) : null;
    this.tagsState = opts.tags ?? opts.defaultTags ?? [];
    this.disabled = opts.disabled ?? false;
    this.readOnly = opts.readOnly ?? false;

    this.build(root);
    this.bind();
    this.relayout();

    /* 字体加载完成后重排（测量依赖实际字体） */
    if (typeof document !== "undefined" && "fonts" in document) {
      void document.fonts.ready.then(() => this.relayout());
    }
  }

  /* ============================================================
     Build
     ============================================================ */
  private build(root: HTMLElement): void {
    this.root = root;
    const wrap = el("div", "qti");
    if (this.opts.className) wrap.classList.add(this.opts.className);

    this.input = el("input", "qti-input") as HTMLInputElement;
    this.input.type = "text";
    this.input.value = this.valueState;
    this.input.placeholder = this.opts.placeholder ?? "";
    this.input.disabled = this.disabled;
    this.input.readOnly = this.readOnly;
    this.input.setAttribute("autocomplete", "off");
    this.input.setAttribute("spellcheck", "false");
    this.input.setAttribute("aria-label", this.opts.placeholder || "标签输入");

    /* inline 模式：输入框容器内嵌已选标签 chip（chip-in-input） */
    this.inputWrap = el("div", "qti-input-wrap") as HTMLDivElement;
    this.inputWrap.append(this.input);

    this.bar = el("div", "qti-bar") as HTMLDivElement;
    this.bar.setAttribute("role", "group");
    this.bar.setAttribute("aria-label", "快捷标签");

    wrap.append(this.inputWrap, this.bar);
    if (this.opts.inline) wrap.classList.add("qti-inline");
    root.append(wrap);
  }

  /* ============================================================
     Bind
     ============================================================ */
  private bind(): void {
    this.input.addEventListener("input", () => {
      const next = this.input.value;
      if (this.inline) {
        /* inline：input 只承载草稿，onChange 即草稿文本；逗号分段即时提交 */
        this.opts.onChange?.(next);
        this.commitCommaSegments();
      } else {
        if (!this.controlledValue) this.valueState = next;
        this.opts.onChange?.(next);
      }
      /* 标签显隐随输入值实时解析 */
      this.relayout();
    });

    /* 回车：inline 模式提交草稿为已选；bar 模式 allowEnterCreate 时加入快捷栏 */
    this.input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const text = this.input.value.trim();
      if (!text) return;
      if (this.inline) {
        e.preventDefault();
        /* 达上限时保留草稿等待用户处理，其余情况消费草稿（含重复） */
        if (this.tryCommit(text) !== "full") this.input.value = "";
      } else if (this.opts.allowEnterCreate) {
        e.preventDefault();
        this.createTag(text);
      }
    });

    /* 失焦：inline 模式提交未完成的草稿 */
    this.input.addEventListener("blur", () => {
      if (!this.inline) return;
      const text = this.input.value.trim();
      if (!text) return;
      if (this.tryCommit(text) !== "full") this.input.value = "";
    });

    /* 方向键在标签按钮间移动焦点（Enter 由按钮原生触发插入） */
    this.bar.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const btns = Array.from(
        this.bar.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
      );
      const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (idx < 0) return;
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      const next = btns[(idx + step + btns.length) % btns.length];
      next?.focus();
    });

    /* 容器宽度变化重排 */
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.relayout());
      this.ro.observe(this.bar);
    } else if (typeof window !== "undefined") {
      this.onResize = () => this.relayout();
      window.addEventListener("resize", this.onResize);
    }
  }

  /* ============================================================
     解析与匹配
     ============================================================ */
  private norm(s: string): string {
    return s.trim().toLowerCase();
  }

  private parseTags(value: string): string[] {
    return (this.opts.parseTags ?? defaultParseTags)(value);
  }

  /** 已选标签：inline 为一等数组，bar 模式为输入值字符串解析 */
  private activeTags(): string[] {
    return this.inline ? (this.selectedState ?? []) : this.parseTags(this.valueState);
  }

  /** 快捷栏可用标签 = 全部标签 - 已插入的标签 */
  private availableTags(): string[] {
    const active = new Set(this.activeTags().map((t) => this.norm(t)));
    return this.tagsState.filter((t) => !active.has(this.norm(t)));
  }

  private formatInsert(tag: string): string {
    return this.opts.formatInsert ? this.opts.formatInsert(tag) : tag;
  }

  private getFont(): string {
    if (this.opts.font) return this.opts.font;
    if (typeof getComputedStyle === "undefined") return FALLBACK_FONT;
    const cs = getComputedStyle(this.bar);
    const size = cs.fontSize || "";
    const family = cs.fontFamily || "";
    return size && family ? `${size} ${family}` : FALLBACK_FONT;
  }

  /* ============================================================
     布局：layoutChips 计算可见数量与高度
     ============================================================ */
  private relayout(): void {
    /* inline 模式：输入框内渲染已选标签 chip */
    if (this.opts.inline) this.renderInlineChips();

    const avail = this.availableTags();
    const font = this.getFont();
    const maxWidth = this.bar.clientWidth || FALLBACK_WIDTH;

    if (avail.length === 0) {
      this.renderBar([], 0, undefined, 0);
      return;
    }

    const chips: ChipItem[] = avail.map((t) => ({ type: "chip", text: t, extraWidth: CHIP_EXTRA }));
    const full = layoutChips(chips, maxWidth, font, 0, LINE_HEIGHT);
    const totalLines = full.lines.length;

    /* 未启用折叠或全部放得下 → 全量渲染 */
    if (this.opts.maxRows === 0 || totalLines <= (this.opts.maxRows ?? 2)) {
      this.renderBar(avail, totalLines, undefined, avail.length);
      return;
    }

    const maxRows = this.opts.maxRows ?? 2;

    /* 展开态：全量 + 收起按钮 */
    if (this.expanded) {
      this.renderBar(avail, totalLines, avail.length, avail.length);
      return;
    }

    /* 折叠态：二分求「前缀 chip + "+N 更多"」能放进 maxRows 行的最大数量 */
    const n = avail.length;
    let lo = 0;
    let hi = n - 1; // 至少保留一个隐藏标签
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const test: ChipItem[] = [
        ...chips.slice(0, mid),
        { type: "chip", text: `+${n - mid}`, extraWidth: MORE_EXTRA },
      ];
      const r = layoutChips(test, maxWidth, font, 0, LINE_HEIGHT);
      if (r.lines.length <= maxRows) lo = mid;
      else hi = mid - 1;
    }
    const moreLayout = layoutChips(
      [...chips.slice(0, lo), { type: "chip", text: `+${n - lo}`, extraWidth: MORE_EXTRA }],
      maxWidth,
      font,
      0,
      LINE_HEIGHT,
    );
    this.renderBar(avail, totalLines, lo, n, moreLayout.lines.length);
  }

  /** 渲染标签栏（数量小，直接重建） */
  private renderBar(
    avail: string[],
    totalLines: number,
    visibleCount: number | undefined,
    total: number,
    collapsedLines?: number,
  ): void {
    this.bar.textContent = "";

    const collapsed = visibleCount !== undefined && visibleCount < total;
    const shown = collapsed ? avail.slice(0, visibleCount) : avail;

    const frag = document.createDocumentFragment();
    for (const tag of shown) frag.append(this.buildChip(tag));

    if (collapsed && visibleCount !== undefined) {
      frag.append(
        this.buildToggle(`+${total - visibleCount} 更多`, "展开全部标签", () => {
          this.expanded = true;
          this.relayout();
        }),
      );
    } else if (this.expanded && totalLines > (this.opts.maxRows ?? 2) && this.opts.maxRows !== 0) {
      frag.append(
        this.buildToggle(this.opts.collapseLabel ?? "收起", "收起标签栏", () => {
          this.expanded = false;
          this.relayout();
        }),
      );
    }

    this.bar.append(frag);

    /* 高度由 layoutChips 决定，overflow 裁剪兜底 */
    const lines = collapsed ? (collapsedLines ?? this.opts.maxRows ?? 2) : totalLines;
    this.bar.style.height = `${lines * LINE_HEIGHT + BAR_PAD_Y * 2}px`;
  }

  private buildChip(tag: string, mode: "bar" | "inline" = "bar"): HTMLElement {
    const wrap = el("span", "qti-tag");

    const insert = el("button", "qti-tag-insert") as HTMLButtonElement;
    insert.type = "button";
    insert.textContent = tag;
    insert.disabled = this.disabled || this.readOnly;
    insert.title = mode === "inline" ? `移除标签 ${tag}` : `插入标签 ${tag}`;
    insert.setAttribute("aria-label", insert.title);
    insert.addEventListener("click", () => {
      if (mode === "inline") this.removeSelected(tag);
      else this.insertTag(tag);
    });
    wrap.append(insert);

    if (this.opts.removable !== false && !this.disabled) {
      const remove = el("button", "qti-tag-remove") as HTMLButtonElement;
      remove.type = "button";
      remove.disabled = this.readOnly;
      remove.innerHTML = CLOSE_ICON;
      remove.title = mode === "inline" ? `移除标签 ${tag}` : `移除标签 ${tag}`;
      remove.setAttribute("aria-label", `移除标签 ${tag}`);
      remove.addEventListener("click", () => {
        if (mode === "inline") this.removeSelected(tag);
        else this.removeTag(tag);
      });
      wrap.append(remove);
    }

    return wrap;
  }

  private buildToggle(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
    const btn = el("button", "qti-more") as HTMLButtonElement;
    btn.type = "button";
    btn.textContent = label;
    btn.disabled = this.disabled || this.readOnly;
    btn.setAttribute("aria-label", ariaLabel);
    btn.addEventListener("click", onClick);
    return btn;
  }

  /* ============================================================
     值管理
     ============================================================ */
  private setValue(next: string, emit: boolean): void {
    if (!this.controlledValue) this.valueState = next;
    if (emit) this.opts.onChange?.(next);
    this.syncInput();
    this.relayout();
  }

  private setTags(next: string[], emit: boolean): void {
    if (!this.controlledTags) this.tagsState = next;
    if (emit) this.opts.onTagsChange?.(next);
    this.relayout();
  }

  private syncInput(): void {
    if (this.input.value !== this.valueState) this.input.value = this.valueState;
  }

  /* ============================================================
     inline 模式（chip-in-input）
     ============================================================ */

  /** 输入值中的标签数是否已达上限 */
  private atMaxTags(): boolean {
    const max = this.opts.maxTags ?? 0;
    return max > 0 && this.activeTags().length >= max;
  }

  /** inline：提交一个草稿段 —— 入列 / 重复忽略 / 已达上限 */
  private tryCommit(text: string): "added" | "dup" | "full" {
    const tag = text.trim();
    if (!tag) return "dup";
    if (this.atMaxTags()) return "full";
    if (this.activeTags().some((t) => this.norm(t) === this.norm(tag))) return "dup";
    this.setSelected([...this.activeTags(), tag], true);
    return "added";
  }

  /** inline：草稿中出现逗号即分段提交；已消费的段剥离出草稿，尾段保留 */
  private commitCommaSegments(): void {
    const draft = this.input.value;
    if (!draft.includes(",")) return;
    const parts = draft.split(",");
    const rest: string[] = [];
    for (const p of parts.slice(0, -1)) {
      /* 达上限的段保留在草稿（避免静默丢失），重复段与入列段一样被消费 */
      if (this.tryCommit(p) === "full") rest.push(p);
    }
    this.input.value = [...rest, parts[parts.length - 1] ?? ""].join(",");
  }

  /** inline：从已选数组移除一个标签 */
  private removeSelected(tag: string): void {
    const rest = this.activeTags().filter((t) => this.norm(t) !== this.norm(tag));
    this.setSelected(rest, true);
  }

  /** inline：更新已选数组（受控仅回调，非受控直接落内部） */
  private setSelected(next: string[], emit: boolean): void {
    if (!this.controlledSelected) this.selectedState = next;
    if (emit) this.opts.onSelectedChange?.(next);
    this.relayout();
  }

  /** inline：输入框内渲染已选标签 chip（插到输入框之前） */
  private renderInlineChips(): void {
    const chips = this.inputWrap.querySelectorAll(".qti-tag");
    for (const c of Array.from(chips)) c.remove();
    for (const tag of this.activeTags()) {
      this.inputWrap.insertBefore(this.buildChip(tag, "inline"), this.input);
    }
  }

  /* ============================================================
     Public API
     ============================================================ */

  /** 当前输入值：inline 模式为草稿文本（input 当前内容），bar 模式为逗号拼接串 */
  get value(): string {
    return this.inline ? this.input.value : this.valueState;
  }

  /** inline 模式已选标签数组（bar 模式返回空数组） */
  get selected(): string[] {
    return this.inline ? [...(this.selectedState ?? [])] : [];
  }

  /** 全部可用标签（含已插入的） */
  get tags(): string[] {
    return [...this.tagsState];
  }

  /**
   * 插入标签到输入框（已存在则忽略）。标签不在可用列表中也可插入。
   * 非受控模式立即生效；受控模式触发 onChange，等待外部 update({ value }) 同步
   */
  insertTag(tag: string): void {
    const normalized = tag.trim();
    if (!normalized) return;
    if (this.activeTags().some((t) => this.norm(t) === this.norm(normalized))) return;
    if (this.atMaxTags()) return;
    if (this.inline) {
      /* inline：点建议 = 提交已选，并清空未提交草稿 */
      this.setSelected([...this.activeTags(), normalized], true);
      this.input.value = "";
    } else {
      const cur = this.valueState;
      const next = cur ? `${cur}, ${this.formatInsert(normalized)}` : this.formatInsert(normalized);
      this.setValue(next, true);
    }
    this.input.focus();
  }

  /**
   * 将文本创建为新标签加入快捷栏（allowEnterCreate 的内部逻辑，也可程序化调用）。
   * 已存在（快捷栏中，或输入值中除本次输入外的其他标签）则忽略并清空输入；
   * 触发 onTagsChange
   */
  createTag(text: string): void {
    if (this.inline) return; // 仅 bar 模式语义：新建快捷栏标签
    const normalized = text.trim();
    if (!normalized) return;
    /* 输入值中的其他标签（排除本次输入文本本身） */
    const restActive = this.activeTags().filter((t) => this.norm(t) !== this.norm(normalized));
    const exists =
      restActive.some((t) => this.norm(t) === this.norm(normalized)) ||
      this.tagsState.some((t) => this.norm(t) === this.norm(normalized));
    if (!exists) {
      this.setTags([...this.tagsState, normalized], true);
    }
    this.setValue("", true);
  }

  /** 从可用标签列表移除一个标签（仅作用于快捷栏，不修改输入值） */
  removeTag(tag: string): void {
    const next = this.tagsState.filter((t) => t !== tag);
    if (next.length === this.tagsState.length) return;
    this.setTags(next, true);
  }

  /**
   * 外部同步受控值。受控模式下用户操作仅回调，由调用方据此更新并调用本方法
   */
  update(opts: { value?: string; tags?: string[]; selected?: string[] }): void {
    if (this.inline) {
      /* inline：value 字符串不生效，已选只认 selected 数组（回灌后草稿不受影响） */
      if (opts.selected !== undefined) {
        this.selectedState = [...opts.selected];
      }
    } else if (opts.value !== undefined) {
      this.valueState = opts.value;
      this.syncInput();
    }
    if (opts.tags !== undefined) {
      this.tagsState = opts.tags;
    }
    this.relayout();
  }

  setDisabled(v: boolean): void {
    this.disabled = v;
    this.input.disabled = v;
    this.relayout();
  }

  setReadOnly(v: boolean): void {
    this.readOnly = v;
    this.input.readOnly = v;
    this.relayout();
  }

  /** 销毁组件，释放所有资源 */
  destroy(): void {
    this.ro?.disconnect();
    if (this.onResize) window.removeEventListener("resize", this.onResize);
    this.root.textContent = "";
  }
}
