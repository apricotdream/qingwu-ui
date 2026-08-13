"use client";

import { TagInput } from "@qingwu-ui/tag-input";
import { useEffect, useRef, useState } from "react";
import "@qingwu-ui/tag-input/style.css";
import DemoCard from "@/components/DemoCard";
import { COMPONENT_SECTIONS } from "@/docs.config";

/* ============================================================
   API 属性表（数据源：docs.config.ts → tag-input.api）
   ============================================================ */

const TAG_INPUT_API =
  COMPONENT_SECTIONS.find((s) => s.id === "basic")?.pages.find((p) => p.href === "/demo/tag-input")
    ?.api ?? [];

/* ============================================================
   TagInput 标签快捷插入演示页面
   范式：单个 full DemoCard + 内部 section（与 Toast 页一致）
   ============================================================ */

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

/* ── 1. 基础用法 ── */
function BasicSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    const ti = new TagInput(ref.current, {
      defaultTags: ["React", "TypeScript", "CSS", "无障碍", "零依赖"],
      onChange: (v) => setLog((p) => [...p.slice(-19), `输入值 → ${v || "（空）"}`]),
      onTagsChange: (t) =>
        setLog((p) => [...p.slice(-19), `快捷标签 → ${t.join(", ") || "（空）"}`]),
      placeholder: "输入标签，逗号分隔…",
    });
    return () => ti.destroy();
  }, []);

  return (
    <section>
      <div className="tag-input-section-title">基础用法</div>
      <div className="qti-demo-basic">
        <div ref={ref} />
        <div className="cal-log-panel" style={{ maxWidth: "100%" }}>
          <div className="cal-log-list">
            {log.length === 0 ? (
              <div className="cal-log-empty">点击标签、移除标签或手动输入，操作将记录在此</div>
            ) : (
              log.map((msg, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 追加型操作日志，索引即可作稳定 key
                <div key={i} className="cal-log-item">
                  {msg}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 2. 受控模式 ── */
function ControlledSection() {
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
    <section>
      <div className="tag-input-section-title">受控模式</div>
      <div className="qti-demo-basic">
        <div ref={ref} />
        <div className="qti-demo-state">
          输入值：<code>{value || "（空）"}</code> · 可用标签：
          <code>{tags.join(", ") || "（空）"}</code>
        </div>
      </div>
    </section>
  );
}

/* ── 3. 自定义格式 ── */
function FormatSection() {
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

  return (
    <section>
      <div className="tag-input-section-title">自定义格式</div>
      <div className="qti-demo-basic">
        <div ref={ref} />
      </div>
    </section>
  );
}

/* ── 4. 展开 / 收起（text-layout） ── */
function CollapseSection() {
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

  return (
    <section>
      <div className="tag-input-section-title">展开 / 收起 · @qingwu-ui/text-layout</div>
      <div className="qti-demo-basic">
        <div ref={ref} />
      </div>
    </section>
  );
}

/* ── 5. chip-in-input 模式 ── */
function InlineSection() {
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
    <section>
      <div className="tag-input-section-title">chip-in-input 模式</div>
      <div className="qti-demo-basic">
        <div ref={ref} />
        <div className="qti-demo-state">
          已选：<code>{selected.join(", ") || "（空）"}</code> · 已选以 chip 内嵌输入框， ×
          删除即移除；草稿经 <code>Enter</code> / 逗号 / 失焦提交（<code>maxTags: 5</code>
          上限，超出保留草稿）；下方快捷栏为可用标签建议
        </div>
      </div>
    </section>
  );
}

/* ── 6. 回车创建标签 ── */
function EnterCreateSection() {
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
    <section>
      <div className="tag-input-section-title">回车创建标签</div>
      <div className="qti-demo-basic">
        <div ref={ref} />
        <div className="qti-demo-state">
          在输入框输入文本并按 <code>Enter</code>，即作为新标签加入快捷栏（已存在则忽略并清空输入）
        </div>
      </div>
    </section>
  );
}

export default function TagInputPage() {
  const react = [
    'import { TagInput } from "@qingwu-ui/tag-input";',
    'import "@qingwu-ui/tag-input/style.css";',
    "",
    "// 基础用法：点击标签填入输入框（逗号分隔），",
    "// 已插入的标签从快捷栏消失，删除后重现",
    "const ti = new TagInput(el, {",
    '  defaultTags: ["React", "TypeScript", "CSS"],',
    "  onChange: (v) => save(v),",
    "});",
    "",
    "// 受控模式",
    "const ti2 = new TagInput(el2, {",
    "  value, tags, // 受控",
    "  onChange: (v) => { value = v; ti2.update({ value }); },",
    "  onTagsChange: (t) => { tags = t; ti2.update({ tags }); },",
    "});",
    "",
    "// 自定义格式：插入 # 前缀，parseTags 同步解析",
    "const ti3 = new TagInput(el3, {",
    '  formatInsert: (tag) => "#" + tag,',
    '  parseTags: (v) => v.split(",").map((s) => s.trim().replace(/^#/, "")),',
    "});",
    "",
    "// 展开 / 收起：maxRows 限制标签栏行数（layoutChips 计算）",
    "const ti4 = new TagInput(el4, { defaultTags: MANY_TAGS, maxRows: 1 });",
    "",
    "// 回车创建：输入文本按 Enter 加入快捷栏",
    "const ti5 = new TagInput(el5, {",
    '  defaultTags: ["前端"],',
    "  allowEnterCreate: true,",
    "  onTagsChange: (t) => save(t),",
    "});",
    "",
    "// 实例 API",
    'ti.insertTag("Vue");    // 程序化插入',
    'ti.removeTag("React");  // 从快捷栏移除',
    'ti.createTag("Svelte"); // 程序化创建新标签',
    "ti.destroy();            // 销毁",
  ].join("\n");

  const html = [
    '<script type="module">',
    '  import { TagInput } from "https://unpkg.com/@qingwu-ui/tag-input";',
    '  new TagInput(document.querySelector("#app"), {',
    '    defaultTags: ["React", "Vue"],',
    "  });",
    "</script>",
    '<link rel="stylesheet" href="https://unpkg.com/@qingwu-ui/tag-input/style.css" />',
  ].join("\n");

  const vue = [
    '<script setup lang="ts">',
    'import { onMounted, onBeforeUnmount, ref } from "vue";',
    'import { TagInput } from "@qingwu-ui/tag-input";',
    'import "@qingwu-ui/tag-input/style.css";',
    "",
    "const el = ref();",
    "let ti: TagInput;",
    'onMounted(() => { ti = new TagInput(el.value, { defaultTags: ["Vue", "Nuxt"] }); });',
    "onBeforeUnmount(() => ti.destroy());",
    "</script>",
    '<template><div ref="el" /></template>',
  ].join("\n");

  return (
    <div className="demo-grid">
      <DemoCard
        title="TagInput 标签快捷插入"
        desc="输入框 + 标签快捷栏：点击标签自动填入输入框，已插入的标签自动隐藏，删除后重现；text-layout 驱动展开/收起；零依赖 · 纯 TypeScript · 全键盘可用"
        full
        snippets={{ react, html, vue }}
      >
        <div className="tag-input-demo">
          <BasicSection />
          <ControlledSection />
          <FormatSection />
          <CollapseSection />
          <InlineSection />
          <EnterCreateSection />
        </div>
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
