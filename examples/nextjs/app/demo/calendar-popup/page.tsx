"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Calendar } from "@qingwu/calendar";
import "@qingwu/button/style.css";
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
        setTimeout(() => { syncing.current = false; }, 0);
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
    defaultValue: JSON.stringify({
      holidays: ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"],
      workdays: ["2026-10-10", "2026-10-11"],
    }, null, 2),
  },
];

/* ============================================================ */

export default function CalendarPopupPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const calRef = useRef<Calendar | null>(null);

  const [props, setProps] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.defaultValue]))
  );

  const [log, setLog] = useState<string[]>([]);
  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

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
      } catch { /* JSON 格式错误，忽略 */ }
      opts.onChange = (date: string) => addLog(`onChange → ${date}`);
      opts.onOpenChange = (open: boolean) => addLog(`面板 ${open ? "打开" : "关闭"}`);

      calRef.current = new Calendar(el, opts);
      const count = Object.keys(opts).filter((k) => k !== "onChange" && k !== "onOpenChange").length;
      addLog(`日历渲染完成（${count} 项配置）`);
    },
    [addLog]
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
    if (props.placeholder && props.placeholder !== "点击选择日期") lines.push(`  placeholder: "${props.placeholder}",`);
    if (props.selected) lines.push(`  selected: "${props.selected}",`);
    if (props.min) lines.push(`  min: "${props.min}",`);
    if (props.max) lines.push(`  max: "${props.max}",`);
    if (props.inputName) lines.push(`  inputName: "${props.inputName}",`);
    if (props.showDetailPanel === "true") lines.push("  showDetailPanel: true,    // 开启右侧详情面板");
    try {
      const h = JSON.parse(props.holidays || "{}");
      if (h.holidays || h.workdays) {
        lines.push("  holidays: {");
        if (h.holidays?.length) lines.push(`    holidays: ${JSON.stringify(h.holidays)},`);
        if (h.workdays?.length) lines.push("    workdays: " + JSON.stringify(h.workdays) + ",");
        lines.push("  },");
      }
    } catch { /* ignore */ }
    return lines;
  };

  /* React / HTML / Vue 三格式代码 */
  const snippets = (() => {
    const optsLines = buildOptsLines();

    const react = [
      'import { Calendar } from "@qingwu/calendar";',
      'import "@qingwu/calendar/style.css";',
      "",
      "function CalendarPicker() {",
      '  const rootRef = useRef<HTMLDivElement>(null);',
      "  const calRef = useRef<Calendar | null>(null);",
      "",
      "  useEffect(() => {",
      "    const el = rootRef.current;",
      "    if (!el) return;",
      `    calRef.current = new Calendar(el, ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines,
      optsLines.length > 0 ? "    });" : "    {});",
      '    return () => calRef.current?.destroy();',
      "  }, []);",
      "",
      '  return <div ref={rootRef} className="qw-cal-root" />;',
      "}",
    ].join("\n");

    const html = [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <script type="module">',
      '    import { Calendar } from "https://unpkg.com/@qingwu/calendar";',
      '  </script>',
      '  <link rel="stylesheet" href="https://unpkg.com/@qingwu/calendar/style.css" />',
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
      'import { Calendar } from "@qingwu/calendar";',
      'import "@qingwu/calendar/style.css";',
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
            <button className="qw-btn qw-btn-primary" type="button" onClick={handleConfirm}>应用配置</button>
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
                  <div key={i} className="cal-log-item">{msg}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </DemoCard>
    </div>
  );
}
