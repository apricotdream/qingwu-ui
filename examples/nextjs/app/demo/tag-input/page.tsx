"use client";

import { TagInput } from "@qingwu-ui/tag-input";
import "@qingwu-ui/tag-input/style.css";
import { useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { COMPONENT_SECTIONS } from "@/docs.config";
import { TAG_INPUT_FIELDS, createTagInput, tagInputToCode } from "./playground.config";

/* ============================================================
   API 属性表（数据源：docs.config.ts → tag-input.api）
   ============================================================ */

const TAG_INPUT_API =
  COMPONENT_SECTIONS.find((s) => s.id === "basic")?.pages.find((p) => p.href === "/demo/tag-input")
    ?.api ?? [];

const MANY_TAGS = [
  "前端",
  "React",
  "TypeScript",
  "CSS",
  "Canvas",
  "无障碍",
  "零依赖",
  "CJK 支持",
  "虚拟滚动",
  "键盘导航",
  "Vue",
  "Svelte",
  "Node.js",
  "Bun",
  "测试",
  "性能",
  "设计系统",
  "国际化",
  "移动端",
  "动画",
];

/* ── 受控模式：value/tags 由外部状态驱动，update 回灌 ── */
function ControlledDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const tiRef = useRef<TagInput | null>(null);
  const [value, setValue] = useState("");
  const [tags, setTags] = useState(["HTML", "CSS", "JavaScript"]);

  /* 构造仅一次（受控初始值），后续由下方 effect 同步 */
  useEffect(() => {
    if (!ref.current) return;
    tiRef.current = new TagInput(ref.current, {
      value: "",
      tags: ["HTML", "CSS", "JavaScript"],
      placeholder: "受控输入…",
      onChange: (v) => setValue(v),
      onTagsChange: (t) => setTags(t),
    });
    return () => {
      tiRef.current?.destroy();
      tiRef.current = null;
    };
  }, []);

  /* 外部状态变化同步回组件 */
  useEffect(() => {
    tiRef.current?.update({ value, tags });
  }, [value, tags]);

  return (
    <div>
      <div ref={ref} />
      <div className="qti-demo-state">
        输入值：<code>{value || "（空）"}</code> · 可用标签：
        <code>{tags.join(", ") || "（空）"}</code>
      </div>
    </div>
  );
}

/* ── 自定义格式：formatInsert 加 # 前缀，parseTags 反向解析 ── */
function FormatDemo() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ti = new TagInput(ref.current, {
      defaultTags: ["前端", "组件库", "开源"],
      placeholder: "输入 #标签，逗号分隔…",
      formatInsert: (tag) => `#${tag}`,
      parseTags: (v) =>
        v
          .split(",")
          .map((s) => s.trim().replace(/^#/, ""))
          .filter(Boolean),
    });
    return () => ti.destroy();
  }, []);

  return <div ref={ref} />;
}

/* ── 展开 / 收起：maxRows:1 + 大量标签 ── */
function CollapseDemo() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ti = new TagInput(ref.current, {
      defaultTags: MANY_TAGS,
      maxRows: 1,
      placeholder: "输入标签，逗号分隔…",
    });
    return () => ti.destroy();
  }, []);

  return <div ref={ref} />;
}

/* ── chip-in-input：inline + selected 受控回灌 ── */
function InlineDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const tiRef = useRef<TagInput | null>(null);
  const [selected, setSelected] = useState(["前端", "组件库"]);

  useEffect(() => {
    if (!ref.current) return;
    tiRef.current = new TagInput(ref.current, {
      selected,
      defaultTags: ["前端", "组件库", "React", "Vue", "Svelte"],
      inline: true,
      maxTags: 5,
      placeholder: "输入标签，回车/逗号添加…",
      onSelectedChange: (s) => setSelected(s),
    });
    return () => {
      tiRef.current?.destroy();
      tiRef.current = null;
    };
  }, []);

  /* 外部状态变化同步回组件 */
  useEffect(() => {
    tiRef.current?.update({ selected });
  }, [selected]);

  return (
    <div>
      <div ref={ref} />
      <div className="qti-demo-state">
        已选：<code>{selected.join(", ") || "（空）"}</code> · 已选以 chip 内嵌输入框，×
        删除即移除；草稿经 <code>Enter</code> / 逗号 / 失焦提交（<code>maxTags: 5</code>
        上限，超出保留草稿）；下方快捷栏为可用标签建议
      </div>
    </div>
  );
}

/* ── 回车创建：allowEnterCreate ── */
function EnterCreateDemo() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ti = new TagInput(ref.current, {
      defaultTags: ["前端", "组件库"],
      allowEnterCreate: true,
      placeholder: "输入新标签名，回车加入快捷栏…",
    });
    return () => ti.destroy();
  }, []);

  return (
    <div>
      <div ref={ref} />
      <div className="qti-demo-state">
        在输入框输入文本并按 <code>Enter</code>，即作为新标签加入快捷栏（已存在则忽略并清空输入）
      </div>
    </div>
  );
}

export default function TagInputPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="TagInput 标签快捷插入"
        desc="输入框 + 标签快捷栏：点击标签自动填入，已插入自动隐藏，删除后重现。调整 inline、回车创建、行数/数量上限等属性后点「应用」。零依赖 · 纯 TypeScript · 全键盘可用。"
        fields={TAG_INPUT_FIELDS}
        create={createTagInput}
        toCode={tagInputToCode}
        log
      />

      <DemoCard
        title="受控模式"
        desc="value 与 tags 均由外部状态驱动：用户操作只触发回调，外部再以 update({ value, tags }) 回灌。"
        full
        snippets={genAll({
          meta: PKG.tagInput,
          symbol: "TagInput",
          stmt: `const ti = new TagInput(el, {
  value: currentValue,
  tags: currentTags,
  placeholder: "受控输入…",
  onChange: (v) => setCurrentValue(v),
  onTagsChange: (t) => setCurrentTags(t)
});

// 外部状态变化后，回灌给组件
ti.update({ value: currentValue, tags: currentTags });`,
        })}
      >
        <ControlledDemo />
      </DemoCard>

      <DemoCard
        title="自定义格式"
        desc="formatInsert 让插入文本带 # 前缀；parseTags 同步把输入值解析回标签，驱动快捷栏显隐。"
        snippets={genAll({
          meta: PKG.tagInput,
          symbol: "TagInput",
          stmt: `const ti = new TagInput(el, {
  defaultTags: ["前端", "组件库", "开源"],
  placeholder: "输入 #标签，逗号分隔…",
  formatInsert: (tag) => "#" + tag,
  parseTags: (v) =>
    v
      .split(",")
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean)
});`,
        })}
      >
        <FormatDemo />
      </DemoCard>

      <DemoCard
        title="展开 / 收起 · @qingwu-ui/text-layout"
        desc="maxRows: 1 时标签栏超出部分折叠为「+N 更多」，点击展开、可再收起。"
        snippets={genAll({
          meta: PKG.tagInput,
          symbol: "TagInput",
          stmt: `const ti = new TagInput(el, {
  defaultTags: MANY_TAGS,
  maxRows: 1
});`,
        })}
      >
        <CollapseDemo />
      </DemoCard>

      <DemoCard
        title="chip-in-input 模式"
        desc="inline: true，已选以 chip 内嵌输入框；selected 受控，外部以 update({ selected }) 回灌，maxTags: 5 封顶。"
        full
        snippets={genAll({
          meta: PKG.tagInput,
          symbol: "TagInput",
          stmt: `const ti = new TagInput(el, {
  selected,
  defaultTags: ["前端", "组件库", "React", "Vue", "Svelte"],
  inline: true,
  maxTags: 5,
  onSelectedChange: (s) => setSelected(s)
});

// 外部已选状态回灌
ti.update({ selected });`,
        })}
      >
        <InlineDemo />
      </DemoCard>

      <DemoCard
        title="回车创建标签"
        desc="allowEnterCreate: true，输入框文本按 Enter 即加入快捷栏，已存在则忽略并清空。"
        snippets={genAll({
          meta: PKG.tagInput,
          symbol: "TagInput",
          stmt: `const ti = new TagInput(el, {
  defaultTags: ["前端", "组件库"],
  allowEnterCreate: true,
  placeholder: "输入新标签名，回车加入快捷栏…"
});`,
        })}
      >
        <EnterCreateDemo />
      </DemoCard>

      {/* API 属性表 */}
      <div className="api-section">
        {TAG_INPUT_API.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <table className="api-table">
              <thead>
                <tr>
                  <th>属性</th>
                  <th>说明</th>
                  <th>类型</th>
                  <th>默认值</th>
                </tr>
              </thead>
              <tbody>
                {group.props.map((p) => (
                  <tr key={p.name}>
                    <td>
                      <code>{p.name}</code>
                    </td>
                    <td>{p.desc}</td>
                    <td>
                      <code>{p.type}</code>
                    </td>
                    <td>
                      <code>{p.default}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
