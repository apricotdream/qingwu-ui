import { describe, expect, it } from "vitest";
import data from "../data.json";
import {
  type HolidayYear,
  mergeHolidayData,
  parseHolidayData,
  validateHolidayData,
  validateHolidayYear,
} from "./schema";

const year: HolidayYear = {
  schemaVersion: 1,
  year: 2026,
  updatedAt: "2026-10-25",
  sources: [],
  days: [{ date: "2026-10-01", name: "企业安排", isOffDay: false }],
};

describe("节假日 JSON 协议", () => {
  it("历史覆盖明确区分缺失和部分年份，不录入被撤销的2003年五一方案", () => {
    expect(data.coverage.startYear).toBe(1998);
    expect(data.coverage.endYear).toBeGreaterThanOrEqual(2026);
    expect(data.coverage.missingYears).toEqual([1998, 1999, 2000]);
    expect(data.years.filter((item) => item.year <= 2026).map((item) => item.year)).toEqual(
      Array.from({ length: 26 }, (_, i) => 2001 + i),
    );
    expect(
      data.years.filter((item) => item.missingHolidays?.length).map((item) => item.year),
    ).toEqual([2001, 2003]);
    const y2003 = data.years.find((item) => item.year === 2003);
    expect(y2003?.days.some((item) => item.name === "劳动节")).toBe(false);
    expect(y2003?.days.some((item) => item.date === "2003-04-26")).toBe(false);
    expect(() =>
      validateHolidayData({ ...data, coverage: { ...data.coverage, missingYears: [] } }),
    ).toThrow();
  });
  it("历史公告保留跨年补班和当年规则，不套用当前七天假期", () => {
    expect(
      data.years.find((item) => item.year === 2002)?.days.find((item) => item.date === "2001-12-29")
        ?.isOffDay,
    ).toBe(false);
    expect(
      data.years.find((item) => item.year === 2006)?.days.find((item) => item.date === "2005-12-31")
        ?.isOffDay,
    ).toBe(false);
    expect(
      data.years.find((item) => item.year === 2004)?.days.filter((item) => item.name === "元旦"),
    ).toHaveLength(1);
  });
  it("全部内置数据有效，各项民俗内容均可追溯", () => {
    expect(() => validateHolidayData(data)).not.toThrow();
    expect(data.years.every((item) => item.sources.length && item.days.length)).toBe(true);
    expect(data.festivals.length).toBe(21);
  });
  it("年度 JSON 可直接接入", () => {
    expect(parseHolidayData(year).years).toEqual([year]);
  });
  it("自带年度完整替换同年，其他年份和节日资料保留", () => {
    const result = mergeHolidayData(parseHolidayData(data), year);
    expect(result.years.find((item) => item.year === 2026)?.days).toEqual(year.days);
    expect(result.years.find((item) => item.year === 2025)).toBeDefined();
    expect(result.festivals).toHaveLength(21);
  });
  it.each(["2026-02-30", "2026-13-01", "2026-2-01"])("拒绝无效日期 %s", (date) => {
    expect(() => validateHolidayYear({ ...year, days: [{ ...year.days[0], date }] })).toThrow();
  });
  it("拒绝同日同时休息与补班", () => {
    expect(() =>
      validateHolidayYear({ ...year, days: [...year.days, { ...year.days[0], isOffDay: true }] }),
    ).toThrow();
  });
  it("允许下一年公告包含前一年十二月安排", () => {
    expect(() =>
      validateHolidayYear({
        ...year,
        year: 2027,
        days: [{ date: "2026-12-31", name: "元旦", isOffDay: true }],
      }),
    ).not.toThrow();
  });
  it("拒绝危险来源地址与无来源的民俗资料", () => {
    const input = structuredClone(data);
    const festival = input.festivals[0];
    if (!festival) throw new Error("测试缺少资料");
    festival.origin.sources = [
      {
        title: "恶意来源",
        publisher: "外部",
        url: "javascript:alert(1)",
        accessedAt: "2026-10-25",
      },
    ];
    expect(() => validateHolidayData(input)).toThrow();
    festival.origin.sources = [];
    expect(() => validateHolidayData(input)).toThrow();
  });
  it("2026 年国庆为七天，补班包含九月二十日且不含十月十一日", () => {
    const days = data.years.find((item) => item.year === 2026)?.days ?? [];
    expect(days.filter((day) => day.name === "国庆节" && day.isOffDay)).toHaveLength(7);
    expect(days.find((day) => day.date === "2026-09-20")?.isOffDay).toBe(false);
    expect(days.some((day) => day.date === "2026-10-11")).toBe(false);
  });
});
