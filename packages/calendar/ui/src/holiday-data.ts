// 仅共享协议代码并在构建时内联；/core 的 JS 和声明不引用可选 npm 包。
export * from "../../../holiday-data/src/schema";

import {
  type FestivalRecord,
  type HolidayData,
  type HolidayDay,
  parseHolidayData,
} from "../../../holiday-data/src/schema";
import { getSolarTerm, solarToLunar } from "./lunar";

export function findHolidayDay(data: HolidayData | undefined, iso: string): HolidayDay | null {
  // 按公告年份排序，下一年度公告对跨年日期的修订优先。
  let result: HolidayDay | null = null;
  for (const year of data?.years ?? []) {
    const day = year.days.find((item) => item.date === iso);
    if (day) result = day;
  }
  return result;
}

export function findFestivals(data: HolidayData | undefined, date: Date): FestivalRecord[] {
  if (!data?.festivals.length) return [];
  const lunar = solarToLunar(date);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const nextLunar = solarToLunar(next);
  return data.festivals.filter((festival) => {
    const rule = festival.rule;
    if (rule.calendar === "solar")
      return rule.month === date.getMonth() + 1 && rule.day === date.getDate();
    if (rule.calendar === "solar-term") return rule.term === getSolarTerm(date)?.name;
    if (rule.calendar === "lunar-eve")
      return nextLunar.month === 1 && nextLunar.day === 1 && !nextLunar.isLeap;
    return !lunar.isLeap && rule.month === lunar.month && rule.day === lunar.day;
  });
}

export function normalizeHolidayData(input: unknown): HolidayData | undefined {
  if (input === false || input === undefined) return undefined;
  const data = parseHolidayData(input);
  return { ...data, years: [...data.years].sort((a, b) => a.year - b.year) };
}

/** 应用主动请求年度或完整 JSON；失败由应用决定是否继续使用本地数据。 */
export async function loadHolidayData(url: string, signal?: AbortSignal): Promise<HolidayData> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`节假日数据请求失败：HTTP ${response.status}`);
  return parseHolidayData(await response.json());
}
