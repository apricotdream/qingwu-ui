/**
 * 青梧UI · 日历扩展接口（Provider）
 *
 * 双接口设计：
 * - DayMetaProvider：日期格 meta（农历 / 节日 / 节气小字、休 / 工角标）
 * - PanelProvider：详情面板内容块（黄历 / 天气卡片等）
 *
 * 契约 A（同步契约）：接口全部同步；异步内容（如天气 API）由
 * provider 自行处理加载 / 失败态，核心对异步零感知。
 *
 * 内置 provider 默认注册，用户 provider 追加在后（注册顺序即渲染顺序）。
 */

import {
  type AlmanacInfo,
  type FestivalInfo,
  getAlmanac,
  getLunarFestival,
  getSolarFestival,
  getSolarTermDetail,
} from "./data";
import {
  formatLunarDate,
  getLunarDayName,
  getLunarMonthName,
  getNearbySolarTerms,
  getSolarTerm,
  getYearGanzhi,
  type SolarTerm,
  solarToLunar,
} from "./lunar";
import type { HolidayConfig } from "./types";

/* ============================================================
   接口定义
   ============================================================ */

/** 日期格 meta（由 DayMetaProvider 返回，按注册顺序合并） */
export interface DayMeta {
  /** 格内小字（农历日 / 节日 / 节气名）；第一个返回非空 sub 的 provider 生效 */
  sub?: string;
  /** 小字附加类（如 "is-festival"） */
  subClass?: string;
  /** 角标文字（"休" / "工"）；第一个返回非空 badge 的 provider 生效 */
  badge?: string;
  /** 附加到格子的类名（如 "is-holiday"） */
  cellClass?: string;
}

/** 日期格 meta Provider（同步） */
export interface DayMetaProvider {
  id: string;
  getDayMeta(date: Date): DayMeta | null;
  /** 销毁钩子（清理定时器 / 监听等；可选） */
  destroy?(): void;
}

/** 详情面板内容块 Provider（同步契约；异步内容自行处理） */
export interface PanelProvider {
  id: string;
  /** 内容块标题（可选，供分组展示） */
  title?: string;
  /** 渲染内容；返回 Node 或 HTML 字符串；返回 null 表示该日期无内容 */
  render(date: Date): Node | string | null;
  /** 销毁钩子（可选） */
  destroy?(): void;
}

/* ============================================================
   工具
   ============================================================ */

const WEEKDAY_LABELS_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ============================================================
   内置 Provider（默认注册）
   ============================================================ */

/** 内置：农历 / 节日 / 节气小字（日期格） */
export class LunarDayMetaProvider implements DayMetaProvider {
  readonly id = "lunar";

  getDayMeta(date: Date): DayMeta {
    const lunar = solarToLunar(date);
    const lunarStr =
      lunar.day === 1 ? getLunarMonthName(lunar.month, lunar.isLeap) : getLunarDayName(lunar.day);

    const lunarFest = getLunarFestival(lunar.month, lunar.day);
    const solarFest = getSolarFestival(date.getMonth() + 1, date.getDate());
    const term = getSolarTerm(date);

    if (lunarFest) return { sub: lunarFest.name, subClass: "is-festival" };
    if (solarFest) return { sub: solarFest.name, subClass: "is-solar-festival" };
    if (term) return { sub: term.name, subClass: "is-term" };
    return {
      sub: lunarStr,
      subClass: lunar.day === 1 ? "is-lunar-month" : "is-lunar",
    };
  }
}

/** 内置：休假 / 调休角标（日期格；依赖用户节假日配置） */
export class HolidayBadgeProvider implements DayMetaProvider {
  readonly id = "holiday";

  constructor(private readonly holidays: HolidayConfig = {}) {}

  getDayMeta(date: Date): DayMeta | null {
    const iso = formatDate(date);
    const { holidays = [], workdays = [] } = this.holidays;

    if (workdays.includes(iso)) return { badge: "工", cellClass: "is-workday" };
    if (holidays.includes(iso)) return { badge: "休", cellClass: "is-holiday" };

    // 内置节日兜底（未配置 holidays 时仍标记春节 / 国庆节 / 劳动节）
    const lunar = solarToLunar(date);
    const lunarFest = getLunarFestival(lunar.month, lunar.day);
    const solarFest = getSolarFestival(date.getMonth() + 1, date.getDate());
    if (
      lunarFest?.name === "春节" ||
      solarFest?.name === "国庆节" ||
      solarFest?.name === "劳动节"
    ) {
      return { badge: "休", cellClass: "is-holiday" };
    }
    return null;
  }
}

/** 内置：详情面板（日期概览 + 节日 + 节气 + 黄历宜忌） */
export class DetailPanelProvider implements PanelProvider {
  readonly id = "detail";
  readonly title = "详情";

  render(date: Date): string {
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

    const rows: string[] = [];

    // 日期概览
    rows.push(
      `<div class="qw-detail-date">${dateStr} 星期${weekDay}</div>`,
      `<div class="qw-detail-lunar">农历 ${lunarStr}</div>`,
      `<div class="qw-detail-ganzhi">${ganzhiStr}</div>`,
    );

    // 节日信息
    if (lunarFest) rows.push(...renderFestivalDetail(lunarFest));
    if (solarFest && !lunarFest) rows.push(...renderFestivalDetail(solarFest));

    // 节气信息
    if (term) {
      rows.push(...renderTermDetail(term, true));
    } else if (terms.length > 0) {
      for (const t of terms) rows.push(...renderTermDetail(t, false));
    }

    // 黄历宜忌
    if (almanac) rows.push(...renderAlmanac(almanac));

    return rows.join("");
  }
}

function renderFestivalDetail(fest: FestivalInfo): string[] {
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

function renderTermDetail(term: SolarTerm, isExact: boolean): string[] {
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

function renderAlmanac(almanac: AlmanacInfo): string[] {
  const rows: string[] = [];
  rows.push(`<div class="qw-detail-section"><div class="qw-detail-label">黄历宜忌</div>`);
  rows.push(
    `<div class="qw-almanac-item"><b>宜</b> <span class="qw-almanac-suit">${almanac.suitable.join(" · ")}</span></div>`,
    `<div class="qw-almanac-item"><b>忌</b> <span class="qw-almanac-unsuit">${almanac.unsuitable.join(" · ")}</span></div>`,
    `<div class="qw-almanac-item qw-almanac-sm"><b>冲煞</b> ${almanac.clash}</div>`,
    `<div class="qw-almanac-item qw-almanac-sm"><b>吉神</b> ${almanac.favorable}</div>`,
    `<div class="qw-almanac-item qw-almanac-sm"><b>神煞</b> ${almanac.gods.join(" · ")}</div>`,
    `<div class="qw-almanac-item qw-almanac-sm qw-almanac-note">简化示意 · 非专业黄历 · 仅供参考</div>`,
  );
  rows.push("</div>");
  return rows;
}
