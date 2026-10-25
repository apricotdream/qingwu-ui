import { expect, it } from "vitest";
import { getSolarTerm, lunarToSolar, solarToLunar } from "./lunar";

// 香港天文台公农历日期对照表：覆盖小月、闰月、春节与传统节日。
it.each([
  [2025, 1, 29, 1, 1, false],
  [2025, 5, 31, 5, 5, false],
  [2025, 7, 25, 6, 1, true],
  [2025, 10, 6, 8, 15, false],
  [2026, 2, 16, 12, 29, false],
  [2026, 2, 17, 1, 1, false],
  [2026, 6, 19, 5, 5, false],
  [2026, 9, 25, 8, 15, false],
])("%i-%i-%i 的公农历双向换算", (year, month, day, lunarMonth, lunarDay, isLeap) => {
  const solar = new Date(Number(year), Number(month) - 1, Number(day));
  const lunar = solarToLunar(solar);
  expect(lunar).toMatchObject({ month: lunarMonth, day: lunarDay, isLeap });
  // lunarToSolar 的公开契约返回 UTC 日期，按 UTC 年月日核对。
  expect(
    lunarToSolar(lunar.year, lunar.month, lunar.day, lunar.isLeap).toISOString().slice(0, 10),
  ).toBe(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
});

it.each([
  [2024, 4, 4],
  [2025, 4, 4],
  [2026, 4, 5],
])("%i 年清明日期由节气确定", (year, month, day) => {
  expect(getSolarTerm(new Date(year, month - 1, day))?.name).toBe("清明");
});
