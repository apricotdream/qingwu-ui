/* ============================================================
   青梧UI · 日历组件（Calendar）
   - 输入框+日历图标触发 → 弹出日历面板
   - 日期格：公历 + 农历 + 节日 + 节气 + 休假标记
   - 点击日期 → 右侧详情面板（节日渊源/节气/黄历宜忌）
   - 零框架依赖，纯 DOM + CSS
   ============================================================ */

import { getYearGanzhi } from "./lunar";
import type { DayMetaProvider, PanelProvider } from "./providers";
import { DetailPanelProvider, HolidayBadgeProvider, LunarDayMetaProvider } from "./providers";
import type { CalendarMode, CalendarUiOptions, DetailPosition, HolidayConfig } from "./types";

/* ---------- 运行时常量 ---------- */

type ViewMode = "day" | "month" | "year";

const PREFERS_REDUCED =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/* ---------- SVG 图标（由 icon/icons.ts 提供） ---------- */
import { ICO_ARROW_LEFT, ICO_ARROW_RIGHT, ICO_CALENDAR } from "../../../../icon/icons";

const CALENDAR_ICON = ICO_CALENDAR;
const ARROW_LEFT = ICO_ARROW_LEFT;
const ARROW_RIGHT = ICO_ARROW_RIGHT;

/* ---------- 工具函数 ---------- */

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function toDate(input: Date | string | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ============================================================ */

export class Calendar {
  /* ---- 配置 ---- */
  private root: HTMLElement;
  private readonly mode: CalendarMode;
  /** dateOnly：仅选日期，隐藏时分秒输入，onChange 回发 YYYY-MM-DD */
  private readonly dateOnly: boolean;
  private selected: Date;
  private viewDate: Date; // 当前视图的年月
  private minDate: Date | null;
  private maxDate: Date | null;
  private readonly placeholder: string;
  private readonly inputName: string | undefined;
  private readonly onChangeCb?: (date: string) => void;
  private readonly onOpenChangeCb?: (open: boolean) => void;
  /** 控制点击日期后右侧详情面板的显示 */
  private readonly showDetailPanel: boolean;
  /** 详情面板悬浮方式：inside 内覆盖浮层（不改面板宽）/ left 左展开 / right 右展开 */
  private readonly detailPosition: DetailPosition;
  /** 节假日配置 */
  private readonly holidays: HolidayConfig;
  private readonly animate: boolean;

  /* ---- Provider（默认内置，用户追加在后） ---- */
  private readonly dayMetaProviders: DayMetaProvider[];
  private readonly panelProviders: PanelProvider[];

  /* ---- 状态 ---- */
  private isOpen = false;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  /* ---- popover 专属 ---- */
  private scrollListener: (() => void) | null = null;
  private scrollTargets: Array<Window | HTMLElement> = [];
  private readonly popoverMinWidth = 320;

  /* ---- 提交制快照：open 时记录已确认状态，取消/被动收起时回滚 ---- */
  private snapshot: {
    selected: Date;
    time: { hour: number; minute: number; second: number };
    inputValue: string;
  } | null = null;

  /* ---- DOM 引用 ---- */
  private triggerWrap!: HTMLElement;
  private input!: HTMLInputElement;
  private iconBtn!: HTMLButtonElement;
  private overlay!: HTMLElement;
  private panel!: HTMLElement;
  private mainArea!: HTMLElement;
  private titleEl!: HTMLElement;
  private grid!: HTMLElement;
  private detailPanel!: HTMLElement;
  private detailContent!: HTMLElement;
  private todayBtn!: HTMLButtonElement;
  private confirmBtn!: HTMLButtonElement;

  /* ---- 视图 + 时间 ---- */
  private viewMode: ViewMode = "day";
  private timeRow!: HTMLElement;
  private hourInput!: HTMLInputElement;
  private minuteInput!: HTMLInputElement;
  private secondInput!: HTMLInputElement;
  private selectedTime = { hour: 0, minute: 0, second: 0 };

  /* ---- 事件 ---- */
  private docKey: ((e: KeyboardEvent) => void) | null = null;
  private docClick: ((e: MouseEvent) => void) | null = null;

  constructor(root: HTMLElement, opts: CalendarUiOptions = {}) {
    this.root = root;
    this.mode = opts.mode ?? "modal";
    this.dateOnly = opts.dateOnly ?? false;
    this.selected = toDate(opts.selected) ?? new Date();
    this.viewDate = new Date(this.selected);
    this.viewDate.setDate(1);
    this.minDate = toDate(opts.min);
    this.maxDate = toDate(opts.max);
    this.placeholder = opts.placeholder ?? "选择日期";
    this.inputName = opts.inputName;
    this.onChangeCb = opts.onChange;
    this.onOpenChangeCb = opts.onOpenChange;
    this.showDetailPanel = opts.showDetailPanel ?? true;
    this.detailPosition = opts.detailPosition ?? "right";
    this.holidays = opts.holidays ?? {};
    this.animate = !PREFERS_REDUCED;

    /* 内置 provider 默认注册；用户 provider 追加在后（顺序即渲染顺序） */
    this.dayMetaProviders = [
      new LunarDayMetaProvider(),
      new HolidayBadgeProvider(this.holidays),
      ...(opts.dayMetaProviders ?? []),
    ];
    this.panelProviders = [new DetailPanelProvider(), ...(opts.panelProviders ?? [])];

    this.selectedTime = {
      hour: this.selected.getHours(),
      minute: this.selected.getMinutes(),
      second: this.selected.getSeconds(),
    };
    this.selected = new Date(
      this.selected.getFullYear(),
      this.selected.getMonth(),
      this.selected.getDate(),
    );
    if (this.minDate) {
      this.minDate = new Date(
        this.minDate.getFullYear(),
        this.minDate.getMonth(),
        this.minDate.getDate(),
      );
    }
    if (this.maxDate) {
      this.maxDate = new Date(
        this.maxDate.getFullYear(),
        this.maxDate.getMonth(),
        this.maxDate.getDate(),
      );
    }

    this.build();
    this.bind();
    this.syncInput();
  }

  /* ============================================================
     Build：创建 DOM
     ============================================================ */

  private build(): void {
    /* 触发区 */
    this.triggerWrap = el("div", "qw-cal-trigger");

    this.input = el("input", "qw-cal-input") as HTMLInputElement;
    this.input.type = "text";
    this.input.placeholder = this.placeholder;
    this.input.setAttribute("aria-haspopup", "dialog");
    this.input.setAttribute("readonly", "");
    if (this.inputName) this.input.name = this.inputName;

    this.iconBtn = el("button", "qw-cal-icon-btn", CALENDAR_ICON) as HTMLButtonElement;
    this.iconBtn.type = "button";
    this.iconBtn.setAttribute("aria-label", "打开日历");

    this.triggerWrap.append(this.input, this.iconBtn);

    /* 遮罩 + 面板（popover 形态为锚定输入框的紧凑浮层，无全屏遮罩） */
    this.overlay = el(
      "div",
      this.mode === "popover" ? "qw-cal-overlay qw-cal-overlay--popover" : "qw-cal-overlay",
    );
    this.overlay.hidden = true;
    /* 详情悬浮方向 class：CSS 按 is-detail-inside / is-detail-left / is-detail-right 布局 */
    this.overlay.classList.add(`is-detail-${this.detailPosition}`);

    this.panel = el("div", "qw-cal-panel");
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-label", "选择日期");

    /* 主区域 */
    this.mainArea = el("div", "qw-cal-main");

    /* 标题栏 */
    const header = el("div", "qw-cal-header");

    const prevBtn = el("button", "qw-cal-nav-btn qw-cal-prev", ARROW_LEFT) as HTMLButtonElement;
    prevBtn.type = "button";
    prevBtn.setAttribute("aria-label", "上个月");
    prevBtn.addEventListener("click", () => this.navigate(-1));

    const nextBtn = el("button", "qw-cal-nav-btn qw-cal-next", ARROW_RIGHT) as HTMLButtonElement;
    nextBtn.type = "button";
    nextBtn.setAttribute("aria-label", "下个月");
    nextBtn.addEventListener("click", () => this.navigate(1));

    this.titleEl = el("div", "qw-cal-title");

    this.todayBtn = el("button", "qw-cal-today-btn", "今天") as HTMLButtonElement;
    this.todayBtn.type = "button";
    this.todayBtn.addEventListener("click", () => this.goToday());

    header.append(prevBtn, this.titleEl, nextBtn, this.todayBtn);
    this.mainArea.append(header);

    /* 星期头部 */
    const weekRow = el("div", "qw-cal-weekdays");
    for (const w of WEEKDAY_LABELS) {
      weekRow.append(el("span", "qw-cal-weekday", w));
    }
    this.mainArea.append(weekRow);

    /* 日期网格 */
    this.grid = el("div", "qw-cal-grid");
    this.grid.setAttribute("role", "grid");
    this.grid.setAttribute("aria-label", "日期网格");
    this.mainArea.append(this.grid);

    /* 时间选择器 */
    this.timeRow = el("div", "qw-cal-time");
    this.hourInput = el("input", "qw-cal-time-input") as HTMLInputElement;
    this.hourInput.type = "number";
    this.hourInput.min = "0";
    this.hourInput.max = "23";
    this.hourInput.value = "00";
    this.hourInput.setAttribute("aria-label", "时");
    this.minuteInput = el("input", "qw-cal-time-input") as HTMLInputElement;
    this.minuteInput.type = "number";
    this.minuteInput.min = "0";
    this.minuteInput.max = "59";
    this.minuteInput.value = "00";
    this.minuteInput.setAttribute("aria-label", "分");
    this.secondInput = el("input", "qw-cal-time-input") as HTMLInputElement;
    this.secondInput.type = "number";
    this.secondInput.min = "0";
    this.secondInput.max = "59";
    this.secondInput.value = "00";
    this.secondInput.setAttribute("aria-label", "秒");

    const sep1 = el("span", "qw-cal-time-sep", ":");
    const sep2 = el("span", "qw-cal-time-sep", ":");
    const zeroBtn = el("button", "qw-cal-time-btn", "零时") as HTMLButtonElement;
    zeroBtn.type = "button";
    zeroBtn.addEventListener("click", () => {
      this.setTimeTo(0, 0, 0);
    });
    const endBtn = el("button", "qw-cal-time-btn", "日终") as HTMLButtonElement;
    endBtn.type = "button";
    endBtn.addEventListener("click", () => {
      this.setTimeTo(23, 59, 59);
    });
    this.timeRow.append(
      el("span", "qw-cal-time-label", "时间"),
      this.hourInput,
      sep1,
      this.minuteInput,
      sep2,
      this.secondInput,
      zeroBtn,
      endBtn,
    );
    /* dateOnly：隐藏时间行（元素保留，renderTime 仍安全引用） */
    this.timeRow.hidden = this.dateOnly;
    this.mainArea.append(this.timeRow);

    /* 底部操作栏（modal / popover 统一提交制：点日期只更新面板，确认才回发 onChange） */
    const actions = el("div", "qw-cal-actions");
    const cancelBtn = el("button", "qw-cal-cancel-btn", "取消") as HTMLButtonElement;
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", () => this.cancel());
    this.confirmBtn = el("button", "qw-cal-confirm-btn", "确认") as HTMLButtonElement;
    this.confirmBtn.type = "button";
    this.confirmBtn.addEventListener("click", () => this.confirm());
    actions.append(cancelBtn, this.confirmBtn);
    this.mainArea.append(actions);

    /* 详情面板 */
    this.detailPanel = el("div", "qw-cal-side");
    this.detailContent = el("div", "qw-cal-detail");

    /* 关闭一侧面板按钮 */
    const sideCloseBtn = el("button", "qw-cal-side-close", "×") as HTMLButtonElement;
    sideCloseBtn.type = "button";
    sideCloseBtn.setAttribute("aria-label", "关闭详情");
    sideCloseBtn.addEventListener("click", () => this.hideDetail());
    this.detailContent.append(sideCloseBtn);
    this.detailPanel.append(this.detailContent);

    this.panel.append(this.mainArea, this.detailPanel);
    this.overlay.append(this.panel);
    this.root.append(this.triggerWrap);
    /* popover 浮层挂到 body：fixed 定位脱离宿主 overflow/transform 裁剪 */
    if (this.mode === "popover") {
      document.body.appendChild(this.overlay);
    } else {
      this.root.append(this.overlay);
    }
  }

  /* ============================================================
     Bind：事件绑定
     ============================================================ */

  private bind(): void {
    this.input.addEventListener("click", () => this.open());
    this.iconBtn.addEventListener("click", () => this.open());

    this.overlay.addEventListener("mousedown", (e) => {
      if (e.target === this.overlay) this.cancel();
    });

    /* 时间输入变更 */
    const syncTime = () => {
      this.selectedTime.hour = Math.min(23, Math.max(0, parseInt(this.hourInput.value) || 0));
      this.selectedTime.minute = Math.min(59, Math.max(0, parseInt(this.minuteInput.value) || 0));
      this.selectedTime.second = Math.min(59, Math.max(0, parseInt(this.secondInput.value) || 0));
      this.hourInput.value = String(this.selectedTime.hour).padStart(2, "0");
      this.minuteInput.value = String(this.selectedTime.minute).padStart(2, "0");
      this.secondInput.value = String(this.selectedTime.second).padStart(2, "0");
      this.syncInput();
    };
    this.hourInput.addEventListener("change", syncTime);
    this.minuteInput.addEventListener("change", syncTime);
    this.secondInput.addEventListener("change", syncTime);

    /* 日格点击（处理三种视图） */
    this.grid.addEventListener("click", (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>(
        ".qw-cal-cell, .qw-cal-month-cell, .qw-cal-year-cell",
      );
      if (!cell) return;

      // 年视图：点击年份 → 日视图
      if (cell.classList.contains("qw-cal-year-cell")) {
        const y = Number(cell.dataset.year);
        if (!y) return;
        this.viewDate = new Date(y, 0, 1);
        this.viewMode = "day";
        this.render();
        this.hideDetail();
        return;
      }

      // 月视图：点击月份 → 日视图
      if (cell.classList.contains("qw-cal-month-cell")) {
        const m = Number(cell.dataset.month);
        if (!m) return;
        this.viewDate = new Date(this.viewDate.getFullYear(), m - 1, 1);
        this.viewMode = "day";
        this.render();
        this.hideDetail();
        return;
      }

      // 日视图：点击日期
      const iso = cell.dataset.date;
      if (!iso) return;
      const [y, m, d] = iso.split("-").map(Number);
      if (y === undefined || m === undefined || d === undefined) return;
      const date = new Date(y, m - 1, d);
      if (this.isDisabled(date)) return;
      const isCurrentMonth = date.getMonth() === this.viewDate.getMonth();
      if (isCurrentMonth) {
        this.selectDate(date, true);
      } else {
        this.viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
        this.selectDate(date, false);
      }
    });

    this.docKey = (e) => {
      if (!this.isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.cancel();
      }
      /* Enter=确认；焦点在按钮上时交给原生 click（今天/取消/确认/月年格） */
      if (e.key === "Enter" && (e.target as HTMLElement | null)?.tagName !== "BUTTON") {
        e.preventDefault();
        this.confirm();
      }
      if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.navigate(-1);
      }
      if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.navigate(1);
      }
    };
    document.addEventListener("keydown", this.docKey, true);

    this.docClick = (e) => {
      if (!this.isOpen) return;
      const target = e.target as HTMLElement;
      /* popover 浮层挂在 body 上、不在 root 内，需一并排除，否则点面板内任意处会误收起 */
      if (!this.root.contains(target) && !this.overlay.contains(target)) {
        this.cancel();
      }
    };
    document.addEventListener("mousedown", this.docClick);
  }

  /* ============================================================
     Public API
     ============================================================ */

  /** 打开日历面板 */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    this.viewDate = new Date(this.selected);
    this.viewDate.setDate(1);
    this.viewMode = "day";

    this.selectedTime = {
      hour: this.selected.getHours(),
      minute: this.selected.getMinutes(),
      second: this.selected.getSeconds(),
    };

    /* 提交制快照：取消 / Esc / 点外部 / 滚动收起时回滚到此状态 */
    this.snapshot = {
      selected: new Date(this.selected),
      time: { ...this.selectedTime },
      inputValue: this.input.value,
    };

    this.overlay.hidden = false;

    if (this.mode === "popover") {
      /* popover：不锁 body 滚动，不设 transform-origin（由 CSS 负责轻量位移动画） */
      this.bindPopoverScroll();
    } else {
      document.body.style.overflow = "hidden";
      /* 锚定动画：transform-origin 指向输入框位置（视觉从输入框弱出） */
      const ir = this.input.getBoundingClientRect();
      const pr = this.panel.getBoundingClientRect();
      if (pr.width > 0 && pr.height > 0) {
        const ox = ((ir.left + ir.width / 2 - pr.left) / pr.width) * 100;
        const oy = ((ir.top + ir.height / 2 - pr.top) / pr.height) * 100;
        this.panel.style.transformOrigin = `${ox.toFixed(1)}% ${oy.toFixed(1)}%`;
      }
    }

    if (this.animate) {
      requestAnimationFrame(() => {
        this.overlay.classList.add("is-open");
        this.panel.classList.add("is-open");
      });
    } else {
      this.overlay.classList.add("is-open");
      this.panel.classList.add("is-open");
    }

    this.render();
    /* 详情面板：modal / popover 打开时均渲染当前选中日期（popover 内嵌详情栏需先激活再量宽） */
    if (this.showDetailPanel) {
      this.showDetail(this.selected);
    } else {
      this.hideDetail();
    }
    /* popover 形态：render 后测量面板尺寸做下方/上方锚定与宽度 */
    if (this.mode === "popover") this.placePopover();
    /* 焦点移入面板首个高频可交互元素（今天按钮；不可用时聚焦面板） */
    this.panel.tabIndex = -1;
    const focusTarget = this.todayBtn.classList.contains("is-hidden") ? this.panel : this.todayBtn;
    focusTarget.focus();
    this.onOpenChangeCb?.(true);
  }

  /** 关闭日历面板 */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.overlay.classList.remove("is-open");
    this.panel.classList.remove("is-open");
    if (this.mode === "modal") document.body.style.overflow = "";
    if (this.mode === "popover") this.unbindPopoverScroll();

    const finish = () => {
      this.overlay.hidden = true;
      this.closeTimer = null;
      /* 动画结束后归还焦点到输入框 */
      this.input.focus();
    };
    if (this.animate) {
      this.closeTimer = setTimeout(finish, 220);
    } else {
      finish();
    }
    this.onOpenChangeCb?.(false);
  }

  /** 确认选中：提交面板内状态（日期+时间），回发 onChange 后收起 */
  private confirm(): void {
    if (!this.isOpen) return;
    this.selected = new Date(
      this.selected.getFullYear(),
      this.selected.getMonth(),
      this.selected.getDate(),
      this.selectedTime.hour,
      this.selectedTime.minute,
      this.selectedTime.second,
    );
    this.syncInput();
    this.onChangeCb?.(this.getSelectedDate());
    this.close();
  }

  /** 取消：回滚到打开前的已确认状态（不回发 onChange），再收起 */
  private cancel(): void {
    if (!this.isOpen) return;
    if (this.snapshot) {
      this.selected = new Date(this.snapshot.selected);
      this.selectedTime = { ...this.snapshot.time };
      /* 输入框按快照原样恢复（宿主可能以空值表达"未设置"，不能经 syncInput 覆写） */
      this.input.value = this.snapshot.inputValue;
      this.snapshot = null;
    }
    this.close();
  }

  /** 获取当前选中日期；dateOnly 回 `YYYY-MM-DD`，否则含时分秒 */
  getSelectedDate(): string {
    const d = this.selected;
    if (this.dateOnly) return formatDate(d);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /** 设置选中日期 */
  setSelectedDate(date: Date | string): void {
    const d = toDate(date);
    if (!d) return;
    this.selected = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
    );
    this.viewDate = new Date(this.selected);
    this.viewDate.setDate(1);
    this.selectedTime = { hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
    this.syncInput();
    if (this.isOpen) this.render();
  }

  /** 销毁 */
  destroy(): void {
    if (this.closeTimer !== null) clearTimeout(this.closeTimer);
    if (this.docKey) document.removeEventListener("keydown", this.docKey, true);
    if (this.docClick) document.removeEventListener("mousedown", this.docClick);
    this.unbindPopoverScroll();
    for (const p of this.dayMetaProviders) p.destroy?.();
    for (const p of this.panelProviders) p.destroy?.();
    this.root.textContent = "";
    /* popover 浮层挂在 body 上，需独立移除 */
    this.overlay.remove();
  }

  /* ============================================================
     popover 形态辅助
     ============================================================ */

  /** popover 锚定（fixed）：宽度 = 触发区宽 + 详情栏宽（激活时），左缘对齐；
   *  下方放不下向上翻，两侧都放不下选空间大的一侧，并以 max-height 钳制面板高度
   *  （.qw-cal-main / .qw-cal-detail 内部滚动），保证面板永不被视口裁切到不可达 */
  private placePopover(): void {
    const ir = this.input.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    const vw = window.innerWidth || 0;
    const gap = 8;
    const base = ir.width > 0 ? ir.width : this.popoverMinWidth;
    const sideActive =
      this.showDetailPanel && this.detailPanel.classList.contains("is-active");
    /* inside：详情为面板内覆盖浮层（.qw-cal-side absolute），不参与面板宽度；
       left/right：详情参与宽度，面板随详情加宽 */
    /* 读取详情栏宽度前临时取消 width 过渡：过渡中间值（0→240）会让面板宽度测不准 */
    const prevSideTrans = this.detailPanel.style.transition;
    this.detailPanel.style.transition = "none";
    const sideW =
      sideActive && this.detailPosition !== "inside" ? this.detailPanel.offsetWidth : 0;
    this.detailPanel.style.transition = prevSideTrans;

    /* 先按 输入框宽+详情宽 定位，再以面板实际宽度兜底：窄输入框下面板
       min-width 更宽，overlay 若只按输入框宽会把面板右侧裁掉（日期列不完整） */
    this.overlay.style.width = `${base + sideW}px`;
    const panelW = Math.max(base + sideW, this.panel.offsetWidth);
    this.overlay.style.width = `${panelW}px`;

    /* left：面板向左展开（详情在左，网格锚点保持在输入框处）；
       right/inside：左缘对齐输入框；最后横向钳进视口 */
    const leftShift = sideActive && this.detailPosition === "left" ? sideW : 0;
    const left = Math.max(gap, Math.min(ir.left - leftShift, vw - panelW - gap));
    this.overlay.style.left = `${left}px`;

    /* 复位钳制后测量自然高度 */
    this.panel.style.maxHeight = "";
    const natural = this.panel.offsetHeight;
    const spaceBelow = vh - ir.bottom - gap * 2;
    const spaceAbove = ir.top - gap * 2;

    let flip = false;
    if (vh > 0 && natural > spaceBelow) {
      flip = spaceAbove > spaceBelow; /* 翻向空间更大的一侧 */
      const avail = flip ? spaceAbove : spaceBelow;
      /* 选中侧仍放不下 → 钳制高度，面板内部滚动 */
      if (avail > 0 && natural > avail) this.panel.style.maxHeight = `${avail}px`;
    }

    const h = this.panel.offsetHeight;
    this.overlay.classList.toggle("is-flip", flip);
    this.overlay.style.top = flip ? `${Math.max(gap, ir.top - h - gap)}px` : `${ir.bottom + gap}px`;
  }

  /** popover 滚动即收起：监听 window 与输入框所有可滚动祖先的 scroll */
  private bindPopoverScroll(): void {
    const scrollables: Array<Window | HTMLElement> = [window];
    let node = this.root.parentElement;
    while (node) {
      if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) {
        scrollables.push(node);
      }
      node = node.parentElement;
    }
    /* 滚动属被动收起，等同取消：未确认的选择不回发 */
    const onScroll = () => this.cancel();
    for (const s of scrollables) {
      s.addEventListener("scroll", onScroll, { passive: true });
    }
    this.scrollTargets = scrollables;
    this.scrollListener = onScroll;
  }

  private unbindPopoverScroll(): void {
    if (!this.scrollListener) return;
    for (const s of this.scrollTargets) {
      s.removeEventListener("scroll", this.scrollListener);
    }
    this.scrollTargets = [];
    this.scrollListener = null;
  }

  /* ============================================================
     渲染
     ============================================================ */

  private render(): void {
    this.renderTitle();
    this.renderTime();

    const weekEl = this.mainArea.querySelector<HTMLElement>(".qw-cal-weekdays");
    this.grid.classList.remove("is-year-grid", "is-month-grid");
    if (this.viewMode === "year") {
      if (weekEl) weekEl.style.display = "none";
      this.renderYearGrid();
    } else if (this.viewMode === "month") {
      if (weekEl) weekEl.style.display = "none";
      this.grid.classList.add("is-month-grid");
      this.renderMonthGrid();
    } else {
      if (weekEl) weekEl.style.display = "";
      this.renderDayGrid();
    }
  }

  private renderTitle(): void {
    const y = this.viewDate.getFullYear();
    const m = this.viewDate.getMonth() + 1;
    this.titleEl.textContent = "";

    const yearBtn = el("button", "qw-cal-title-year", `${y}年`) as HTMLButtonElement;
    yearBtn.type = "button";
    yearBtn.addEventListener("click", () => {
      this.viewMode = "year";
      this.render();
      this.hideDetail();
    });

    if (this.viewMode === "year") {
      // 年视图：只显示年份
      this.titleEl.append(yearBtn);
    } else if (this.viewMode === "month") {
      // 月视图：显示年份（可点击回日视图）
      yearBtn.addEventListener("click", () => {
        this.viewMode = "day";
        this.render();
        this.hideDetail();
      });
      this.titleEl.append(yearBtn);
    } else {
      // 日视图：显示年 + 月
      const monthBtn = el("button", "qw-cal-title-month", `${m}月`) as HTMLButtonElement;
      monthBtn.type = "button";
      monthBtn.addEventListener("click", () => {
        this.viewMode = "month";
        this.render();
        this.hideDetail();
      });
      this.titleEl.append(yearBtn, monthBtn);

      const gz = getYearGanzhi(y);
      const suffix = el("span", "qw-cal-title-sub", `（${gz.stem}${gz.branch}${gz.zodiac}年）`);
      this.titleEl.append(suffix);
    }

    // today 按钮状态
    const now = new Date();
    this.todayBtn.classList.toggle(
      "is-hidden",
      now.getFullYear() === y && now.getMonth() + 1 === m,
    );
  }

  private renderTime(): void {
    this.hourInput.value = String(this.selectedTime.hour).padStart(2, "0");
    this.minuteInput.value = String(this.selectedTime.minute).padStart(2, "0");
    this.secondInput.value = String(this.selectedTime.second).padStart(2, "0");
  }

  /** 年视图：显示12个年份供选择 */
  private renderYearGrid(): void {
    this.grid.textContent = "";
    const curYear = this.viewDate.getFullYear();
    const startYear = Math.floor(curYear / 12) * 12;
    const now = new Date();
    const selY = this.selected.getFullYear();
    const frag = document.createDocumentFragment();

    for (let i = 0; i < 12; i++) {
      const y = startYear + i;
      const cell = el("button", "qw-cal-year-cell") as HTMLButtonElement;
      cell.type = "button";
      cell.dataset.year = String(y);
      cell.textContent = `${y}年`;
      if (y === now.getFullYear()) cell.classList.add("is-current");
      if (y === selY) cell.classList.add("is-selected");
      frag.append(cell);
    }
    this.grid.append(frag);
  }

  /** 月视图：显示12个月份供选择 */
  private renderMonthGrid(): void {
    this.grid.textContent = "";
    const y = this.viewDate.getFullYear();
    const now = new Date();
    const selY = this.selected.getFullYear();
    const selM = this.selected.getMonth() + 1;
    const frag = document.createDocumentFragment();

    for (let m = 1; m <= 12; m++) {
      const cell = el("button", "qw-cal-month-cell") as HTMLButtonElement;
      cell.type = "button";
      cell.dataset.month = String(m);
      cell.textContent = `${m}月`;
      if (y === now.getFullYear() && m === now.getMonth() + 1) cell.classList.add("is-current");
      if (y === selY && m === selM) cell.classList.add("is-selected");
      frag.append(cell);
    }
    this.grid.append(frag);
  }

  private renderDayGrid(): void {
    this.grid.textContent = "";

    const y = this.viewDate.getFullYear();
    const m = this.viewDate.getMonth();
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const selIso = formatDate(this.selected);

    // 当月第一天是星期几？(0=周日, ..., 6=周六)
    const firstDay = new Date(y, m, 1).getDay(); // 0=周日 → 需映射为周一=0
    const startPad = firstDay === 0 ? 6 : firstDay - 1; // 周一=0, 周日=6

    // 当月天数
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    // 上月天数（用于补齐）
    const prevMonthDays = new Date(y, m, 0).getDate();

    // 总格数（补齐到 6 行）
    const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;

    const frag = document.createDocumentFragment();

    for (let i = 0; i < totalCells; i++) {
      const cellDay = i - startPad + 1;
      let date: Date;
      let iso: string;
      let isCurrentMonth: boolean;

      if (cellDay < 1) {
        // 上月
        const prevM = m === 0 ? 11 : m - 1;
        const prevY = m === 0 ? y - 1 : y;
        date = new Date(prevY, prevM, prevMonthDays + cellDay);
        iso = formatDate(date);
        isCurrentMonth = false;
      } else if (cellDay > daysInMonth) {
        // 下月
        const nextM = m === 11 ? 0 : m + 1;
        const nextY = m === 11 ? y + 1 : y;
        date = new Date(nextY, nextM, cellDay - daysInMonth);
        iso = formatDate(date);
        isCurrentMonth = false;
      } else {
        date = new Date(y, m, cellDay);
        iso = formatDate(date);
        isCurrentMonth = true;
      }

      const isToday = iso === todayIso;
      const isSelected = isCurrentMonth && iso === selIso;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      const cell = el("div", "qw-cal-cell") as HTMLElement;
      cell.dataset.date = iso;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", iso);
      cell.toggleAttribute("data-today", isToday);
      cell.toggleAttribute("data-selected", isSelected);

      if (!isCurrentMonth) cell.classList.add("is-other-month");
      if (isToday) cell.classList.add("is-today");
      if (isSelected) cell.classList.add("is-selected");
      if (isWeekend) cell.classList.add("is-weekend");
      if (this.isDisabled(date)) cell.classList.add("is-disabled");

      // 日期数字
      const dayNum = el("span", "qw-cal-cell-num", String(date.getDate()));
      cell.append(dayNum);

      // 格子 meta：按注册顺序合并 DayMetaProvider 结果；
      // sub / badge 取最后一个非空（追加在后的用户 provider 可覆盖内置），cellClass 全部合并
      let sub = "";
      let subClass = "qw-cal-cell-sub";
      let badge = "";
      const cellClasses: string[] = [];

      for (const p of this.dayMetaProviders) {
        const meta = p.getDayMeta(date);
        if (!meta) continue;
        if (meta.sub) {
          sub = meta.sub;
          subClass = `qw-cal-cell-sub${meta.subClass ? ` ${meta.subClass}` : ""}`;
        }
        if (meta.badge) badge = meta.badge;
        if (meta.cellClass) cellClasses.push(...meta.cellClass.split(/\s+/));
      }

      if (sub) cell.append(el("span", subClass, sub));
      for (const c of cellClasses) if (c) cell.classList.add(c);
      if (badge) cell.append(el("span", "qw-cal-cell-badge", badge));

      frag.append(cell);
    }

    this.grid.append(frag);
  }

  /* ============================================================
     日期选择 + 详情
     ============================================================ */

  private selectDate(date: Date, rerender: boolean): void {
    this.selected = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      this.selectedTime.hour,
      this.selectedTime.minute,
      this.selectedTime.second,
    );

    if (rerender) {
      this.render();
    }

    this.syncInput();
    if (this.showDetailPanel) this.showDetail(date);
    /* 详情激活后 left/right 面板宽度随之变化，popover 重新锚定 */
    if (this.mode === "popover") this.placePopover();
    /* 提交制：点日期只更新面板内选中与详情、不收起；确认时才经 confirm() 回发 onChange */
  }

  private showDetail(date: Date): void {
    /* 清空并重建：× 按钮 + 各 PanelProvider 内容块（按注册顺序） */
    this.detailContent.textContent = "";
    const sideCloseBtn = el("button", "qw-cal-side-close", "×") as HTMLButtonElement;
    sideCloseBtn.type = "button";
    sideCloseBtn.setAttribute("aria-label", "关闭详情");
    sideCloseBtn.addEventListener("click", () => this.hideDetail());
    this.detailContent.append(sideCloseBtn);

    for (const p of this.panelProviders) {
      const out = p.render(date);
      if (out == null) continue;
      if (typeof out === "string") {
        /* provider 为开发者可信代码，字符串按 HTML 解析 */
        this.detailContent.insertAdjacentHTML("beforeend", out);
      } else {
        this.detailContent.append(out);
      }
    }

    this.detailPanel.classList.add("is-active");
  }

  private hideDetail(): void {
    this.detailPanel.classList.remove("is-active");
    /* 详情收起后面板宽度收窄（left/right 形态），popover 重新锚定 */
    if (this.mode === "popover") this.placePopover();
  }

  /* ============================================================
     辅助
     ============================================================ */

  private syncInput(): void {
    const d = this.selected;
    if (this.dateOnly) {
      this.input.value = formatDate(this.selected);
      return;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    this.input.value = `${formatDate(this.selected)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private navigate(delta: number): void {
    if (this.viewMode === "year") {
      // 年视图按12年翻页
      this.viewDate.setFullYear(this.viewDate.getFullYear() + delta * 12);
    } else if (this.viewMode === "month") {
      // 月视图按年翻页
      this.viewDate.setFullYear(this.viewDate.getFullYear() + delta);
    } else {
      // 日视图按月翻页
      this.viewDate.setMonth(this.viewDate.getMonth() + delta);
    }
    this.render();
  }

  private setTimeTo(hour: number, minute: number, second: number): void {
    this.selectedTime = { hour, minute, second };
    this.renderTime();
    this.syncInput();
  }

  private goToday(): void {
    const today = new Date();
    this.selectedTime = {
      hour: today.getHours(),
      minute: today.getMinutes(),
      second: today.getSeconds(),
    };
    this.viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
    this.selectDate(today, true);
  }

  private isDisabled(date: Date): boolean {
    if (this.minDate && date < this.minDate) return true;
    if (this.maxDate && date > this.maxDate) return true;
    return false;
  }
}
