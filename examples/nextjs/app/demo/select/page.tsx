"use client";

import type { SelectOption, SelectOptions } from "@qingwu/select";
import { Select } from "@qingwu/select";
import "@qingwu/select/style.css";
import "@qingwu/button/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";

/* ---- 演示数据：框架阵营 ---- */
const FRAMEWORKS: SelectOption[] = [
  { value: "react", label: "React", hint: "框架无关 · 原生 DOM 渲染", glyph: "R" },
  { value: "vue", label: "Vue", hint: "new Select(el, opts) 即用", glyph: "V" },
  { value: "svelte", label: "Svelte", hint: "同一份 JS 无需包装", glyph: "S" },
  { value: "solid", label: "Solid", hint: "零依赖 · 零样板", glyph: "S" },
  { value: "angular", label: "Angular", hint: "指令里挂载即可", glyph: "A" },
  { value: "vanilla", label: "原生 JS", hint: "npm 包直连", glyph: "JS" },
  { value: "qwik", label: "Qwik", hint: "按需实例化", glyph: "Q" },
  { value: "preact", label: "Preact", hint: "兼容 React 心智", glyph: "P" },
  { value: "lit", label: "Lit", hint: "即将支持", disabled: true, glyph: "L" },
  { value: "ember", label: "Ember", hint: "即将支持", disabled: true, glyph: "E" },
];

/* ---- 受控演示数据：城市 ---- */
const CITIES: SelectOption[] = [
  { value: "beijing", label: "北京", hint: "华北 · 首都" },
  { value: "shanghai", label: "上海", hint: "华东 · 经济中心" },
  { value: "guangzhou", label: "广州", hint: "华南 · 千年商都" },
  { value: "chengdu", label: "成都", hint: "西南 · 天府之国" },
  { value: "hangzhou", label: "杭州", hint: "华东 · 数字之城" },
  { value: "shenzhen", label: "深圳", hint: "华南 · 科技之都" },
  { value: "nanjing", label: "南京", hint: "华东 · 六朝古都" },
  { value: "wuhan", label: "武汉", hint: "华中 · 九省通衢" },
];

/* ---- 静态对比卡 ---- */
function StaticSelect({ options, ...opts }: { options: SelectOption[] } & Partial<SelectOptions>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const sel = new Select(ref.current, { options, ...opts });
    return () => sel.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} />;
}

/* ---- props 面板字段 ---- */
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "select" | "boolean";
  defaultValue: string;
  options?: { label: string; value: string }[];
}

const FIELDS: FieldDef[] = [
  { key: "placeholder", label: "占位文本", type: "text", defaultValue: "选择框架" },
  {
    key: "width",
    label: "面板宽度",
    type: "select",
    defaultValue: "trigger",
    options: [
      { label: "跟随触发器", value: "trigger" },
      { label: "内容自适应", value: "auto" },
    ],
  },
  {
    key: "animate",
    label: "手风琴动画",
    type: "boolean",
    defaultValue: "true",
    options: [
      { label: "开启", value: "true" },
      { label: "关闭", value: "false" },
    ],
  },
  {
    key: "stagger",
    label: "错峰间隔 ms",
    type: "select",
    defaultValue: "28",
    options: [
      { label: "28ms（密）", value: "28" },
      { label: "48ms（缓）", value: "48" },
      { label: "72ms（疏）", value: "72" },
    ],
  },
  {
    key: "disabled",
    label: "整体禁用",
    type: "boolean",
    defaultValue: "false",
    options: [
      { label: "否", value: "false" },
      { label: "是", value: "true" },
    ],
  },
  {
    key: "controlledValue",
    label: "受控 value",
    type: "select",
    defaultValue: "none",
    options: [
      { label: "（非受控）", value: "none" },
      ...FRAMEWORKS.filter((f) => !f.disabled).map((f) => ({ label: f.label, value: f.value })),
    ],
  },
];

export default function SelectPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<Select | null>(null);

  const [props, setProps] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.defaultValue])),
  );

  const [log, setLog] = useState<string[]>([]);
  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const renderSelect = useCallback(
    (currentProps: Record<string, string>) => {
      const el = rootRef.current;
      if (!el) return;

      if (selRef.current) {
        selRef.current.destroy();
        selRef.current = null;
      }
      el.textContent = "";

      const opts: Record<string, unknown> = {
        options: FRAMEWORKS,
        width: currentProps.width === "auto" ? "auto" : "trigger",
        animate: currentProps.animate === "true",
        stagger: Number(currentProps.stagger) || 28,
        disabled: currentProps.disabled === "true",
      };
      const ph = currentProps.placeholder?.trim();
      if (ph) opts.placeholder = ph;

      if (currentProps.controlledValue !== "none") {
        opts.value = currentProps.controlledValue;
        addLog(`受控 value 初始化：${currentProps.controlledValue}`);
      }

      opts.onOpenChange = (open: boolean) => addLog(`展开状态：${open ? "开" : "关"}`);
      opts.onChange = (value: string | null, option: SelectOption | null) =>
        addLog(`选中「${option?.label ?? "（取消）"}」= ${value}`);

      selRef.current = new Select(el, opts);
      addLog(
        `Select 渲染完成（${currentProps.width === "auto" ? "内容自适应" : "跟随触发器"}宽度）`,
      );
    },
    [addLog],
  );

  useEffect(() => {
    renderSelect(props);
    return () => {
      if (selRef.current) selRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = () => {
    renderSelect(props);
  };

  /* 受控 value 变更：直接同步到已挂载实例，不重建 */
  const handleControlledValue = (v: string) => {
    setProps((p) => ({ ...p, controlledValue: v }));
    selRef.current?.update({ value: v === "none" ? null : v });
    addLog(v === "none" ? "切换到非受控模式" : `外部 update({ value: "${v}" })`);
  };

  /* 构建公共 opts 配置行 */
  const buildOptsLines = () => {
    const lines: string[] = [];
    const ph = props.placeholder?.trim();
    if (ph) lines.push(`  placeholder: "${ph}",`);
    lines.push("  options: FRAMEWORKS,");
    if (props.width === "auto") lines.push('  width: "auto",');
    if (props.animate === "false") lines.push("  animate: false,");
    const st = Number(props.stagger) || 28;
    if (st !== 28) lines.push(`  stagger: ${st},`);
    if (props.disabled === "true") lines.push("  disabled: true,");
    if (props.controlledValue !== "none") lines.push(`  value: "${props.controlledValue}",`);
    return lines;
  };

  const snippets = (() => {
    const optsLines = buildOptsLines();
    const optsBlock = ["{", ...optsLines, "}"].join("\n    ");

    const react = [
      'import { Select } from "@qingwu/select";',
      'import "@qingwu/select/style.css";',
      "",
      "const FRAMEWORKS = [",
      '  { value: "react", label: "React", hint: "框架无关" },',
      '  { value: "ember", label: "Ember", disabled: true },',
      "];",
      "",
      "function FrameworkPicker() {",
      "  const rootRef = useRef<HTMLDivElement>(null);",
      "  const selRef = useRef<Select | null>(null);",
      "",
      "  useEffect(() => {",
      "    const el = rootRef.current;",
      "    if (!el) return;",
      `    selRef.current = new Select(el, ${optsBlock});`,
      "    return () => selRef.current?.destroy();",
      "  }, []);",
      "",
      "  return <div ref={rootRef} />;",
      "}",
    ].join("\n");

    const html = [
      "<!DOCTYPE html>",
      '<html lang="zh-CN">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <link rel="stylesheet" href="https://unpkg.com/@qingwu/select/style.css" />',
      "</head>",
      "<body>",
      '  <div id="root"></div>',
      '  <script type="module">',
      '    import { Select } from "https://unpkg.com/@qingwu/select";',
      `    const sel = new Select(document.querySelector("#root"), ${optsBlock});`,
      "  </script>",
      "</body>",
      "</html>",
    ].join("\n");

    const vue = [
      "<template>",
      '  <div ref="rootRef"></div>',
      "</template>",
      "",
      '<script setup lang="ts">',
      'import { ref, onMounted, onUnmounted } from "vue";',
      'import { Select } from "@qingwu/select";',
      'import "@qingwu/select/style.css";',
      "",
      "const rootRef = ref<HTMLDivElement>();",
      "let sel: Select | null = null;",
      "",
      "onMounted(() => {",
      "  if (!rootRef.value) return;",
      `  sel = new Select(rootRef.value, ${optsBlock});`,
      "});",
      "",
      "onUnmounted(() => sel?.destroy());",
      "</script>",
    ].join("\n");

    return { react, html, vue };
  })();

  return (
    <div className="demo-grid">
      {/* 交互实验台 */}
      <DemoCard
        title="Select 下拉选择器"
        desc="手风琴错峰动画：选项像琴键逐项按下，向上展开反向级联；单选、选项禁用、受控/非受控双模式。点开试试。"
        full
        snippets={snippets}
      >
        {/* props 面板 */}
        <div className="cal-props-panel">
          <div className="cal-props-grid">
            {FIELDS.map((field) => (
              <label key={field.key} className="cal-props-field">
                <span className="cal-props-label">{field.label}</span>
                {field.key === "controlledValue" ? (
                  <select
                    className="cal-props-input"
                    value={props[field.key]}
                    onChange={(e) => handleControlledValue(e.target.value)}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "boolean" ? (
                  <select
                    className="cal-props-input"
                    value={props[field.key]}
                    onChange={(e) => setProps((p) => ({ ...p, [field.key]: e.target.value }))}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="cal-props-input"
                    type={field.type === "text" ? "text" : field.type}
                    value={props[field.key]}
                    onChange={(e) => setProps((p) => ({ ...p, [field.key]: e.target.value }))}
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

        {/* 挂载点 + 日志 */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ width: 320, maxWidth: "100%" }} ref={rootRef} />
          <div className="cal-log-panel">
            <div className="cal-log-title">操作日志</div>
            <div className="cal-log-list">
              {log.length === 0 ? (
                <div className="cal-log-empty">暂无日志，操作下拉后将在此显示</div>
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

      {/* 状态对比 */}
      <DemoCard title="基础单选" desc="无默认值，显示占位符；点开面板逐项琴键落下。">
        <StaticSelect options={FRAMEWORKS} placeholder="选择框架" />
      </DemoCard>

      <DemoCard title="默认选中 + 辅助说明" desc="defaultValue 预选，hint 展示副文本。">
        <StaticSelect
          options={FRAMEWORKS}
          placeholder="选择框架"
          defaultValue="react"
          width="auto"
        />
      </DemoCard>

      <DemoCard title="选项禁用" desc="Lit / Ember 置灰不可选，键盘导航自动跳过。">
        <StaticSelect options={FRAMEWORKS} placeholder="选择框架" defaultValue="vue" />
      </DemoCard>

      <DemoCard title="整体禁用" desc="disabled: true，触发器置灰不可点。">
        <StaticSelect options={FRAMEWORKS} placeholder="选择框架" disabled />
      </DemoCard>

      <DemoCard title="受控模式" desc="value 由外部驱动，用户选择仅回调；配合按钮重设。">
        <ControlledDemo />
      </DemoCard>

      <DemoCard title="贴近底部 · 向上翻转" desc="触发器贴视口底边时，面板向上弹且琴键反向级联。">
        <div
          style={{
            minHeight: 420,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <StaticSelect options={CITIES} placeholder="选择城市" defaultValue="beijing" />
        </div>
      </DemoCard>
    </div>
  );
}

/* ---- 受控模式演示卡 ---- */
function ControlledDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const selRef = useRef<Select | null>(null);
  const [current, setCurrent] = useState("beijing");

  useEffect(() => {
    if (!ref.current) return;
    selRef.current = new Select(ref.current, {
      options: CITIES,
      placeholder: "选择城市",
      value: current,
      onChange: (v) => {
        setCurrent(v ?? "");
      },
    });
    return () => selRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (v: string) => {
    setCurrent(v);
    selRef.current?.update({ value: v });
  };

  return (
    <div>
      <div ref={ref} style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["beijing", "shanghai", "hangzhou", "chengdu"].map((v) => (
          <button
            key={v}
            type="button"
            className="qw-btn"
            onClick={() => pick(v)}
            style={
              current === v ? { outline: "2px solid var(--teal)", outlineOffset: 2 } : undefined
            }
          >
            {CITIES.find((c) => c.value === v)?.label}
          </button>
        ))}
      </div>
    </div>
  );
}
