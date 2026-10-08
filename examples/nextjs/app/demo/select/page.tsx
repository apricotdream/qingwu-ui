"use client";

import { Select, type SelectOptions } from "@qingwu-ui/select";
import "@qingwu-ui/select/style.css";
import "@qingwu-ui/button/style.css";
import { useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { CITIES, FRAMEWORKS } from "./data";
import { SELECT_FIELDS, createSelect, selectToCode } from "./playground.config";

/* ---- 静态卡通用挂载 ---- */
function StaticSelect({ options, ...opts }: { options: SelectOptions["options"] } & Partial<SelectOptions>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const sel = new Select(ref.current, { options, ...opts });
    return () => sel.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} />;
}

/* ---- 场景卡代码：手写实例化语句，框架外壳由 codegen 统一产出 ---- */
const snippet = (stmt: string) => genAll({ meta: PKG.select, symbol: "Select", stmt });

export default function SelectPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="Select 下拉选择器"
        desc="手风琴错峰动画：选项像琴键逐项按下，向上展开反向级联；单选、选项禁用、受控/非受控双模式。调整属性后点「应用」。"
        fields={SELECT_FIELDS}
        create={createSelect}
        toCode={selectToCode}
        log
      />

      <DemoCard
        title="基础单选"
        desc="无默认值，显示占位符；点开面板逐项琴键落下。"
        snippets={snippet(`const sel = new Select(el, {
  options: FRAMEWORKS,
  placeholder: "选择框架"
});`)}
      >
        <StaticSelect options={FRAMEWORKS} placeholder="选择框架" />
      </DemoCard>

      <DemoCard
        title="默认选中 + 辅助说明"
        desc="defaultValue 预选，hint 展示副文本，面板宽度自适应内容。"
        snippets={snippet(`const sel = new Select(el, {
  options: FRAMEWORKS,
  placeholder: "选择框架",
  defaultValue: "react",
  width: "auto"
});`)}
      >
        <StaticSelect options={FRAMEWORKS} placeholder="选择框架" defaultValue="react" width="auto" />
      </DemoCard>

      <DemoCard
        title="选项禁用"
        desc="Lit / Ember 置灰不可选，键盘导航自动跳过。"
        snippets={snippet(`// 数据项中 disabled: true 即禁用该选项
const sel = new Select(el, {
  options: FRAMEWORKS,
  placeholder: "选择框架",
  defaultValue: "vue"
});`)}
      >
        <StaticSelect options={FRAMEWORKS} placeholder="选择框架" defaultValue="vue" />
      </DemoCard>

      <DemoCard
        title="整体禁用"
        desc="disabled: true，触发器置灰不可点。"
        snippets={snippet(`const sel = new Select(el, {
  options: FRAMEWORKS,
  placeholder: "选择框架",
  disabled: true
});`)}
      >
        <StaticSelect options={FRAMEWORKS} placeholder="选择框架" disabled />
      </DemoCard>

      <DemoCard
        title="面板磨砂 vs 不透明"
        desc="frosted 默认开启：半透明底 + backdrop-filter 毛玻璃；false 回退不透明实体面板。"
        snippets={snippet(`// 左：默认磨砂；右：frosted: false
const frosted = new Select(elA, {
  options: FRAMEWORKS,
  placeholder: "磨砂面板（默认）",
  defaultValue: "react"
});
const solid = new Select(elB, {
  options: FRAMEWORKS,
  placeholder: "不透明面板",
  defaultValue: "vue",
  frosted: false
});`)}
      >
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ width: 240 }}>
            <StaticSelect options={FRAMEWORKS} placeholder="磨砂面板（默认）" defaultValue="react" />
          </div>
          <div style={{ width: 240 }}>
            <StaticSelect options={FRAMEWORKS} placeholder="不透明面板" defaultValue="vue" frosted={false} />
          </div>
        </div>
      </DemoCard>

      <DemoCard
        title="受控模式"
        desc="value 由外部驱动，用户选择仅触发 onChange；配合外部按钮调 update 重设。"
        snippets={snippet(`const sel = new Select(el, {
  options: CITIES,
  placeholder: "选择城市",
  value: current,                 // 外部状态
  onChange: (v) => setCurrent(v ?? "")
});

// 外部按钮点击：
sel.update({ value: "shanghai" });`)}
      >
        <ControlledDemo />
      </DemoCard>

      <DemoCard
        title="悬停自动关闭"
        desc="hoverCloseDelay：鼠标从触发器与面板同时移出 1.5 秒后自动关闭；重新移入取消。默认 3000ms，0 关闭。"
        snippets={snippet(`const sel = new Select(el, {
  options: FRAMEWORKS,
  placeholder: "移出后 1.5s 关闭",
  hoverCloseDelay: 1500
});`)}
      >
        <StaticSelect options={FRAMEWORKS} placeholder="移出后 1.5s 关闭" hoverCloseDelay={1500} />
      </DemoCard>

      <DemoCard
        title="活动项高亮"
        desc="activeIndex：外部指定活动项索引（第 3 项），标签呈现黛青高亮，区别于选中态。"
        snippets={snippet(`const sel = new Select(el, {
  options: FRAMEWORKS,
  placeholder: "选择框架",
  activeIndex: 2
});`)}
      >
        <StaticSelect options={FRAMEWORKS} placeholder="选择框架" activeIndex={2} />
      </DemoCard>

      <DemoCard
        title="贴近底部 · 向上翻转"
        desc="触发器贴视口底边时，面板向上弹且琴键反向级联。"
        snippets={snippet(`const sel = new Select(el, {
  options: CITIES,
  placeholder: "选择城市",
  defaultValue: "beijing"
});`)}
      >
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
      onChange: (v) => setCurrent(v ?? ""),
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
            style={current === v ? { outline: "2px solid var(--teal)", outlineOffset: 2 } : undefined}
          >
            {CITIES.find((c) => c.value === v)?.label}
          </button>
        ))}
      </div>
    </div>
  );
}
