"use client";

import { Calendar } from "@qingwu-ui/calendar";
import { useCallback, useEffect, useRef, useState } from "react";
import "@qingwu-ui/button/style.css";
import DemoCard from "@/components/DemoCard";

/* ============================================================
   内联日期选择字段 —— 使用项目日历组件作为日期选择器
   ============================================================ */

function DatePickerField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cal = new Calendar(el, {
      placeholder,
      selected: value || undefined,
      showDetailPanel: false,
      onChange: (dateStr: string) => {
        syncing.current = true;
        onChange(dateStr.slice(0, 10));
        setTimeout(() => {
          syncing.current = false;
        }, 0);
      },
    });
    return () => cal.destroy();
    // 只挂载一次，外部 value 变化不重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} />;
}

/* ============================================================
   props 面板字段定义
   ============================================================ */

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "boolean" | "textarea";
  defaultValue: string;
  options?: { label: string; value: string }[];
}

const FIELDS: FieldDef[] = [
  { key: "placeholder", label: "占位文本", type: "text", defaultValue: "点击选择日期" },
  { key: "selected", label: "默认选中日期", type: "date", defaultValue: "" },
  { key: "min", label: "最小日期", type: "date", defaultValue: "" },
  { key: "max", label: "最大日期", type: "date", defaultValue: "" },
  {
    key: "inputName",
    label: "输入框 name",
    type: "select",
    defaultValue: "",
    options: [
      { label: "（无）", value: "" },
      { label: "date", value: "date" },
      { label: "birthday", value: "birthday" },
      { label: "appointment", value: "appointment" },
    ],
  },
  {
    key: "showDetailPanel",
    label: "日历详情",
    type: "boolean",
    defaultValue: "false",
    options: [
      { label: "关闭", value: "false" },
      { label: "开启", value: "true" },
    ],
  },
  {
    key: "holidays",
    label: "休假日历（JSON）",
    type: "textarea",
    defaultValue: JSON.stringify(
      {
        holidays: [
          "2026-10-01",
          "2026-10-02",
          "2026-10-03",
          "2026-10-04",
          "2026-10-05",
          "2026-10-06",
          "2026-10-07",
        ],
        workdays: ["2026-10-10", "2026-10-11"],
      },
      null,
      2,
    ),
  },
];

/* ============================================================
   日格可视化（原 calendar-basic demo）
   ============================================================ */

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

interface VisCell {
  d: number;
  sub: string;
  m: string;
  holiday?: boolean;
  badge?: string;
  badgeClass?: string;
  today?: boolean;
  term?: string;
}

const GRID_CELLS: VisCell[] = [
  /* 7/27 - 8/2 */ { d: 27, sub: "廿三", m: "prev" },
  { d: 28, sub: "廿四", m: "prev" },
  { d: 29, sub: "廿五", m: "prev" },
  { d: 30, sub: "廿六", m: "prev" },
  { d: 31, sub: "廿七", m: "prev" },
  { d: 1, sub: "建军", m: "curr", holiday: true, badge: "休", badgeClass: "rest" },
  { d: 2, sub: "十九", m: "curr" },
  ...[7, 8, 9, 10, 11, 12, 13].map((d) => ({
    d,
    sub: ["二十", "廿一", "廿二", "廿三", "廿四", "廿五", "廿六"][d - 7],
    m: "curr",
  })),
  ...[14, 15, 16, 17, 18, 19, 20].map((d) => {
    const subs: Record<number, string> = {
      14: "廿七",
      15: "廿八",
      16: "廿九",
      17: "三十",
      18: "初一",
      19: "初二",
      20: "初三",
    };
    return { d, sub: subs[d] ?? `${d}`, m: "curr" };
  }),
  ...[21, 22, 23, 24, 25, 26, 27].map((d) => ({
    d,
    sub: `初${["四", "五", "六", "七", "八", "九", "十"][d - 21]}`,
    m: "curr",
  })),
  ...[28, 29, 30, 31, 1, 2, 3].map((d) => ({
    d,
    sub: d <= 31 ? `十${d - 27}` : `${d}`,
    m: "curr",
  })),
].map((cell) => ({ ...cell, today: cell.d === 31 && cell.m === "curr" }));

/* ============================================================
   节假日与调休（原 holiday demo）
   ============================================================ */

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

/* ============================================================
   禁用规则（原 rules demo）
   ============================================================ */

const RULES_EXAMPLES = [
  {
    title: "禁用周末",
    code: `registerRules([\n  { type: "dayOfWeek", values: [0, 6] },\n]);`,
    desc: "禁用所有周六和周日，不可选择。",
  },
  {
    title: "日期区间禁用",
    code: `registerRules([\n  {\n    type: "range",\n    start: "2026-10-01",\n    end: "2026-10-08",\n  },\n]);`,
    desc: "国庆期间（含调休）全部禁用。",
  },
  {
    title: "组合规则",
    code: `registerRules([\n  { type: "dayOfWeek", values: [0, 6] },\n  { type: "before", date: "2026-01-01" },\n  { type: "after", date: "2026-12-31" },\n]);`,
    desc: "仅允许 2026 年内的工作日（周一至周五）可选。",
  },
  {
    title: "自定义判断函数",
    code: `registerRules([\n  {\n    type: "custom",\n    fn: (dayMeta) => {\n      return dayMeta.isHoliday !== true;\n    },\n  },\n]);`,
    desc: "通过自定义函数，根据 dayMeta 动态判断是否禁用。",
  },
];

function DisabledCalendar({ ruleTitle }: { ruleTitle: string }) {
  /* 根据规则标题决定哪些日期被禁用 */
  const isDisabled = (day: number, dow: number): boolean => {
    if (ruleTitle === "禁用周末") return dow === 5 || dow === 6;
    if (ruleTitle === "日期区间禁用") return day >= 1 && day <= 8;
    if (ruleTitle === "组合规则") return dow === 5 || dow === 6;
    if (ruleTitle === "自定义判断函数") return day % 3 === 0;
    return false;
  };

  /* 模拟 2026 年 10 月：1 号是周四 (dow=3) */
  const startDow = 3;
  const days = 31;
  const cells: { d: number; disabled: boolean }[] = [];
  for (let i = 0; i < startDow; i++) cells.push({ d: 0, disabled: false });
  for (let d = 1; d <= days; d++) {
    cells.push({ d, disabled: isDisabled(d, (startDow + d - 1) % 7) });
  }
  while (cells.length % 7 !== 0) cells.push({ d: 0, disabled: false });

  return (
    <div style={{ marginTop: 10 }}>
      <div className="qw-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="vis-cal" style={{ borderRadius: 6, maxWidth: 280 }}>
        {cells.map((cell, i) => (
          <div
            key={i}
            className="vis-cal-cell"
            style={{
              minHeight: 34,
              padding: "4px 1px",
              opacity: cell.d === 0 ? 0.15 : cell.disabled ? 0.35 : 1,
              background: cell.disabled
                ? "color-mix(in srgb, var(--line) 40%, transparent)"
                : undefined,
              textDecoration: cell.disabled ? "line-through" : undefined,
            }}
          >
            {cell.d > 0 && (
              <span
                className="vis-cal-cell-num"
                style={{ fontSize: 11, color: cell.disabled ? "var(--ink-3)" : undefined }}
              >
                {cell.d}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */

export default function CalendarPopupPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const calRef = useRef<Calendar | null>(null);

  const [props, setProps] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.defaultValue])),
  );

  const [log, setLog] = useState<string[]>([]);
  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  /* 节假日开关（原 holiday demo） */
  const [enabled, setEnabled] = useState<Set<string>>(new Set(HOLIDAYS.map((h) => h.name)));
  const toggleHoliday = (name: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  /* 禁用规则（原 rules demo） */
  const [activeRule, setActiveRule] = useState(0);

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

  const renderCalendar = useCallback(
    (currentProps: Record<string, string>) => {
      const el = rootRef.current;
      if (!el) return;

      if (calRef.current) {
        calRef.current.destroy();
        calRef.current = null;
      }
      el.textContent = "";

      const opts: Record<string, unknown> = {};
      if (currentProps.placeholder) opts.placeholder = currentProps.placeholder;
      if (currentProps.selected) opts.selected = currentProps.selected;
      if (currentProps.min) opts.min = currentProps.min;
      if (currentProps.max) opts.max = currentProps.max;
      if (currentProps.inputName) opts.inputName = currentProps.inputName;
      opts.showDetailPanel = currentProps.showDetailPanel === "true";
      try {
        const h = JSON.parse(currentProps.holidays || "{}");
        if (h.holidays || h.workdays) opts.holidays = h;
      } catch {
        /* JSON 格式错误，忽略 */
      }
      opts.onChange = (date: string) => addLog(`onChange → ${date}`);
      opts.onOpenChange = (open: boolean) => addLog(`面板 ${open ? "打开" : "关闭"}`);

      calRef.current = new Calendar(el, opts);
      const count = Object.keys(opts).filter(
        (k) => k !== "onChange" && k !== "onOpenChange",
      ).length;
      addLog(`日历渲染完成（${count} 项配置）`);
    },
    [addLog],
  );

  /* 首次加载 */
  useEffect(() => {
    renderCalendar(props);
    return () => {
      if (calRef.current) calRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = () => {
    renderCalendar(props);
  };

  /* 更新 props 通用函数 */
  const setProp = (key: string, val: string) => setProps((p) => ({ ...p, [key]: val }));

  /* 构建 opts 代码行 */
  const buildOptsLines = () => {
    const lines: string[] = [];
    if (props.placeholder && props.placeholder !== "点击选择日期")
      lines.push(`  placeholder: "${props.placeholder}",`);
    if (props.selected) lines.push(`  selected: "${props.selected}",`);
    if (props.min) lines.push(`  min: "${props.min}",`);
    if (props.max) lines.push(`  max: "${props.max}",`);
    if (props.inputName) lines.push(`  inputName: "${props.inputName}",`);
    if (props.showDetailPanel === "true")
      lines.push("  showDetailPanel: true,    // 开启右侧详情面板");
    try {
      const h = JSON.parse(props.holidays || "{}");
      if (h.holidays || h.workdays) {
        lines.push("  holidays: {");
        if (h.holidays?.length) lines.push(`    holidays: ${JSON.stringify(h.holidays)},`);
        if (h.workdays?.length) lines.push("    workdays: " + JSON.stringify(h.workdays) + ",");
        lines.push("  },");
      }
    } catch {
      /* ignore */
    }
    return lines;
  };

  /* React / HTML / Vue 三格式代码 */
  const snippets = (() => {
    const optsLines = buildOptsLines();

    const react = [
      'import { Calendar } from "@qingwu-ui/calendar";',
      'import "@qingwu-ui/calendar/style.css";',
      "",
      "function CalendarPicker() {",
      "  const rootRef = useRef<HTMLDivElement>(null);",
      "  const calRef = useRef<Calendar | null>(null);",
      "",
      "  useEffect(() => {",
      "    const el = rootRef.current;",
      "    if (!el) return;",
      `    calRef.current = new Calendar(el, ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines,
      optsLines.length > 0 ? "    });" : "    {});",
      "    return () => calRef.current?.destroy();",
      "  }, []);",
      "",
      '  return <div ref={rootRef} className="qw-cal-root" />;',
      "}",
    ].join("\n");

    const html = [
      "<!DOCTYPE html>",
      '<html lang="zh-CN">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <script type="module">',
      '    import { Calendar } from "https://unpkg.com/@qingwu-ui/calendar";',
      "  </script>",
      '  <link rel="stylesheet" href="https://unpkg.com/@qingwu-ui/calendar/style.css" />',
      "</head>",
      "<body>",
      '  <div id="root"></div>',
      "  <script>",
      `    const cal = new Calendar(document.querySelector("#root"), ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines.map((l) => `    ${l}`),
      optsLines.length > 0 ? "    });" : "    {});",
      "  </script>",
      "</body>",
      "</html>",
    ].join("\n");

    const vue = [
      "<template>",
      '  <div ref="rootRef" class="qw-cal-root"></div>',
      "</template>",
      "",
      '<script setup lang="ts">',
      'import { ref, onMounted, onUnmounted } from "vue";',
      'import { Calendar } from "@qingwu-ui/calendar";',
      'import "@qingwu-ui/calendar/style.css";',
      "",
      "const rootRef = ref<HTMLDivElement>();",
      "let cal: Calendar | null = null;",
      "",
      "onMounted(() => {",
      "  if (!rootRef.value) return;",
      `  cal = new Calendar(rootRef.value, ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines,
      optsLines.length > 0 ? "  });" : "  {});",
      "});",
      "",
      "onUnmounted(() => cal?.destroy());",
      "</script>",
    ].join("\n");

    return { react, html, vue };
  })();

  return (
    <div className="demo-grid">
      <DemoCard
        title="Calendar 弹出选择"
        desc="输入框 + 日历图标触发 → 弹出面板，农历/节气/节日/黄历宜忌详情侧栏，键盘导航。"
        full
        snippets={snippets}
      >
        {/* props 面板 */}
        <div className="cal-props-panel">
          <div className="cal-props-grid">
            {FIELDS.map((field) => (
              <label key={field.key} className="cal-props-field">
                <span className="cal-props-label">{field.label}</span>
                {field.type === "date" ? (
                  <DatePickerField
                    value={props[field.key]}
                    placeholder={field.defaultValue || `选择${field.label}`}
                    onChange={(v) => setProp(field.key, v)}
                  />
                ) : field.type === "boolean" || field.type === "select" ? (
                  <select
                    className="cal-props-input"
                    value={props[field.key]}
                    onChange={(e) => setProp(field.key, e.target.value)}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    className="cal-props-textarea"
                    rows={4}
                    value={props[field.key]}
                    onChange={(e) => setProp(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    className="cal-props-input"
                    type="text"
                    placeholder={field.defaultValue || `输入${field.label}`}
                    value={props[field.key]}
                    onChange={(e) => setProp(field.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="cal-props-actions">
            <button className="qw-btn qw-btn-primary" type="button" onClick={handleConfirm}>
              应用配置
            </button>
          </div>
        </div>

        {/* 日历挂载点 + 日志 */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div ref={rootRef} className="qw-cal-root" />
          <div className="cal-log-panel">
            <div className="cal-log-title">操作日志</div>
            <div className="cal-log-list">
              {log.length === 0 ? (
                <div className="cal-log-empty">暂无日志，操作日历后将在此显示</div>
              ) : (
                log.map((msg, i) => (
                  <div key={i} className="cal-log-item">
                    {msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DemoCard>

      {/* ---- 日格结构（原 calendar-basic） ---- */}
      <DemoCard
        title="日格结构"
        desc="日历月视图的网格结构。每个日格包含公历数字、农历日期、节日/节气标注、休/工角标。"
        full
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: 500, width: "100%" }}>
            {/* 月导航 */}
            <div className="cal-top" style={{ justifyContent: "center", marginBottom: 14 }}>
              <button className="btn icon" style={{ width: 32, height: 32, fontSize: 14 }}>
                ‹
              </button>
              <div className="cal-title" style={{ minWidth: 120, justifyContent: "center" }}>
                <span className="cal-month">2026 年 8 月</span>
                <span className="cal-lunar-year">丙午年·七月</span>
              </div>
              <button className="btn icon" style={{ width: 32, height: 32, fontSize: 14 }}>
                ›
              </button>
            </div>

            {/* 星期头 */}
            <div className="qw-weekdays">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            {/* 日格网格 */}
            <div className="vis-cal">
              {GRID_CELLS.map((cell, i) => (
                <div
                  key={i}
                  className={`vis-cal-cell${cell.m === "prev" ? " other-month" : ""}${cell.today ? " today" : ""}${cell.holiday ? " holiday" : ""}`}
                >
                  <span className="vis-cal-cell-num">{cell.d}</span>
                  <span className="vis-cal-cell-sub">{cell.sub}</span>
                  {cell.badge && (
                    <span className={`vis-cal-cell-badge ${cell.badgeClass}`}>{cell.badge}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="cal-foot" style={{ textAlign: "center" }}>
              <span className="cal-foot-label">图例：</span>
              <span style={{ color: "var(--vermilion)" }}>休</span> = 休息日 ·{" "}
              <span style={{ color: "var(--teal)" }}>工</span> = 调班工作日 ·{" "}
              <span style={{ marginLeft: 4, color: "var(--amber)" }}>节气</span> = 节气标注
            </div>
          </div>
        </div>
      </DemoCard>

      {/* ---- DayMeta 渲染管线（原 calendar-basic） ---- */}
      <DemoCard
        title="DayMeta 渲染管线"
        desc="每个日格的 dayMeta 对象经过多层插件管线合并生成，最终写入 DOM。所有插件遵循统一的 DayMetaProvider 契约。"
        full
      >
        <div className="pipeline" style={{ justifyContent: "center" }}>
          <div className="pipeline-step">
            <div className="pipeline-step-label">Step 1</div>
            <div className="pipeline-step-name">基础日期</div>
          </div>
          <span className="pipeline-arrow">→</span>
          <div className="pipeline-step">
            <div className="pipeline-step-label">Step 2</div>
            <div className="pipeline-step-name">农历插件</div>
          </div>
          <span className="pipeline-arrow">→</span>
          <div className="pipeline-step">
            <div className="pipeline-step-label">Step 3</div>
            <div className="pipeline-step-name">节日/节气</div>
          </div>
          <span className="pipeline-arrow">→</span>
          <div className="pipeline-step">
            <div className="pipeline-step-label">Step 4</div>
            <div className="pipeline-step-name">休假表</div>
          </div>
          <span className="pipeline-arrow">→</span>
          <div className="pipeline-step">
            <div className="pipeline-step-label">Step 5</div>
            <div className="pipeline-step-name">规则引擎</div>
          </div>
          <span className="pipeline-arrow">→</span>
          <div className="pipeline-step">
            <div className="pipeline-step-label">Output</div>
            <div className="pipeline-step-name">dayMeta</div>
          </div>
        </div>
        <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--ink-3)", marginTop: 12 }}>
          完整交互演示请使用上方「Calendar 弹出选择」卡片。
        </p>
      </DemoCard>

      {/* ---- 节假日与调休（原 holiday demo） ---- */}
      <DemoCard
        title="节假日与调休"
        desc="通过 createHolidayPlugin() 注入自定义节假日数据，与农历插件走同一 DayMetaProvider 管线。下方是 2026 年法定节假日在日历网格上的映射。"
        full
      >
        <div className="holiday-toggles">
          {HOLIDAYS.map((h) => (
            <button
              key={h.name}
              className={`holiday-toggle${enabled.has(h.name) ? " is-on" : ""}`}
              onClick={() => toggleHoliday(h.name)}
              style={
                enabled.has(h.name)
                  ? { borderColor: h.color, color: h.color, background: `${h.color}15` }
                  : undefined
              }
            >
              {h.name} ({h.start} ~ {h.end})
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 16 }}>
          {Object.entries(MONTH_DAYS).map(([month, { days, startDow }]) => {
            const monthNames: Record<string, string> = {
              "1": "一月",
              "2": "二月",
              "4": "四月",
              "5": "五月",
              "6": "六月",
              "9": "九月",
              "10": "十月",
            };
            const cells: {
              d: number;
              isHoliday: boolean;
              isWorkday: boolean;
              holidayName?: string;
              workdayName?: string;
            }[] = [];
            for (let i = 0; i < startDow; i++)
              cells.push({ d: 0, isHoliday: false, isWorkday: false });
            for (let d = 1; d <= days; d++) {
              const hn = getHolidayName(month, d);
              const wn = getWorkdayName(month, d);
              cells.push({
                d,
                isHoliday: !!hn,
                isWorkday: !!wn,
                holidayName: hn ?? undefined,
                workdayName: wn ?? undefined,
              });
            }
            while (cells.length % 7 !== 0) cells.push({ d: 0, isHoliday: false, isWorkday: false });

            return (
              <div key={month} style={{ flex: "1 1 150px", minWidth: 150 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {monthNames[month]}
                </div>
                <div className="qw-weekdays">
                  {WEEKDAYS.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
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
                          <span className="vis-cal-cell-num" style={{ fontSize: 11.5 }}>
                            {cell.d}
                          </span>
                          {cell.isHoliday && <span className="vis-cal-cell-badge rest">休</span>}
                          {cell.isWorkday && <span className="vis-cal-cell-badge work">班</span>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DemoCard>

      {/* ---- 休假表配置（原 holiday demo） ---- */}
      <DemoCard
        title="休假表配置"
        desc="向 Calendar 组件传入 holidays / workdays JSON 配置即可启用休假标记。"
        full
      >
        <div
          style={{
            background: "var(--qw-code-bg)",
            padding: 16,
            borderRadius: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            lineHeight: 1.7,
            color: "var(--ink-2)",
          }}
        >
          <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>
            // 在日历初始化时传入休假配置
          </span>
          <br />
          <span style={{ color: "var(--teal)" }}>new</span> Calendar(el, {"{"}
          <br />
          {"  "}holidays: {"{"}
          <br />
          {"    "}
          <span style={{ color: "var(--vermilion)" }}>holidays</span>: [
          <span style={{ color: "var(--vermilion)" }}>&quot;2026-10-01&quot;</span>,{" "}
          <span style={{ color: "var(--vermilion)" }}>&quot;2026-10-02&quot;</span>, ...],
          <br />
          {"    "}
          <span style={{ color: "var(--teal)" }}>workdays</span>: [
          <span style={{ color: "var(--teal)" }}>&quot;2026-10-10&quot;</span>, ...],
          <br />
          {"  }"},<br />
          {"}"});
        </div>
      </DemoCard>

      {/* ---- 禁用规则（原 rules demo） ---- */}
      <DemoCard
        title="禁用规则"
        desc="通过 registerRules() 注册禁用规则，与内置插件走同一管线。支持星期、区间、日期范围、自定义函数四种规则类型。"
        full
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {RULES_EXAMPLES.map((r, i) => (
            <button
              key={r.title}
              className={`holiday-toggle${i === activeRule ? " is-on" : ""}`}
              onClick={() => setActiveRule(i)}
              style={
                i === activeRule
                  ? {
                      borderColor: "var(--teal)",
                      color: "var(--teal)",
                      background: "color-mix(in srgb, var(--teal) 10%, transparent)",
                    }
                  : undefined
              }
            >
              {r.title}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
          <DisabledCalendar ruleTitle={RULES_EXAMPLES[activeRule].title} />
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="rule-card" style={{ marginBottom: 8 }}>
              <div className="rule-card-title">规则代码</div>
              <pre className="rule-card-code" style={{ margin: 0 }}>
                <code>
                  {RULES_EXAMPLES[activeRule].code.split("\n").map((line, i) => {
                    const highlighted = line
                      .replace(/"([^"]+)"/g, '<span class="hl-str">"$1"</span>')
                      .replace(
                        /\b(registerRules|type|values|start|end|date|fn|dayOfWeek|range|before|after|custom)\b/g,
                        '<span class="hl-fn">$1</span>',
                      )
                      .replace(/\b([0-9]+)\b/g, '<span class="hl-num">$1</span>');
                    return (
                      <span key={i} dangerouslySetInnerHTML={{ __html: highlighted + "\n" }} />
                    );
                  })}
                </code>
              </pre>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
              {RULES_EXAMPLES[activeRule].desc}
            </div>
          </div>
        </div>
      </DemoCard>

      {/* ---- 规则类型一览（原 rules demo） ---- */}
      <DemoCard
        title="支持的规则类型"
        desc="四种内置规则类型覆盖常见禁用场景，同时支持自定义函数实现复杂逻辑。"
        full
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {[
            { type: "dayOfWeek", desc: "按星期禁用（0=周日，6=周六）", example: "values: [0, 6]" },
            {
              type: "range",
              desc: "日期区间禁用（含起止日）",
              example: 'start: "2026-10-01", end: "2026-10-08"',
            },
            {
              type: "before / after",
              desc: "某日期之前/之后全部禁用",
              example: 'date: "2026-01-01"',
            },
            {
              type: "custom",
              desc: "自定义函数，接收 dayMeta 返回 boolean",
              example: "fn: (dayMeta) => boolean",
            },
          ].map((r) => (
            <div key={r.type} className="rule-card">
              <div className="rule-card-title">{r.type}</div>
              <div
                style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 6 }}
              >
                {r.desc}
              </div>
              <code
                style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
              >
                {r.example}
              </code>
            </div>
          ))}
        </div>
      </DemoCard>
    </div>
  );
}
