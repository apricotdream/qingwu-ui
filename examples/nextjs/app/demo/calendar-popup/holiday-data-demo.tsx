"use client";

import { Calendar, holidayData } from "@qingwu-ui/calendar";
import {
  Calendar as CoreCalendar,
  type HolidayData,
  loadHolidayData,
  parseHolidayData,
} from "@qingwu-ui/calendar/core";
import { useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";
import { asset } from "@/lib/assets";
import styles from "./holiday-data-demo.module.css";

const initialJSON = JSON.stringify(
  holidayData.years.find((year) => year.year === 2026),
  null,
  2,
);

export default function HolidayDataDemo() {
  const defaultRoot = useRef<HTMLDivElement>(null);
  const customRoot = useRef<HTMLDivElement>(null);
  const [json, setJSON] = useState(initialJSON);
  const [custom, setCustom] = useState<HolidayData>(() =>
    parseHolidayData(JSON.parse(initialJSON)),
  );
  const [message, setMessage] = useState("已接入自带年度 JSON，可编辑日期后应用。");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2026);
  const yearData = holidayData.years.find((year) => year.year === selectedYear);
  const coverage = holidayData.coverage;
  const partialYears = holidayData.years.filter((year) => year.missingHolidays?.length);
  const historyYears = Array.from(
    { length: (coverage?.endYear ?? 2026) - (coverage?.startYear ?? 1998) + 1 },
    (_, index) => (coverage?.startYear ?? 1998) + index,
  );

  useEffect(() => {
    if (!defaultRoot.current) return;
    const cal = new Calendar(defaultRoot.current, {
      mode: "popover",
      selected: selectedYear === 2026 ? "2026-02-17" : `${selectedYear}-01-01`,
      dateOnly: true,
      placeholder: "默认节假日日历",
    });
    return () => cal.destroy();
  }, [selectedYear]);
  useEffect(() => {
    if (!customRoot.current) return;
    const cal = new CoreCalendar(customRoot.current, {
      mode: "popover",
      selected: "2026-10-01",
      dateOnly: true,
      holidayData: custom,
      placeholder: "自带 JSON 日历",
    });
    return () => cal.destroy();
  }, [custom]);

  function applyJSON() {
    try {
      setCustom(parseHolidayData(JSON.parse(json)));
      setError(false);
      setMessage("JSON 已应用，点击下方日期查看休假和调休标记。");
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "JSON 格式不正确");
    }
  }
  async function refresh() {
    setLoading(true);
    try {
      const data = await loadHolidayData(
        asset("/holiday-data/data.json"),
        AbortSignal.timeout(10000),
      );
      setJSON(JSON.stringify(data, null, 2));
      setCustom(data);
      setError(false);
      setMessage(`已从本站 JSON 加载，数据更新于 ${data.updatedAt}。`);
    } catch {
      setError(true);
      setMessage("加载失败，继续使用已应用的数据。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DemoCard
      title="节假日数据与资料来源"
      desc="默认离线使用 @qingwu-ui/holiday-data。点击春节日期可查看农历、节日介绍、渊源、习俗及资料来源；年度安排与民俗资料分别标注。"
      full
    >
      <div className={styles.layout}>
        <section className={styles.defaultSection} aria-label="默认节假日数据">
          <h3>开箱即用</h3>
          <p>
            已收录 {holidayData.years.length} 个年份的可核实安排，包含{" "}
            {holidayData.festivals.length} 项节日资料。
          </p>
          <p>
            数据更新：<time dateTime={holidayData.updatedAt}>{holidayData.updatedAt}</time>
            。缺失年份：{coverage?.missingYears.join("、") || "无"}。部分收录：
            {partialYears.map((year) => year.year).join("、") || "无"}；未核实日期不推测调休。
          </p>
          <label htmlFor="holiday-history-year">查看历史年份</label>
          <select
            id="holiday-history-year"
            className={styles.yearSelect}
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {historyYears.map((year) => {
              const item = holidayData.years.find((record) => record.year === year);
              return (
                <option key={year} value={year}>
                  {year} 年 ·{" "}
                  {item ? (item.missingHolidays?.length ? "部分收录" : "已收录") : "缺失"}
                </option>
              );
            })}
          </select>
          <p role="status" id="holiday-history-status">
            {yearData
              ? `${selectedYear} 年${yearData.missingHolidays?.length ? `部分收录，尚缺：${yearData.missingHolidays.join("、")}` : "已收录年度安排"}。共 ${yearData.days.length} 条休假/补班日期（含公告跨年日期）。`
              : `${selectedYear} 年尚无可核实的完整年度公告，未录入放假调休日期。`}
          </p>
          <div ref={defaultRoot} />
          {yearData && (
            <div className={styles.historySources}>
              <p>本年度核对公告</p>
              {yearData.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.title} ↗
                </a>
              ))}
            </div>
          )}
          <div className={styles.links}>
            <a href={asset("/holiday-data/data.json")} target="_blank" rel="noreferrer">
              查看完整 JSON ↗
            </a>
            <a href="https://github.com/NateScarlet/holiday-cn" target="_blank" rel="noreferrer">
              年度数据来源 ↗
            </a>
          </div>
          <pre className={styles.code}>{`import { Calendar } from "@qingwu-ui/calendar";
new Calendar(el); // 默认接入本地数据

// 不安装数据包：npm install @qingwu-ui/calendar --omit=optional
// 该参数会跳过所有可选依赖，随后使用 /core 入口。`}</pre>
        </section>
        <section className={styles.customSection} aria-label="自带 JSON 数据">
          <h3>使用自己的 JSON</h3>
          <p>
            /core 入口不引用默认数据包。年度文件提供放假调休；传入含 festivals 的完整 JSON
            可同时展示节日资料和来源。
          </p>
          <label htmlFor="holiday-json">节假日 JSON</label>
          <textarea
            id="holiday-json"
            className={styles.editor}
            spellCheck={false}
            value={json}
            onChange={(event) => setJSON(event.target.value)}
            aria-invalid={error}
            aria-describedby="holiday-json-status"
          />
          <div className={styles.actions}>
            <button type="button" onClick={applyJSON}>
              应用 JSON
            </button>
            <button type="button" onClick={refresh} disabled={loading}>
              {loading ? "加载中…" : "从本站 JSON 加载"}
            </button>
          </div>
          <p id="holiday-json-status" role="status" className={error ? styles.error : undefined}>
            {message}
          </p>
          <div ref={customRoot} />
          <pre className={styles.code}>{`import { Calendar } from "@qingwu-ui/calendar/core";
import data from "./holidays.json";
new Calendar(el, { holidayData: data });`}</pre>
        </section>
      </div>
    </DemoCard>
  );
}
