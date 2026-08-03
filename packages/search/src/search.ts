/* ============================================================
   青梧UI · 搜索框组件（SearchBox）
   - 自渲染触发条 → 模态面板 → 结果列表 → toast
   - 打字机轮播占位 / 键盘导航 / 结果入场动画 / 焦点陷阱
   - 零框架依赖，纯 DOM + CSS
   ============================================================ */

import type { SearchFn, SearchItem, SearchOptions } from "./types";
import { Typewriter } from "./typewriter";

/* ---------- 运行时常量 ---------- */
const PREFERS_REDUCED =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

const IS_MAC =
  typeof navigator !== "undefined"
    ? /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    : false;

/* ---------- SVG 图标（由 icon/icons.ts 提供） ---------- */
import { ICO_SEARCH, ICO_MENU, ICON_CLOSE, SEARCH_ART } from "../../../icon/icons";
const ICO = {
  search: ICO_SEARCH,
  menu: ICO_MENU,
  close: ICON_CLOSE,
  art: SEARCH_ART,
} as const;

/* ---------- 工具函数 ---------- */
function el(tag: string, cls?: string, html?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function qs<T extends HTMLElement>(el: HTMLElement, sel: string): T {
  return el.querySelector(sel) as T;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHTML(s: string): string {
  return s.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);
}

/* ============================================================ */
export class SearchBox {
  /* ---- 配置 ---- */
  private root: HTMLElement;
  private words: string[];
  private items: SearchItem[];
  private categories: string[];
  private readonly onSelectCb?: (item: SearchItem) => void;
  private readonly onQueryChangeCb?: (query: string) => void;
  private readonly animate: boolean;
  private readonly staticMode: boolean;
  /** 是否渲染内置触发条（false 时宿主自定义入口，仅保留全局快捷键与 open()/close()） */
  private readonly withTrigger: boolean;
  /** 异步搜索函数（服务端模式），提供时优先于本地 items 筛选 */
  private readonly searchFn?: SearchFn;
  private readonly debounceMs: number;
  private readonly minQuery: number;
  /** 加载态精灵图 URL 与帧数（缺省时加载态仅文案） */
  private readonly spriteUrl?: string;
  private readonly spriteFrames: number;

  /* ---- 运行时状态 ---- */
  private cat = "全部";
  private visible: SearchItem[] = [];
  private active = -1;
  private isOpen = false;
  private returnFocus: HTMLElement | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private wasEmpty = false;
  /* 异步模式：防抖定时器 / 在途请求控制器 / 最近一次结果（供类别筛选复用） */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private abortCtl: AbortController | null = null;
  private lastResults: SearchItem[] = [];
  private searchBusy = false;

  /* ---- DOM 引用 ---- */
  private trigger: HTMLButtonElement | null = null;
  private triggerTw: HTMLElement | null = null;
  private overlay!: HTMLElement;
  private panel!: HTMLElement;
  private bar!: HTMLElement;
  private input!: HTMLInputElement;
  private ph!: HTMLElement;
  private menuBtn!: HTMLButtonElement;
  private clearBtn!: HTMLButtonElement;
  private closeBtn!: HTMLButtonElement;
  private filterbar!: HTMLElement;
  private filterChip!: HTMLButtonElement;
  private empty!: HTMLElement;
  private emptyText!: HTMLElement;
  private emptySub!: HTMLElement;
  private loading!: HTMLElement;
  private list!: HTMLUListElement;
  private toasts!: HTMLElement;
  private focusables: HTMLElement[] = [];

  /* ---- 引擎 ---- */
  private twTrigger: Typewriter | null = null;
  private twModal: Typewriter;
  private docKey: ((e: KeyboardEvent) => void) | null = null;
  private globalKey: ((e: KeyboardEvent) => void) | null = null;

  constructor(root: HTMLElement, opts: SearchOptions = {}) {
    this.root = root;
    this.words = opts.placeholders?.length ? opts.placeholders : ["搜索…"];
    this.items = opts.items ?? [];
    this.categories = opts.categories ?? ["全部", "节日", "节气", "功能", "日期"];
    this.onSelectCb = opts.onSelect;
    this.onQueryChangeCb = opts.onQueryChange;
    this.animate = opts.typewriter !== false;
    this.staticMode = !this.animate || PREFERS_REDUCED;
    this.withTrigger = opts.trigger !== false;
    this.searchFn = opts.search;
    this.debounceMs = opts.debounceMs ?? 200;
    this.minQuery = Math.max(1, opts.minQuery ?? 1);
    this.spriteUrl = opts.loadingSpriteUrl;
    this.spriteFrames = Math.max(2, opts.loadingSpriteFrames ?? 5);

    this.cat = this.categories[0] ?? "全部";

    this.build();
    this.root.classList.toggle("qs-is-static", this.staticMode);
    this.bind();

    if (this.triggerTw) {
      this.twTrigger = new Typewriter(this.triggerTw, this.words, { reduced: this.staticMode });
      this.twTrigger.start();
    }
    this.twModal = new Typewriter(this.ph, this.words, { reduced: this.staticMode });
  }

  /* ============================================================
     Build：一次性创建全部 DOM
     ============================================================ */
  private build(): void {
    /* 触发条（trigger: false 时不渲染，宿主自定义入口） */
    if (this.withTrigger) {
      const trigger = el("button", "qs-trigger") as HTMLButtonElement;
      trigger.type = "button";
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-label", "打开搜索");
      trigger.innerHTML =
        ICO.search +
        '<span class="qs-tw" aria-hidden="true"></span>' +
        '<span class="qs-trigger-keys"><kbd>/</kbd><span class="or">或</span><kbd>' +
        (IS_MAC ? "⌘" : "Ctrl") +
        "</kbd><kbd>K</kbd></span>";
      this.trigger = trigger;
      this.triggerTw = qs(trigger, ".qs-tw");
    }

    /* 遮罩 + 面板 */
    this.overlay = el("div", "qs-overlay");
    this.overlay.hidden = true;
    this.panel = el("div", "qs-panel");
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-label", "搜索");

    /* 搜索栏 */
    this.bar = el("div", "qs-bar");
    this.bar.innerHTML = ICO.search;
    const inputWrap = el("div", "qs-input-wrap");
    this.input = el("input", "qs-input") as HTMLInputElement;
    this.input.type = "text";
    this.input.setAttribute("role", "combobox");
    this.input.setAttribute("aria-expanded", "false");
    this.input.setAttribute("aria-controls", "qs-list");
    this.input.setAttribute("aria-autocomplete", "list");
    this.input.setAttribute("aria-label", "搜索");
    this.input.setAttribute("autocomplete", "off");
    this.input.setAttribute("spellcheck", "false");
    this.ph = el("span", "qs-ph");
    this.ph.setAttribute("aria-hidden", "true");

    /* 清空键：移入输入框内部，有文字时浮现（小 ⌫） */
    this.clearBtn = el("button", "qs-clear", "⌫") as HTMLButtonElement;
    this.clearBtn.type = "button";
    this.clearBtn.setAttribute("aria-label", "清除搜索内容");
    this.clearBtn.disabled = true;
    inputWrap.append(this.input, this.ph, this.clearBtn);

    this.menuBtn = el("button", "qs-iconbtn", ICO.menu) as HTMLButtonElement;
    this.menuBtn.type = "button";
    this.menuBtn.setAttribute("aria-label", "切换筛选类别");
    this.menuBtn.setAttribute("aria-pressed", "false");
    this.menuBtn.title = "筛选类别";

    /* 关闭键：输入条最右侧，关闭整个面板 */
    this.closeBtn = el("button", "qs-iconbtn qs-close", ICO.close) as HTMLButtonElement;
    this.closeBtn.type = "button";
    this.closeBtn.setAttribute("aria-label", "关闭搜索");
    this.closeBtn.title = "关闭搜索";

    this.bar.append(inputWrap, this.menuBtn, this.closeBtn);

    /* 筛选条 */
    this.filterbar = el("div", "qs-filterbar", "<span>当前筛选</span>");
    this.filterChip = el("button", "qs-filter-chip") as HTMLButtonElement;
    this.filterChip.type = "button";
    this.filterbar.append(this.filterChip);

    /* 内容区 */
    const body = el("div", "qs-body");
    this.empty = el("div", "qs-empty");
    this.empty.innerHTML =
      ICO.art +
      '<div class="qs-empty-text">在找些什么？</div>' +
      '<div class="qs-empty-sub">TRY TYPING &laquo;中秋&raquo; OR &laquo;霜降&raquo;</div>';
    this.emptyText = qs(this.empty, ".qs-empty-text");
    this.emptySub = qs(this.empty, ".qs-empty-sub");

    /* 加载态：精灵条 steps 帧动画（与博客列表页同款机制），无 URL 时降级为纯文案 */
    this.loading = el("div", "qs-loading");
    this.loading.hidden = true;
    if (this.spriteUrl) {
      const leaf = el("div", "qs-loading-leaf");
      const frame = el("div", "qs-loading-frame");
      const sprite = el("span", "qs-loading-sprite");
      sprite.style.backgroundImage = `url(${this.spriteUrl})`;
      sprite.style.setProperty("--qs-frames", String(this.spriteFrames));
      frame.append(sprite);
      leaf.append(frame);
      this.loading.append(leaf);
    }
    this.loading.append(el("span", "qs-loading-status", "搜索中…"));

    this.list = el("ul", "qs-list") as HTMLUListElement;
    this.list.id = "qs-list";
    this.list.setAttribute("role", "listbox");
    this.list.hidden = true;
    body.append(this.empty, this.loading, this.list);

    /* 底部快捷键栏 */
    const foot = el(
      "div",
      "qs-foot",
      '<span class="grp"><kbd>↑</kbd><kbd>↓</kbd> 导航</span>' +
        '<span class="grp"><kbd>↵</kbd> 选择</span>' +
        '<span class="grp"><kbd>esc</kbd> 关闭</span>',
    );

    this.panel.append(this.bar, this.filterbar, body, foot);
    this.overlay.append(this.panel);

    /* toast 容器 */
    this.toasts = el("div", "qs-toasts");

    if (this.trigger) this.root.append(this.trigger);
    /* 遮罩与 toast 挂到 document.body：脱离宿主 DOM，避免宿主的
       transform/filter/overflow 等属性把 fixed 定位污染成包含块裁剪 */
    document.body.append(this.overlay, this.toasts);
    this.focusables = [this.input, this.clearBtn, this.menuBtn, this.closeBtn];
  }

  /* ============================================================
     Bind：事件绑定
     ============================================================ */
  private bind(): void {
    this.trigger?.addEventListener("click", () => {
      this.open();
    });

    this.input.addEventListener("input", () => {
      this.syncHasValue();
      this.renderResults();
      this.onQueryChangeCb?.(this.input.value);
    });

    this.clearBtn.addEventListener("click", () => {
      if (!this.input.value) return;
      this.input.value = "";
      this.syncHasValue();
      this.renderResults();
      this.onQueryChangeCb?.("");
      this.input.focus();
    });

    this.menuBtn.addEventListener("click", () => {
      this.cycleCategory();
    });
    this.closeBtn.addEventListener("click", () => {
      this.close();
    });
    this.filterChip.addEventListener("click", () => {
      this.setCategory(this.categories[0] ?? "全部");
    });

    /* 结果点击 / 悬停（事件委托） */
    this.list.addEventListener("click", (e) => {
      const opt = (e.target as HTMLElement).closest<HTMLElement>(".qs-opt");
      if (opt) this.select(Number(opt.dataset.index));
    });
    this.list.addEventListener("mousemove", (e) => {
      const opt = (e.target as HTMLElement).closest<HTMLElement>(".qs-opt");
      if (opt) this.setActive(Number(opt.dataset.index), false);
    });

    /* 点遮罩关闭 */
    this.overlay.addEventListener("mousedown", (e) => {
      if (e.target === this.overlay) this.close();
    });

    /* 面板内键盘：方向键 / 回车结果导航 */
    this.panel.addEventListener("keydown", (e) => this.onPanelKey(e));

    /* 全局唤起 */
    this.globalKey = (e) => {
      const tag = document.activeElement?.tagName ?? "";
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        !!document.activeElement?.getAttribute("contenteditable");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.isOpen ? this.close() : this.open();
      } else if (e.key === "/" && !typing && !this.isOpen) {
        e.preventDefault();
        this.open();
      }
    };
    document.addEventListener("keydown", this.globalKey);

    /* 文档级 capture：模态期间的 Tab/Esc 统一接管 */
    this.docKey = (e) => {
      if (!this.isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.handleEscape();
      } else if (e.key === "Tab") {
        this.trapTab(e);
      }
    };
    document.addEventListener("keydown", this.docKey, true);
  }

  /* ============================================================
     Public API
     ============================================================ */

  /** 打开搜索面板 */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.returnFocus = document.activeElement as HTMLElement | null;
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.overlay.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => this.overlay.classList.add("is-open"));

    this.input.value = "";
    this.syncHasValue();
    this.renderResults();

    this.twTrigger?.stop();
    this.twModal.start();
    requestAnimationFrame(() => this.input.focus());
  }

  /** 关闭搜索面板 */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    this.twModal.stop();
    this.twTrigger?.start();

    const finish = () => {
      this.overlay.hidden = true;
      this.closeTimer = null;
    };
    this.closeTimer = PREFERS_REDUCED ? null : setTimeout(finish, 220);
    if (PREFERS_REDUCED) finish();

    const rf = this.returnFocus;
    this.returnFocus = null;
    rf?.focus();
  }

  /** 销毁组件，释放所有资源 */
  destroy(): void {
    this.twTrigger?.destroy();
    this.twModal.destroy();
    if (this.closeTimer !== null) clearTimeout(this.closeTimer);
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.abortCtl?.abort();
    if (this.docKey) document.removeEventListener("keydown", this.docKey, true);
    if (this.globalKey) document.removeEventListener("keydown", this.globalKey);
    this.overlay.remove();
    this.toasts.remove();
    this.root.textContent = "";
  }

  /* ============================================================
     键盘处理
     ============================================================ */

  private onPanelKey(e: KeyboardEvent): void {
    if (document.activeElement !== this.input) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.visible.length)
        this.setActive(this.active < 0 ? 0 : Math.min(this.active + 1, this.visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (this.visible.length) this.setActive(this.active <= 0 ? 0 : this.active - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (this.visible.length) this.select(this.active < 0 ? 0 : this.active);
    }
  }

  private handleEscape(): void {
    if (this.input.value) {
      this.input.value = "";
      this.syncHasValue();
      this.renderResults();
    } else {
      this.close();
    }
  }

  private trapTab(e: KeyboardEvent): void {
    const f = this.focusables.filter((x) => !(x as HTMLButtonElement).disabled);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (!this.panel.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ============================================================
     筛选类别
     ============================================================ */
  private cycleCategory(): void {
    const idx = this.categories.indexOf(this.cat);
    const next = this.categories[(idx + 1) % this.categories.length];
    if (next) this.setCategory(next);
  }

  private setCategory(cat: string): void {
    this.cat = cat;
    const on = cat !== this.categories[0];
    this.menuBtn.setAttribute("aria-pressed", String(on));
    this.filterbar.classList.toggle("show", on);
    if (on) {
      this.filterChip.innerHTML = `${cat} <i aria-hidden="true">&times;</i>`;
      this.filterChip.setAttribute("aria-label", `清除筛选：${cat}`);
    }
    /* 异步模式：复用最近一次结果按新类别过滤，避免重复请求 */
    if (this.searchFn && this.lastResults.length && this.input.value.trim()) {
      this.applyResults();
    } else {
      this.renderResults();
    }
    if (this.isOpen) this.input.focus();
  }

  /* ============================================================
     结果渲染 / 高亮 / 选择
     ============================================================ */
  private syncHasValue(): void {
    this.bar.classList.toggle("has-value", this.input.value.length > 0);
    this.clearBtn.disabled = this.input.value.length === 0;
  }

  private match(item: SearchItem, q: string): boolean {
    if (this.cat !== this.categories[0] && item.kind !== this.cat) return false;
    if (!q) return true;
    const title = item.title.toLowerCase();
    const sub = (item.sub ?? "").toLowerCase();
    return title.includes(q) || sub.includes(q);
  }

  private highlight(text: string, q: string): string {
    if (!q) return escapeHTML(text);
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) return escapeHTML(text);
    return (
      escapeHTML(text.slice(0, idx)) +
      "<mark>" +
      escapeHTML(text.slice(idx, idx + q.length)) +
      "</mark>" +
      escapeHTML(text.slice(idx + q.length))
    );
  }

  private playEmptyEnter(): void {
    if (PREFERS_REDUCED) return;
    this.empty.classList.remove("is-enter");
    void this.empty.offsetWidth;
    this.empty.classList.add("is-enter");
  }

  private renderResults(): void {
    const raw = this.input.value.trim();
    const q = raw.toLowerCase();

    /* 无输入 → 空状态（不发异步请求，并中止在途请求） */
    if (!q) {
      this.abortCtl?.abort();
      this.showIdle();
      return;
    }
    /* 异步模式：防抖后交服务端 */
    if (this.searchFn) {
      this.scheduleSearch(raw);
      return;
    }
    /* 本地模式：items 内筛选 */
    this.renderLocal(q);
  }

  /** 无查询空状态（空闲态） */
  private showIdle(): void {
    this.list.hidden = true;
    this.loading.hidden = true;
    this.empty.hidden = false;
    if (!this.wasEmpty) this.playEmptyEnter();
    this.wasEmpty = true;
    this.emptyText.innerHTML = "在找些什么？";
    this.emptySub.textContent = "TRY TYPING «中秋» OR «霜降»";
    this.input.setAttribute("aria-expanded", "false");
    this.active = -1;
  }

  /** 无结果空状态 */
  private renderNoResults(q: string): void {
    this.list.hidden = true;
    this.loading.hidden = true;
    this.empty.hidden = false;
    if (!this.wasEmpty) this.playEmptyEnter();
    this.wasEmpty = true;
    this.emptyText.innerHTML = `没有匹配 <b>「${escapeHTML(q)}」</b> 的结果`;
    this.emptySub.textContent =
      this.cat !== this.categories[0] ? `FILTER · ${this.cat}` : "TRY ANOTHER KEYWORD";
    this.input.setAttribute("aria-expanded", "false");
    this.active = -1;
  }

  /** 本地模式：items 筛选 + 渲染 */
  private renderLocal(q: string): void {
    this.visible = this.items.filter((it) => this.match(it, q));
    if (this.visible.length === 0) {
      this.renderNoResults(q);
      return;
    }
    this.renderList(q);
  }

  /** 渲染结果列表（本地 / 异步共用） */
  private renderList(q: string): void {
    const playStagger = this.wasEmpty;
    this.wasEmpty = false;
    this.empty.hidden = true;
    this.loading.hidden = true;
    this.list.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    this.list.textContent = "";

    const frag = document.createDocumentFragment();
    this.visible.forEach((item, idx) => {
      const li = el("li");
      const btn = el("button", "qs-opt") as HTMLButtonElement;
      btn.type = "button";
      btn.dataset.index = String(idx);
      btn.id = `qs-opt-${idx}`;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", "false");
      if (playStagger) {
        btn.classList.add("is-enter");
        btn.style.animationDelay = `${Math.min(idx, 8) * 28}ms`;
      }
      const glyph = item.glyph || item.title.slice(0, 1);
      const kindLabel = item.kind ?? "";
      btn.innerHTML =
        `<span class="qs-opt-ico">${escapeHTML(glyph)}</span>` +
        `<span class="qs-opt-main"><span class="qs-opt-title">${this.highlight(item.title, q)}</span>` +
        `<span class="qs-opt-sub">${this.highlight(item.sub ?? "", q)}</span></span>` +
        `<span class="qs-opt-kind kind-${escapeHTML(kindLabel)}">${escapeHTML(kindLabel)}</span>`;
      li.append(btn);
      frag.append(li);
    });
    this.list.append(frag);
    this.setActive(0, false);
  }

  /* ============================================================
     异步模式：防抖 → 请求 → loading / 结果 / 错误
     ============================================================ */

  /** 防抖：输入停顿 debounceMs 后才发起请求 */
  private scheduleSearch(raw: string): void {
    if (raw.length < this.minQuery) {
      this.showIdle();
      return;
    }
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.doSearch(raw);
    }, this.debounceMs);
  }

  /** 发起异步搜索：abort 旧请求，竞态安全（过期响应由 signal 丢弃） */
  private doSearch(raw: string): void {
    this.abortCtl?.abort();
    const ctl = new AbortController();
    this.abortCtl = ctl;
    this.searchBusy = true;
    this.renderSearching();

    this.searchFn!(raw, ctl.signal)
      .then((items) => {
        if (ctl.signal.aborted) return;
        this.searchBusy = false;
        this.lastResults = items;
        this.applyResults();
      })
      .catch(() => {
        if (ctl.signal.aborted) return;
        this.searchBusy = false;
        this.renderSearchError(raw);
      });
  }

  /** 请求在途加载态：精灵条 steps 帧动画（有 URL 时），无 URL 降级为纯文案 */
  private renderSearching(): void {
    this.list.hidden = true;
    this.empty.hidden = true;
    this.loading.hidden = false;
    this.wasEmpty = true;
    this.input.setAttribute("aria-expanded", "false");
    this.active = -1;
  }

  /** 请求失败空态（保留输入，继续输入会重发请求） */
  private renderSearchError(q: string): void {
    this.list.hidden = true;
    this.loading.hidden = true;
    this.empty.hidden = false;
    this.wasEmpty = true;
    this.emptyText.innerHTML = `「${escapeHTML(q)}」搜索失败`;
    this.emptySub.textContent = "请检查网络后重试";
    this.input.setAttribute("aria-expanded", "false");
    this.active = -1;
  }

  /** 应用异步结果：类别筛选 + 渲染（不再做 title/sub 匹配，匹配由服务端完成） */
  private applyResults(): void {
    const q = this.input.value.trim().toLowerCase();
    if (!q) {
      this.showIdle();
      return;
    }
    this.visible = this.lastResults.filter(
      (it) => this.cat === this.categories[0] || it.kind === this.cat,
    );
    if (this.visible.length === 0) {
      this.renderNoResults(q);
      return;
    }
    this.renderList(q);
  }

  private setActive(idx: number, scroll = true): void {
    if (!this.visible.length) return;
    this.active = Math.max(0, Math.min(idx, this.visible.length - 1));
    const opts = this.list.querySelectorAll<HTMLElement>(".qs-opt");
    opts.forEach((o, i) => {
      const on = i === this.active;
      o.classList.toggle("is-active", on);
      o.setAttribute("aria-selected", String(on));
      if (on && scroll) o.scrollIntoView({ block: "nearest" });
    });
    const act = this.list.querySelector<HTMLElement>(".qs-opt.is-active");
    if (act) this.input.setAttribute("aria-activedescendant", act.id);
  }

  private select(idx: number): void {
    const item = this.visible[idx];
    if (!item) return;
    this.toast(`已选择 · ${item.title}`);
    this.onSelectCb?.(item);
    this.close();
  }

  /* ---- toast ---- */
  private toast(msg: string): void {
    const t = el("div", "qs-toast", '<span class="tick">✓</span><span></span>');
    const textNode = t.lastChild;
    if (textNode) textNode.textContent = msg;
    this.toasts.append(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 260);
    }, 2200);
  }
}
