"use client";

import { useState } from "react";

/* 规则示例 */
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

/* 可视化被禁用的日期 */
function DisabledCalendar({
  ruleTitle,
}: {
  ruleTitle: string;
}) {
  const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

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
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
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
              background: cell.disabled ? "color-mix(in srgb, var(--line) 40%, transparent)" : undefined,
              textDecoration: cell.disabled ? "line-through" : undefined,
            }}
          >
            {cell.d > 0 && <span className="vis-cal-cell-num" style={{ fontSize: 11, color: cell.disabled ? "var(--ink-3)" : undefined }}>{cell.d}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RulesPage() {
  const [activeRule, setActiveRule] = useState(0);

  const rule = RULES_EXAMPLES[activeRule];

  return (
    <>
      <section className="page-hero">
        <h1>规则引擎</h1>
        <p>通过 <code style={{ background: "var(--qw-code-bg)", padding: "2px 6px", borderRadius: 4, fontSize: "0.9em" }}>registerRules()</code> 注册禁用规则，与内置插件走同一管线。支持星期、区间、日期范围、自定义函数四种规则类型。</p>
      </section>

      <div className="demo-grid">
        {/* 规则选择器 */}
        <div className="demo-card is-full">
          <div className="demo-card-header">
            <h4>规则类型</h4>
            <p>选择不同规则类型查看效果。下方日历网格展示被禁用的日期（浅色+删除线）。</p>
          </div>
          <div className="demo-card-stage">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {RULES_EXAMPLES.map((r, i) => (
                <button
                  key={r.title}
                  className={`holiday-toggle${i === activeRule ? " is-on" : ""}`}
                  onClick={() => setActiveRule(i)}
                  style={i === activeRule
                    ? { borderColor: "var(--teal)", color: "var(--teal)", background: "color-mix(in srgb, var(--teal) 10%, transparent)" }
                    : undefined}
                >
                  {r.title}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
              {/* 可视化日历 */}
              <DisabledCalendar ruleTitle={rule.title} />

              {/* 代码 */}
              <div style={{ flex: 1, minWidth: 280 }}>
                <div className="rule-card" style={{ marginBottom: 8 }}>
                  <div className="rule-card-title">规则代码</div>
                  <pre className="rule-card-code" style={{ margin: 0 }}>
                    <code>
                      {rule.code.split("\n").map((line, i) => {
                        const highlighted = line
                          .replace(/"([^"]+)"/g, '<span class="hl-str">"$1"</span>')
                          .replace(/\b(registerRules|type|values|start|end|date|fn|dayOfWeek|range|before|after|custom)\b/g, '<span class="hl-fn">$1</span>')
                          .replace(/\b([0-9]+)\b/g, '<span class="hl-num">$1</span>');
                        return <span key={i} dangerouslySetInnerHTML={{ __html: highlighted + "\n" }} />;
                      })}
                    </code>
                  </pre>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
                  {rule.desc}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* API 说明 */}
        <div className="demo-card is-full">
          <div className="demo-card-header">
            <h4>支持的规则类型</h4>
            <p>四种内置规则类型覆盖常见禁用场景，同时支持自定义函数实现复杂逻辑。</p>
          </div>
          <div className="demo-card-stage">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {[
                { type: "dayOfWeek", desc: "按星期禁用（0=周日，6=周六）", example: "values: [0, 6]" },
                { type: "range", desc: "日期区间禁用（含起止日）", example: 'start: "2026-10-01", end: "2026-10-08"' },
                { type: "before / after", desc: "某日期之前/之后全部禁用", example: 'date: "2026-01-01"' },
                { type: "custom", desc: "自定义函数，接收 dayMeta 返回 boolean", example: "fn: (dayMeta) => boolean" },
              ].map((r) => (
                <div key={r.type} className="rule-card">
                  <div className="rule-card-title">{r.type}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 6 }}>{r.desc}</div>
                  <code style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>{r.example}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
