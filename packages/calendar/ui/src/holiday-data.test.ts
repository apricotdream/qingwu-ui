import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar as CoreCalendar } from "./core";
import {
  findFestivals,
  type HolidayYear,
  loadHolidayData,
  normalizeHolidayData,
} from "./holiday-data";
import { Calendar, holidayData } from "./index";
import { solarToLunar } from "./lunar";
import { DetailPanelProvider, HolidayBadgeProvider } from "./providers";

function mount(): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  return root;
}
afterEach(() => {
  document.body.textContent = "";
  vi.unstubAllGlobals();
});
const customYear: HolidayYear = {
  schemaVersion: 1,
  year: 2026,
  updatedAt: "2026-10-25",
  sources: [],
  days: [{ date: "2026-10-01", name: "企业补班", isOffDay: false }],
};

describe("日历节假日数据接入", () => {
  it("默认入口自动展示真实补班及公告来源", () => {
    const cal = new Calendar(mount(), { selected: "2026-09-20" });
    cal.open();
    expect(
      document.querySelector('[data-date="2026-09-20"]')?.classList.contains("is-workday"),
    ).toBe(true);
    expect(document.querySelector(".qw-cal-detail")?.textContent).toContain("调休上班");
    expect(document.querySelector(".qw-detail-sources a")?.getAttribute("href")).toMatch(
      /^https:\/\/www.gov.cn\//,
    );
    cal.destroy();
  });
  it("自带年度替换该年全部默认日期，其他年保留", () => {
    const cal = new Calendar(mount(), { selected: "2026-10-01", holidayData: customYear });
    cal.open();
    expect(
      document.querySelector('[data-date="2026-10-01"]')?.classList.contains("is-workday"),
    ).toBe(true);
    expect(
      document.querySelector('[data-date="2026-10-02"]')?.classList.contains("is-holiday"),
    ).toBe(false);
    expect(document.querySelector(".qw-cal-detail")?.textContent).toContain("企业补班");
    cal.destroy();
  });
  it("core 入口无默认调休，关闭默认数据时仍有农历", () => {
    for (const make of [
      () => new CoreCalendar(mount(), { selected: "2026-10-01" }),
      () => new Calendar(mount(), { selected: "2026-10-01", holidayData: false }),
    ]) {
      const cal = make();
      cal.open();
      expect(document.querySelector('[data-date="2026-10-01"] .qw-cal-cell-badge')).toBeNull();
      expect(document.querySelector(".qw-cal-detail")?.textContent).toContain("农历");
      cal.destroy();
    }
  });
  it("显式休假优先于年度补班，显式补班优先于休假", () => {
    const p = new HolidayBadgeProvider(
      { holidays: ["2026-09-20", "2026-10-01"], workdays: ["2026-10-01"] },
      holidayData,
    );
    expect(p.getDayMeta(new Date(2026, 8, 20))?.badge).toBe("休");
    expect(p.getDayMeta(new Date(2026, 9, 1))?.badge).toBe("工");
  });
  it("未来空年份不猜测休工，跨年公告优先", () => {
    expect(new HolidayBadgeProvider({}, holidayData).getDayMeta(new Date(2027, 9, 1))).toBeNull();
    const data = normalizeHolidayData({
      schemaVersion: 1,
      updatedAt: "2026-10-25",
      festivals: [],
      years: [
        { ...customYear, year: 2027, days: [{ date: "2026-10-01", name: "修订", isOffDay: true }] },
        customYear,
      ],
    });
    expect(new HolidayBadgeProvider({}, data).getDayMeta(new Date(2026, 9, 1))?.badge).toBe("休");
  });
  it("除夕按下一天是否春节判断，覆盖腊月二十九", () => {
    expect(findFestivals(holidayData, new Date(2026, 1, 16)).map((f) => f.name)).toContain("除夕");
  });
  it("闰月不重复标记同名农历节日", () => {
    const date = new Date(2025, 6, 25);
    const lunar = solarToLunar(date);
    expect(lunar.isLeap).toBe(true);
    const first = holidayData.festivals[0];
    if (!first) throw new Error("无测试节日");
    const data = {
      ...holidayData,
      festivals: [
        { ...first, rule: { calendar: "lunar" as const, month: lunar.month, day: lunar.day } },
      ],
    };
    expect(findFestivals(data, date)).toEqual([]);
  });
  it("资料内容仅按文本展示，来源链接安全且可追溯", () => {
    const first = holidayData.festivals[0];
    if (!first) throw new Error("无测试节日");
    const data = {
      ...holidayData,
      festivals: [
        {
          ...first,
          name: '<img src=x onerror="alert(1)">',
          origin: { ...first.origin, text: "<script>bad()</script>" },
        },
      ],
    };
    const cal = new CoreCalendar(mount(), { selected: "2026-02-17", holidayData: data });
    cal.open();
    expect(document.querySelector(".qw-cal-detail img, .qw-cal-detail script")).toBeNull();
    expect(document.querySelector(".qw-cal-detail")?.textContent).toContain(
      "<script>bad()</script>",
    );
    expect(document.querySelector(".qw-detail-references a")?.getAttribute("rel")).toBe(
      "noopener noreferrer",
    );
    cal.destroy();
    expect(new DetailPanelProvider(holidayData).render(new Date(2026, 1, 17))).toContain(
      "资料来源",
    );
  });
  it("在线年度 JSON 与离线协议一致，HTTP 错误不会成为空数据", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(customYear))));
    expect((await loadHolidayData("/holiday.json")).years).toEqual([customYear]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(loadHolidayData("/holiday.json")).rejects.toThrow("503");
  });
});
