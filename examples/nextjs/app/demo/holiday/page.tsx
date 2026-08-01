"use client";

import { useState } from "react";

const HOLIDAYS = [
  { start: "2026-01-01", end: "2026-01-03", name: "元旦", color: "var(--vermilion)" },
  { start: "2026-02-17", end: "2026-02-23", name: "春节", color: "var(--vermilion)" },
  { start: "2026-04-04", end: "2026-04-06", name: "清明", color: "var(--teal)" },
  { start: "2026-05-01", end: "2026-05-05", name: "劳动节", color: "var(--amber)" },
  { start: "2026-06-19", end: "2026-06-21", name: "端午", color: "var(--teal)" },
  { start: "2026-09-25", end: "2026-09-27", name: "中秋", color: "var(--amber)" },
  { start: "2026-10-01", end: "2026-10-08", name: "国庆", color: "var(--vermilion)" },
];

const WORKDAYS = [
  { date: "2026-01-04", name: "元旦补班" },
  { date: "2026-02-14", name: "春节补班" },
  { date: "2026-02-28", name: "春节补班" },
  { date: "2026-10-10", name: "国庆补班" },
  { date: "2026-10-11", name: "国庆补班" },
];

/* 模拟 2026 日历布局：展示节假日如何映射到日格 */
const MONTH_DAYS: Record<string, { days: number; startDow: number }> = {
  "1": { days: 31, startDow: 4 },
  "2": { days: 28, startDow: 0 },
  "4": { days: 30, startDow: 3 },
  "5": { days: 31, startDow: 5 },
  "6": { days: 30, startDow: 1 },
  "9": { days: 30, startDow: 2 },
  "10": { days: 31, startDow: 4 },
};

export default function HolidayPage() {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(HOLIDAYS.map((h) => h.name)));

  const toggle = (name: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  /* 计算某天是否属于某个假期的日期范围 */
  const getHolidayName = (month: string, day: number): string | null => {
    const d = `2026-${month.padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    for (const h of HOLIDAYS) {
      if (!enabled.has(h.name)) continue;
      if (d >= h.start && d <= h.end) return h.name;
    }
    return null;
  };

  const getWorkdayName = (month: string, day: number): string | null => {
    const d = `2026-${month.padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return WORKDAYS.find((w) => w.date === d)?.name ?? null;
  };

  const WDAYS = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <>
      <section className="page-hero">
        <h1>自定义休假表</h1>
        <p>通过 <code style={{ background: "var(--qw-code-bg)", padding: "2px 6px", borderRadius: 4, fontSize: "0.9em" }}>createHolidayPlugin()</code> 注入自定义节假日数据，与农历插件走同一 DayMetaProvider 管线。</p>
      </section>

      {/* 假期开关 */}
      <div className="section-header">
        <h2>2026 年节假日</h2>
        <div className="section-header-line" />
      </div>
      <div className="holiday-toggles">
        {HOLIDAYS.map((h) => (
          <button
            key={h.name}
            className={`holiday-toggle${enabled.has(h.name) ? " is-on" : ""}`}
            onClick={() => toggle(h.name)}
            style={enabled.has(h.name) ? { borderColor: h.color, color: h.color, background: `${h.color}15` } : undefined}
          >
            {h.name} ({h.start} ~ {h.end})
          </button>
        ))}
      </div>

      <div className="demo-grid">
        {/* 各月日历可视化 */}
        {Object.entries(MONTH_DAYS).map(([month, { days, startDow }]) => {
          const monthNames: Record<string, string> = { "1": "一月", "2": "二月", "4": "四月", "5": "五月", "6": "六月", "9": "九月", "10": "十月" };
          const cells: { d: number; isHoliday: boolean; isWorkday: boolean; holidayName?: string; workdayName?: string }[] = [];
          for (let i = 0; i < startDow; i++) cells.push({ d: 0, isHoliday: false, isWorkday: false });
          for (let d = 1; d <= days; d++) {
            const hn = getHolidayName(month, d);
            const wn = getWorkdayName(month, d);
            cells.push({ d, isHoliday: !!hn, isWorkday: !!wn, holidayName: hn ?? undefined, workdayName: wn ?? undefined });
          }
          /* pad to complete rows */
          while (cells.length % 7 !== 0) cells.push({ d: 0, isHoliday: false, isWorkday: false });

          return (
            <div key={month} className="demo-card">
              <div className="demo-card-header">
                <h4>{monthNames[month]}</h4>
                <p style={{ fontSize: 11 }}>2026 年{month}月 · 含节假日标记</p>
              </div>
              <div className="demo-card-stage" style={{ padding: "10px 6px" }}>
                <div className="qw-weekdays">
                  {WDAYS.map((w) => <span key={w}>{w}</span>)}
                </div>
                <div className="vis-cal" style={{ borderRadius: 6 }}>
                  {cells.map((cell, i) => (
                    <div
                      key={i}
                      className={`vis-cal-cell${cell.d === 0 ? " other-month" : ""}${cell.isHoliday ? " holiday" : ""}${cell.isWorkday ? " workday" : ""}`}
                      style={{ minHeight: 42, padding: "5px 1px" }}
                      title={cell.holidayName ?? cell.workdayName}
                    >
                      {cell.d > 0 && (
                        <>
                          <span className="vis-cal-cell-num" style={{ fontSize: 11.5 }}>{cell.d}</span>
                          {cell.isHoliday && <span className="vis-cal-cell-badge rest">休</span>}
                          {cell.isWorkday && <span className="vis-cal-cell-badge work">班</span>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* JSON 配置示例 */}
        <div className="demo-card is-full">
          <div className="demo-card-header">
            <h4>API 用法</h4>
            <p>向 Calendar 组件传入 holidays/workdays JSON 配置即可启用休假标记。</p>
          </div>
          <div className="demo-card-stage">
            <div style={{ background: "var(--qw-code-bg)", padding: 16, borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-2)" }}>
              <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>// 在日历初始化时传入休假配置</span><br />
              <span style={{ color: "var(--teal)" }}>new</span> Calendar(el, {"{"}<br />
              {"  "}holidays: {"{"}<br />
              {"    "}<span style={{ color: "var(--vermilion)" }}>holidays</span>: [<span style={{ color: "var(--vermilion)" }}>&quot;2026-10-01&quot;</span>, <span style={{ color: "var(--vermilion)" }}>&quot;2026-10-02&quot;</span>, ...],<br />
              {"    "}<span style={{ color: "var(--teal)" }}>workdays</span>: [<span style={{ color: "var(--teal)" }}>&quot;2026-10-10&quot;</span>, ...],<br />
              {"  }"},<br />
              {"}"});
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
