/* ============================================================
   青梧UI · 日历组件（Calendar）
   - 输入框+日历图标触发 → 弹出日历面板
   - 日期格：公历 + 农历 + 节日 + 节气 + 休假标记
   - 点击日期 → 右侧详情面板（节日渊源/节气/黄历宜忌）
   - 零框架依赖，纯 DOM + CSS
   ============================================================ */

import type { CalendarUiOptions, HolidayConfig } from "./types";
import {
  getAlmanac,
  getLunarFestival,
  getSolarFestival,
  getSolarTermDetail,
  type AlmanacInfo,
  type FestivalInfo,
  type SolarTermDetail,
} from "./data";
import {
  formatLunarDate,
  getLunarDayName,
  getLunarMonthName,
  getNearbySolarTerms,
  getSolarTerm,
  getYearGanzhi,
  solarToLunar,
  type LunarDate,
  type SolarTerm,
} from "./lunar";

/* ---------- 运行时常量 ---------- */

type ViewMode = 'day' | 'month' | 'year';

const PREFERS_REDUCED =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAY_LABELS_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

/* ---------- SVG 图标（由 icon/icons.ts 提供） ---------- */
import { ICO_CALENDAR, ICO_ARROW_LEFT, ICO_ARROW_RIGHT } from "../../../../icon/icons";

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
  /** 节假日配置 */
  private readonly holidays: HolidayConfig;
  private readonly animate: boolean;

  /* ---- 状态 ---- */
  private isOpen = false;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

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
  private closeBtn!: HTMLButtonElement;
  private todayBtn!: HTMLButtonElement;
  private confirmBtn!: HTMLButtonElement;

  /* ---- 视图 + 时间 ---- */
  private viewMode: ViewMode = 'day';
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
    this.holidays = opts.holidays ?? {};
    this.animate = !PREFERS_REDUCED;

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

    /* 遮罩 + 面板 */
    this.overlay = el("div", "qw-cal-overlay");
    this.overlay.hidden = true;

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
    this.hourInput.type = "number"; this.hourInput.min = "0"; this.hourInput.max = "23";
    this.hourInput.value = "00"; this.hourInput.setAttribute("aria-label", "时");
    this.minuteInput = el("input", "qw-cal-time-input") as HTMLInputElement;
    this.minuteInput.type = "number"; this.minuteInput.min = "0"; this.minuteInput.max = "59";
    this.minuteInput.value = "00"; this.minuteInput.setAttribute("aria-label", "分");
    this.secondInput = el("input", "qw-cal-time-input") as HTMLInputElement;
    this.secondInput.type = "number"; this.secondInput.min = "0"; this.secondInput.max = "59";
    this.secondInput.value = "00"; this.secondInput.setAttribute("aria-label", "秒");

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
      this.hourInput, sep1,
      this.minuteInput, sep2,
      this.secondInput,
      zeroBtn, endBtn,
    );
    this.mainArea.append(this.timeRow);

    /* 底部操作栏 */
    const actions = el("div", "qw-cal-actions");
    const cancelBtn = el("button", "qw-cal-cancel-btn", "取消") as HTMLButtonElement;
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", () => this.close());
    this.confirmBtn = el("button", "qw-cal-confirm-btn", "确认") as HTMLButtonElement;
    this.confirmBtn.type = "button";
    this.confirmBtn.addEventListener("click", () => this.confirm());
    actions.append(cancelBtn, this.confirmBtn);
    actions.append(cancelBtn, this.confirmBtn);
    this.mainArea.append(actions);

    /* 关闭按钮（面板内） */
    this.closeBtn = el("button", "qw-cal-close-btn", "×") as HTMLButtonElement;
    this.closeBtn.type = "button";
    this.closeBtn.setAttribute("aria-label", "关闭");
    this.closeBtn.addEventListener("click", () => this.close());

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

    this.panel.append(this.mainArea, this.detailPanel, this.closeBtn);
    this.overlay.append(this.panel);
    this.root.append(this.triggerWrap, this.overlay);
  }

  /* ============================================================
     Bind：事件绑定
     ============================================================ */

  private bind(): void {
    this.input.addEventListener("click", () => this.open());
    this.iconBtn.addEventListener("click", () => this.open());

    this.overlay.addEventListener("mousedown", (e) => {
      if (e.target === this.overlay) this.close();
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
      const cell = (e.target as HTMLElement).closest<HTMLElement>(".qw-cal-cell, .qw-cal-month-cell, .qw-cal-year-cell");
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
        this.close();
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
      if (!this.root.contains(target)) {
        this.close();
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

    this.overlay.hidden = false;
    document.body.style.overflow = "hidden";
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
    this.hideDetail();
    this.onOpenChangeCb?.(true);
  }

  /** 关闭日历面板 */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.overlay.classList.remove("is-open");
    this.panel.classList.remove("is-open");
    document.body.style.overflow = "";

    const finish = () => {
      this.overlay.hidden = true;
      this.closeTimer = null;
    };
    if (this.animate) {
      this.closeTimer = setTimeout(finish, 220);
    } else {
      finish();
    }
    this.onOpenChangeCb?.(false);
  }

  /** 确认选中：将面板内的时间同步到 selected，再关闭 */
  private confirm(): void {
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

  /** 获取当前选中日期（含时分秒） */
  getSelectedDate(): string {
    const d = this.selected;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /** 设置选中日期 */
  setSelectedDate(date: Date | string): void {
    const d = toDate(date);
    if (!d) return;
    this.selected = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
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
    this.root.textContent = "";
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

      // 农历信息
      const lunar = solarToLunar(date);
      const lunarStr = lunar.day === 1
        ? getLunarMonthName(lunar.month, lunar.isLeap)
        : getLunarDayName(lunar.day);

      // 节日优先显示
      const lunarFest = getLunarFestival(lunar.month, lunar.day);
      const solarFest = getSolarFestival(date.getMonth() + 1, date.getDate());
      const term = getSolarTerm(date);

      let subLabel = "";
      let subClass = "qw-cal-cell-sub";

      if (lunarFest) {
        subLabel = lunarFest.name;
        subClass += " is-festival";
      } else if (solarFest) {
        subLabel = solarFest.name;
        subClass += " is-solar-festival";
      } else if (term) {
        subLabel = term.name;
        subClass += " is-term";
      } else if (lunar.day === 1) {
        subLabel = lunarStr;
        subClass += " is-lunar-month";
      } else {
        subLabel = lunarStr;
        subClass += " is-lunar";
      }

      // 节假日/调休标记（优先使用用户配置，其次内置节日）
      const hDays = this.holidays.holidays ?? [];
      const wDays = this.holidays.workdays ?? [];
      let badge = "";
      if (wDays.includes(iso)) {
        cell.classList.add("is-workday");
        badge = "工";
      } else if (hDays.includes(iso)) {
        cell.classList.add("is-holiday");
        badge = "休";
      } else if (lunarFest?.name === "春节" || solarFest?.name === "国庆节" || solarFest?.name === "劳动节") {
        cell.classList.add("is-holiday");
        badge = "休";
      }

      const sub = el("span", subClass, subLabel);
      cell.append(sub);

      if (badge) {
        cell.append(el("span", "qw-cal-cell-badge", badge));
      }

      frag.append(cell);
    }

    this.grid.append(frag);
  }

  /* ============================================================
     日期选择 + 详情
     ============================================================ */

  private selectDate(date: Date, rerender: boolean): void {
    this.selected = new Date(
      date.getFullYear(), date.getMonth(), date.getDate(),
      this.selectedTime.hour, this.selectedTime.minute, this.selectedTime.second,
    );

    if (rerender) {
      this.render();
    }

    this.syncInput();
    if (this.showDetailPanel) this.showDetail(date);
    this.onChangeCb?.(formatDate(this.selected));
  }

  private showDetail(date: Date): void {
    const lunar = solarToLunar(date);
    const lunarFest = getLunarFestival(lunar.month, lunar.day);
    const solarFest = getSolarFestival(date.getMonth() + 1, date.getDate());
    const term = getSolarTerm(date);
    const terms = getNearbySolarTerms(date);
    const almanac = getAlmanac(lunar.month, lunar.day);
    const gz = getYearGanzhi(lunar.year);

    const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    const weekDay = WEEKDAY_LABELS_SHORT[date.getDay()];
    const lunarStr = formatLunarDate(lunar);
    const ganzhiStr = `${gz.stem}${gz.branch}年（${gz.zodiac}年）`;

    /* 构建详情 */
    const rows: string[] = [];

    // 日期概览
    rows.push(
      `<div class="qw-detail-date">${dateStr} 星期${weekDay}</div>`,
      `<div class="qw-detail-lunar">农历 ${lunarStr}</div>`,
      `<div class="qw-detail-ganzhi">${ganzhiStr}</div>`,
    );

    // 节日信息
    if (lunarFest) {
      rows.push(...this.renderFestivalDetail(lunarFest));
    }
    if (solarFest && !lunarFest) {
      rows.push(...this.renderFestivalDetail(solarFest));
    }

    // 节气信息
    if (term) {
      rows.push(...this.renderTermDetail(term, true));
    } else if (terms.length > 0) {
      // 显示附近的节气
      for (const t of terms) {
        rows.push(...this.renderTermDetail(t, false));
      }
    }

    // 黄历宜忌
    if (almanac) rows.push(...this.renderAlmanac(almanac));

    this.detailContent.innerHTML =
      '<button class="qw-cal-side-close" aria-label="关闭详情" type="button">×</button>' +
      rows.join("");

    // 重新绑定侧栏关闭按钮
    const sideCloseBtn = this.detailContent.querySelector<HTMLButtonElement>(".qw-cal-side-close");
    if (sideCloseBtn) {
      sideCloseBtn.addEventListener("click", () => this.hideDetail());
    }

    this.detailPanel.classList.add("is-active");
  }

  private renderFestivalDetail(fest: FestivalInfo): string[] {
    const rows: string[] = [];
    rows.push(`<div class="qw-detail-section"><div class="qw-detail-label">节日</div>`);
    rows.push(`<div class="qw-detail-fest-name">${fest.name}</div>`);
    if (fest.origin) {
      rows.push(`<div class="qw-detail-text"><b>渊源</b> ${fest.origin}</div>`);
    }
    if (fest.description) {
      rows.push(`<div class="qw-detail-text"><b>习俗</b> ${fest.description}</div>`);
    }
    rows.push("</div>");
    return rows;
  }

  private renderTermDetail(term: SolarTerm, isExact: boolean): string[] {
    const detail = getSolarTermDetail(term.name);
    const rows: string[] = [];
    rows.push(
      `<div class="qw-detail-section"><div class="qw-detail-label">${isExact ? "今日节气" : "临近节气"}</div>`,
      `<div class="qw-detail-term-name">${term.name}</div>`,
    );
    if (detail) {
      rows.push(`<div class="qw-detail-text"><b>涵义</b> ${detail.meaning}</div>`);
      rows.push(`<div class="qw-detail-text"><b>物候</b> ${detail.phenology}</div>`);
      rows.push(`<div class="qw-detail-text"><b>民俗</b> ${detail.custom}</div>`);
      rows.push(`<div class="qw-detail-text"><b>农事</b> ${detail.farming}</div>`);
      rows.push(`<div class="qw-detail-text"><b>养生</b> ${detail.health}</div>`);
    }
    rows.push("</div>");
    return rows;
  }

  private renderAlmanac(almanac: AlmanacInfo): string[] {
    const rows: string[] = [];
    rows.push(`<div class="qw-detail-section"><div class="qw-detail-label">黄历宜忌</div>`);
    rows.push(
      `<div class="qw-almanac-item"><b>宜</b> <span class="qw-almanac-suit">${almanac.suitable.join(" · ")}</span></div>`,
      `<div class="qw-almanac-item"><b>忌</b> <span class="qw-almanac-unsuit">${almanac.unsuitable.join(" · ")}</span></div>`,
      `<div class="qw-almanac-item qw-almanac-sm"><b>冲煞</b> ${almanac.clash}</div>`,
      `<div class="qw-almanac-item qw-almanac-sm"><b>吉神</b> ${almanac.favorable}</div>`,
      `<div class="qw-almanac-item qw-almanac-sm"><b>神煞</b> ${almanac.gods.join(" · ")}</div>`,
    );
    rows.push("</div>");
    return rows;
  }

  private hideDetail(): void {
    this.detailPanel.classList.remove("is-active");
  }

  /* ============================================================
     辅助
     ============================================================ */

  private syncInput(): void {
    const d = this.selected;
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
    this.selectedTime = { hour: today.getHours(), minute: today.getMinutes(), second: today.getSeconds() };
    this.viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
    this.selectDate(today, true);
  }

  private isDisabled(date: Date): boolean {
    if (this.minDate && date < this.minDate) return true;
    if (this.maxDate && date > this.maxDate) return true;
    return false;
  }
}
