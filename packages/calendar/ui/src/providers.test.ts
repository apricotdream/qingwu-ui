import { describe, expect, it } from "vitest";
import { DetailPanelProvider, HolidayBadgeProvider, LunarDayMetaProvider } from "./providers";

describe("LunarDayMetaProvider", () => {
  const p = new LunarDayMetaProvider();

  it("农历初一显示月名", () => {
    // 2026-02-17 为农历 2026 年正月初一（春节）
    const meta = p.getDayMeta(new Date(2026, 1, 17));
    expect(meta?.sub).toBe("春节");
    expect(meta?.subClass).toBe("is-festival");
  });

  it("节气日显示节气名", () => {
    // 香港天文台对照表：2026-02-04 立春。
    const meta = p.getDayMeta(new Date(2026, 1, 4));
    expect(meta?.sub).toBe("立春");
    expect(meta?.subClass).toBe("is-term");
  });

  it("普通日显示农历日", () => {
    // 香港天文台公农历对照表：2026-08-01 为六月十九。
    const meta = p.getDayMeta(new Date(2026, 7, 1));
    expect(meta?.sub).toBe("十九");
    expect(meta?.subClass).toBe("is-lunar");
  });
});

describe("HolidayBadgeProvider", () => {
  it("配置的休/工日期返回对应角标", () => {
    const p = new HolidayBadgeProvider({
      holidays: ["2026-10-01"],
      workdays: ["2026-10-10"],
    });
    expect(p.getDayMeta(new Date(2026, 9, 1))).toEqual({
      badge: "休",
      cellClass: "is-holiday",
    });
    expect(p.getDayMeta(new Date(2026, 9, 10))).toEqual({
      badge: "工",
      cellClass: "is-workday",
    });
  });

  it("未接入年度数据时不推测春节放假", () => {
    const p = new HolidayBadgeProvider();
    // 2026-02-17 春节（正月初一）
    const meta = p.getDayMeta(new Date(2026, 1, 17));
    expect(meta).toBeNull();
  });

  it("普通日期无角标", () => {
    const p = new HolidayBadgeProvider();
    expect(p.getDayMeta(new Date(2026, 7, 1))).toBeNull();
  });
});

describe("DetailPanelProvider", () => {
  it("返回包含黄历与节气详情的 HTML", () => {
    const p = new DetailPanelProvider();
    const html = p.render(new Date(2026, 7, 1));
    expect(html).toContain("黄历宜忌");
    expect(html).toContain("农历");
    expect(html).toContain("简化示意 · 非专业黄历 · 仅供参考");
  });
});
