"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeColumnWidths,
  computeVirtualHeights,
  findVisibleRange,
  layout,
  layoutChips,
  measure,
  prepare,
  truncateToLines,
} from "@qingwu/text-layout";
import type { ChipItem } from "@qingwu/text-layout";
import DemoCard from "@/components/DemoCard";

const FONT = "15px system-ui, -apple-system, sans-serif";

/* ── 中英文混合示例文本 ── */
const DEMO_TEXTS = [
  "The quick brown fox jumps over the lazy dog. A journey of a thousand miles begins with a single step.",
  "青梧UI 是一套面向 AI 时代的前端工具库，涵盖按钮、日历、搜索、上传、编辑器等核心组件，全部零框架依赖，纯 DOM + CSS 实现。",
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.",
  "🎉 Pretext is 300-600x faster than DOM-based text measurement! It supports CJK 中日韩文字, emoji 😀🎨🚀, bidirectional text, and more.",
  "春江潮水连海平，海上明月共潮生。滟滟随波千万里，何处春江无月明。江流宛转绕芳甸，月照花林皆似霰。",
  "Breaking: AI-powered text layout engine achieves sub-millisecond line-breaking for real-time Canvas rendering at 60fps.",
  "TypeScript 7.0 正式发布，带来了全新的类型系统改进和编译性能优化，开发者社区反响热烈。",
  "Short text.",
];

/* ── 1. 虚拟滚动 ── */
function VirtualScrollDemo() {
  const [items] = useState(() =>
    Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      text: `${DEMO_TEXTS[i % DEMO_TEXTS.length]!} (#${i + 1})`,
    })),
  );
  const [containerWidth, setContainerWidth] = useState(400);

  const { heights, offsets, totalHeight } = useMemo(
    () => computeVirtualHeights(items, containerWidth, 24, FONT, 16),
    [items, containerWidth],
  );

  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeight = 400;

  const [startIdx, endIdx] = findVisibleRange(offsets, scrollTop, viewportHeight, 5);
  const visibleItems = items.slice(startIdx, endIdx);

  // 性能对比
  const [domTime, setDomTime] = useState<number | null>(null);
  const [pretextTime, setPretextTime] = useState<number | null>(null);

  const runBenchmark = () => {
    // Pretext 方案
    const t0 = performance.now();
    computeVirtualHeights(items.slice(0, 100), containerWidth, 24, FONT, 16);
    setPretextTime(performance.now() - t0);

    // DOM 方案（粗略模拟）
    const t1 = performance.now();
    const div = document.createElement("div");
    div.style.cssText = `position:absolute;visibility:hidden;width:${containerWidth}px;font:${FONT};line-height:24px`;
    for (let i = 0; i < Math.min(100, items.length); i++) {
      div.textContent = items[i]!.text;
      document.body.appendChild(div);
      void div.offsetHeight; // 强制回流
      document.body.removeChild(div);
    }
    setDomTime(performance.now() - t1);
  };

  return (
    <DemoCard
      title="虚拟滚动高度预计算"
      desc={`1000 项不等高列表，总高 ${Math.round(totalHeight).toLocaleString()}px。Pretext 方案 O(1) 查找可见范围，无需 DOM 测量。拖动下方滚动条查看效果。`}
      code={`import { computeVirtualHeights, findVisibleRange } from "@qingwu/text-layout";

// 1. 批量预计算高度（与数据加载并行）
const { heights, offsets, totalHeight } = computeVirtualHeights(
  items, containerWidth, 24, "15px system-ui", 16
);

// 2. 二分查找可见范围（O(log n)）
const [start, end] = findVisibleRange(offsets, scrollTop, 400, 5);`}
    >
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ marginBottom: 8 }}>
            <label>
              容器宽度: {containerWidth}px{" "}
              <input
                type="range"
                min={200}
                max={600}
                value={containerWidth}
                onChange={(e) => setContainerWidth(Number(e.target.value))}
              />
            </label>
          </div>
          <div
            style={{
              width: containerWidth,
              height: viewportHeight,
              overflowY: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#f9fafb",
            }}
            onScroll={(e) => setScrollTop((e.target as HTMLElement).scrollTop)}
          >
            <div style={{ height: totalHeight, position: "relative" }}>
              {visibleItems.map((item) => {
                const offset = offsets[items.indexOf(item)] ?? 0;
                const h = heights.get(item.id) ?? 24;
                return (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      top: offset,
                      left: 0,
                      width: "100%",
                      height: h,
                      padding: "4px 12px",
                      font,
                      lineHeight: "24px",
                      borderBottom: "1px solid #eee",
                      boxSizing: "border-box",
                      fontSize: 14,
                    }}
                  >
                    {item.text}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
            可见范围: [{startIdx}, {endIdx}) · 渲染 {visibleItems.length} 项 · 总 {items.length} 项
          </div>
        </div>

        <div>
          <button
            onClick={runBenchmark}
            style={{
              padding: "8px 16px",
              border: "1px solid #6366f1",
              borderRadius: 6,
              background: "#eef2ff",
              color: "#4338ca",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Run 100项 Benchmark
          </button>
          {pretextTime !== null && domTime !== null && (
            <table style={{ marginTop: 12, fontSize: 14, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "4px 12px", textAlign: "left" }}>方案</th>
                  <th style={{ padding: "4px 12px", textAlign: "right" }}>耗时</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 12px", color: "#059669" }}>Pretext (算术)</td>
                  <td style={{ padding: "4px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {pretextTime.toFixed(2)} ms
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 12px", color: "#dc2626" }}>DOM (回流)</td>
                  <td style={{ padding: "4px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {domTime.toFixed(2)} ms
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DemoCard>
  );
}

/* ── 2. 聊天气泡 ── */
function ChatBubbleDemo() {
  const messages = [
    { role: "user", text: "你好！请问青梧UI支持哪些组件？" },
    {
      role: "assistant",
      text: "目前青梧UI已发布五个组件：Button 按钮、Calendar 日历（含农历/节气/节日/黄历）、Search 搜索（支持键盘导航和打字机轮播）、Upload 图片上传（客户端压缩）、Editor AI 编辑器（基于 Tiptap）。全部零框架依赖，纯 DOM + CSS 实现。",
    },
    { role: "user", text: "Text layout 组件是怎么工作的？" },
    {
      role: "assistant",
      text: "Text layout 采用 Pretext 启发的两阶段架构：prepare() 阶段用 Intl.Segmenter 做字素分割 + Canvas 测量宽度并缓存，耗时约 1-5ms；layout() 阶段纯算术计算换行，仅 ~0.0002ms/次。支持 CJK 任意位置断行、拉丁单词边界断行、Emoji 整体不断开、标点禁止在行首等 CSS 排版规则。适用于虚拟滚动高度预计算、多行精确截断、Canvas 文本排版等场景。",
    },
  ];

  const bubbleWidth = 320;

  return (
    <DemoCard
      title="聊天气泡高度测量"
      desc="每条消息通过 layout() 精确计算高度，可用于虚拟滚动定位和滚动锚定。对比传统方案需 DOM 渲染后才能获取高度。"
      code={`import { layout } from "@qingwu/text-layout";

// 测量消息气泡高度
const result = layout(messageText, { maxWidth: 300, lineHeight: 22 }, "15px system-ui");
// result.totalHeight → 气泡高度
// result.lineCount  → 行数
// result.lines       → 每行文本和宽度`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
        {messages.map((msg, i) => {
          const result = layout(msg.text, { maxWidth: bubbleWidth - 32, lineHeight: 22 }, FONT);
          const isUser = msg.role === "user";
          return (
            <div
              key={i}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: bubbleWidth,
                padding: "10px 14px",
                borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: isUser ? "#6366f1" : "#f3f4f6",
                color: isUser ? "#fff" : "#111",
                fontSize: 14,
                font,
                lineHeight: "22px",
                wordBreak: "break-word",
              }}
            >
              {msg.text}
              <div
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  opacity: 0.6,
                  textAlign: "right",
                }}
              >
                {result.lineCount} 行 · {Math.round(result.totalHeight)}px
              </div>
            </div>
          );
        })}
      </div>
    </DemoCard>
  );
}

/* ── 3. 多行截断 ── */
function TruncateDemo() {
  const longText =
    "青梧UI 是一套面向 AI 时代的前端工具库，涵盖按钮、日历、搜索、上传、编辑器等核心组件。全部零框架依赖，纯 DOM + CSS 实现。支持 TypeScript 7.0 和 Bun 运行时，使用 Turborepo 进行 monorepo 管理，通过 Changesets 管理版本发布。每个组件独立发包，可按需引入，不引入额外框架负担。";

  const [maxLines, setMaxLines] = useState(3);
  const [width, setWidth] = useState(360);

  const result = useMemo(
    () => truncateToLines(longText, width, maxLines, FONT),
    [longText, width, maxLines],
  );
  const fullResult = useMemo(() => layout(longText, { maxWidth: width, lineHeight: 24 }, FONT), [longText, width]);

  return (
    <DemoCard
      title="精确多行截断"
      desc={`全文 ${fullResult.lineCount} 行。Pretext 方案通过二分查找精确定位截断位置，返回截断文本和元信息。CSS line-clamp 无法返回截断位置。`}
      code={`import { truncateToLines } from "@qingwu/text-layout";

const { text, truncated, lineCount, fullLineCount } = truncateToLines(
  longText, 360, 3, "15px system-ui"
);
// text: 截断后的文本（含省略号）
// truncated: 是否被截断
// lineCount: 截断后实际行数`}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          行数:{" "}
          <select value={maxLines} onChange={(e) => setMaxLines(Number(e.target.value))} style={selectStyle}>
            {[1, 2, 3, 4, 5, 10].map((n) => (
              <option key={n} value={n}>{n} 行</option>
            ))}
          </select>
        </label>
        <label>
          宽度: {width}px{" "}
          <input type="range" min={160} max={500} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
        {result.truncated && (
          <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 500 }}>
            已截断 ({result.fullLineCount}→{result.lineCount} 行)
          </span>
        )}
      </div>
      <div
        style={{
          width,
          padding: 12,
          background: "#fefce8",
          borderRadius: 8,
          border: "1px solid #fde68a",
          fontSize: 14,
          font,
          lineHeight: "24px",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>截断前（{fullResult.lineCount} 行）:</div>
        <div style={{ opacity: 0.5, marginBottom: 12 }}>{longText}</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          截断后（{result.lineCount} 行）{result.truncated ? " ✓" : ""}:
        </div>
        <div>{result.text}</div>
      </div>
    </DemoCard>
  );
}

/* ── 4. 芯片流布局 ── */
function ChipFlowDemo() {
  const defaultChips: ChipItem[] = [
    { type: "text", text: "筛选：" },
    { type: "chip", text: "React" },
    { type: "chip", text: "TypeScript" },
    { type: "chip", text: "前端工具库" },
    { type: "chip", text: "Canvas" },
    { type: "text", text: " 共找到 " },
    { type: "chip", text: "零框架依赖" },
    { type: "chip", text: "CJK支持" },
    { type: "chip", text: "Emoji 😀" },
    { type: "text", text: " 相关标签" },
  ];

  const [items, setItems] = useState<ChipItem[]>(defaultChips);
  const [flowWidth, setFlowWidth] = useState(400);
  const [newChip, setNewChip] = useState("");

  const result = useMemo(() => layoutChips(items, flowWidth, FONT, 24, 28), [items, flowWidth]);

  const addChip = () => {
    if (!newChip.trim()) return;
    setItems((prev) => {
      const last = prev[prev.length - 1];
      const sep: ChipItem = { type: "text", text: " " };
      const chip: ChipItem = { type: "chip", text: newChip.trim() };
      return last?.type === "text" ? [...prev, chip] : [...prev, sep, chip];
    });
    setNewChip("");
  };

  const removeChip = (text: string) => {
    setItems((prev) => prev.filter((i) => !(i.type === "chip" && i.text === text)));
  };

  return (
    <DemoCard
      title="芯片流（Chip Flow）布局"
      desc="芯片作为不可断行原子元素与文本混合 inline 排版。添加/删除芯片实时重新排版。"
      code={`import { layoutChips } from "@qingwu/text-layout";

const items = [
  { type: "text", text: "筛选：" },
  { type: "chip", text: "React", extraWidth: 24 },
  { type: "chip", text: "TypeScript", extraWidth: 24 },
];

const { lines, totalHeight } = layoutChips(items, 400, "15px system-ui", 24, 28);
// lines[0].items → [{ type, text, x, width }, ...]`}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={newChip}
          onChange={(e) => setNewChip(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addChip()}
          placeholder="输入标签名…"
          style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: 160 }}
        />
        <button onClick={addChip} style={btnStyle}>添加</button>
        <button onClick={() => setItems(defaultChips)} style={{ ...btnStyle, background: "#f3f4f6", color: "#374151" }}>
          重置
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#888" }}>
          宽: {flowWidth}px
          <input type="range" min={160} max={500} value={flowWidth} onChange={(e) => setFlowWidth(Number(e.target.value))} />
        </label>
      </div>

      {/* 芯片流渲染 */}
      <div
        style={{
          width: flowWidth,
          minHeight: 40,
          padding: "8px 12px",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#fff",
          font,
          fontSize: 14,
          lineHeight: "28px",
        }}
      >
        {result.lines.map((line, li) => (
          <div key={li} style={{ position: "relative", height: 28 }}>
            {line.items.map((item, ii) => {
              if (item.type === "chip") {
                return (
                  <span
                    key={ii}
                    style={{
                      position: "absolute",
                      left: item.x,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "0 10px",
                      height: 24,
                      background: "#e0e7ff",
                      color: "#3730a3",
                      borderRadius: 12,
                      fontSize: 13,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => removeChip(item.text)}
                    title="点击移除"
                  >
                    {item.text} ×
                  </span>
                );
              }
              return (
                <span key={ii} style={{ position: "absolute", left: item.x }}>
                  {item.text}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
        {result.lines.length} 行 · 总高 {result.totalHeight}px
      </div>
    </DemoCard>
  );
}

/* ── 5. 表格列宽 ── */
function TableColumnsDemo() {
  const data = [
    ["组件名称", "描述", "版本", "体积"],
    ["@qingwu/button", "通用按钮组件，支持四种变体：默认、主色、琥珀色、图标按钮", "0.3.1", "4 kB"],
    ["@qingwu/calendar", "农历日历组件，含节气、节日、黄历、干支纪年，纯 DOM 渲染", "0.3.1", "30 kB"],
    ["@qingwu/search", "搜索框组件，打字机轮播占位、键盘导航、焦点陷阱、结果动画", "0.3.1", "12 kB"],
    ["@qingwu/upload", "图片上传组件，拖拽/点击、客户端压缩、多格式输出", "0.3.1", "8 kB"],
    ["@qingwu/editor", "AI 编辑器，基于 Tiptap，支持 Markdown 和所见即所得编辑", "0.3.1", "50 kB"],
    ["@qingwu/text-layout", "文本排版引擎，Pretext 启发两阶段架构，Unicode 感知换行", "0.3.1", "6 kB"],
  ];

  const [totalWidth, setTotalWidth] = useState(600);

  const { widths, truncated } = useMemo(
    () => computeColumnWidths(data.slice(1), totalWidth, FONT, 60, 300),
    [totalWidth, data],
  );

  return (
    <DemoCard
      title="表格列宽自动计算"
      desc="基于单元格内容自动计算最佳列宽，按比例分配 + 最小宽度约束。不受限于浏览器 table-layout: auto 的渲染后再确定列宽的性能问题。"
      code={`import { computeColumnWidths } from "@qingwu/text-layout";

const { widths, truncated } = computeColumnWidths(
  rows, tableWidth, "15px system-ui", 60, 300
);
// widths: 每列最佳宽度
// truncated: 每列是否需要截断`}
    >
      <div style={{ marginBottom: 10 }}>
        <label>
          表格宽度: {totalWidth}px{" "}
          <input type="range" min={300} max={800} value={totalWidth} onChange={(e) => setTotalWidth(Number(e.target.value))} />
        </label>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: totalWidth,
            borderCollapse: "collapse",
            fontSize: 14,
            font,
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              {data[0]!.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: "6px 10px",
                    textAlign: "left",
                    borderBottom: "2px solid #d1d5db",
                    color: truncated[i] ? "#dc2626" : "#111",
                  }}
                >
                  {h}
                  <div style={{ fontSize: 10, fontWeight: 400, color: "#888" }}>
                    {widths[i]}px {truncated[i] ? "(截断)" : ""}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(1).map((row, ri) => (
              <tr key={ri} style={{ borderBottom: "1px solid #e5e7eb" }}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "6px 10px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: truncated[ci] ? "#dc2626" : undefined,
                    }}
                    title={cell}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DemoCard>
  );
}

/* ── 引擎核心 API 速览 ── */
function EngineOverview() {
  const [sampleText, setSampleText] = useState(
    "Hello, 青梧UI 世界 🌍! Pretext 启发的高性能文本排版引擎，支持 CJK 中日韩文字、Emoji、双向文本。The quick brown fox jumps over the lazy dog.",
  );
  const [sampleWidth, setSampleWidth] = useState(360);

  const prepared = useMemo(() => prepare(sampleText, FONT), [sampleText]);
  const result = useMemo(
    () => layout(sampleText, { maxWidth: sampleWidth, lineHeight: 22 }, FONT),
    [sampleText, sampleWidth],
  );
  const { lineCount, totalHeight } = useMemo(
    () => measure(sampleText, sampleWidth, 22, FONT),
    [sampleText, sampleWidth],
  );

  return (
    <DemoCard
      title="引擎核心：prepare → layout 两阶段 API"
      desc={`Pretext 风格的文本排版：prepare() 做 Unicode 字素分割 + Canvas 宽度测量 + 缓存（一次性），layout() 纯算术计算换行（每次宽度变化可重复调用）。`}
      code={`import { prepare, layout, measure } from "@qingwu/text-layout";

// 阶段1: 预处理（一次性）
const segments = prepare(text, "15px system-ui");

// 阶段2: 排版（任意宽度，超快）
const { lines, totalHeight, lineCount } = layout(text, { maxWidth, lineHeight }, font);

// 快捷版
const { lineCount, totalHeight } = measure(text, maxWidth, lineHeight, font);`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <textarea
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            maxWidth: 520,
            padding: 8,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            font,
            fontSize: 14,
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            容器宽度: {sampleWidth}px{" "}
            <input
              type="range"
              min={120}
              max={500}
              value={sampleWidth}
              onChange={(e) => setSampleWidth(Number(e.target.value))}
            />
          </label>
          <span style={{ fontSize: 13, color: "#888" }}>
            {prepared.length} 个 segments · {lineCount} 行 · {Math.round(totalHeight)}px 高
          </span>
        </div>

        {/* 渲染排版结果 */}
        <div
          style={{
            width: sampleWidth,
            padding: 8,
            background: "#f0fdf4",
            borderRadius: 6,
            border: "1px solid #bbf7d0",
            font,
            fontSize: 14,
            lineHeight: "22px",
            wordBreak: "break-word",
          }}
        >
          {result.lines.map((line, i) => (
            <div
              key={i}
              style={{
                background: i % 2 === 0 ? "rgba(99,102,241,0.06)" : "transparent",
                borderRadius: 2,
                padding: "0 4px",
              }}
            >
              {line.text || "\u00A0"}
            </div>
          ))}
        </div>
      </div>
    </DemoCard>
  );
}

/* ── 算法规则说明 ── */
function AlgorithmRules() {
  return (
    <DemoCard
      title="文本排版规则引擎 —— 设计总览"
      desc="基于 Pretext 架构 + CSS Text Module Level 3 的行级排版规则"
      full
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, fontSize: 14 }}>
        {[
          {
            title: "规则 1：两阶段分离",
            desc: "prepare() 一次性文本预处理（Intl.Segmenter 字素分割 + Canvas 测量 + 缓存），layout() 纯算术 O(n) 换行，可每帧调用。与 Pretext 的设计哲学一致。",
          },
          {
            title: "规则 2：Unicode 感知",
            desc: "Intl.Segmenter grapheme 粒度分割。CJK 字符按单字断行，Emoji ZWJ 序列不可拆分，拉丁单词边界断行。覆盖中日韩、阿拉伯、泰文、Emoji 等脚本。",
          },
          {
            title: "规则 3：CSS 兼容换行",
            desc: "强断 > 软断 > 溢出断。空格为软断点，CJK 字符前后均可断行，标点禁止出现在行首。无断点时执行 overflow-wrap: break-word 策略。",
          },
          {
            title: "规则 4：虚拟滚动预计算",
            desc: "批量 prepare 后在数据加载阶段完成所有 item 高度计算，存入 Map。虚拟滚动组件 O(1) 查找任意 item 高度和偏移，无 DOM 回流。",
          },
          {
            title: "规则 5：二分查找截断",
            desc: "O(log n) 二分查找截断位置 vs 逐行构建 O(n)。截断后返回精确的截断位置、实际行数、是否被截断等元信息。",
          },
          {
            title: "规则 6：比例列宽分配",
            desc: "computeColumnWidths() 先测量每列自然宽度，再按比例分配可用空间，保证最小宽度约束，标注溢出列。适合大表格无渲染预计算场景。",
          },
        ].map((rule) => (
          <div
            key={rule.title}
            style={{
              padding: 14,
              background: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4, color: "#1e293b" }}>{rule.title}</div>
            <div style={{ color: "#64748b", lineHeight: 1.6 }}>{rule.desc}</div>
          </div>
        ))}
      </div>
    </DemoCard>
  );
}

/* ── 页面入口 ── */

const font = FONT;
const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  background: "#fff",
};
const btnStyle: React.CSSProperties = {
  padding: "4px 14px",
  border: "none",
  borderRadius: 6,
  background: "#6366f1",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
};

export default function TextLayoutPage() {
  return (
    <div className="demo-grid">
      <AlgorithmRules />
      <EngineOverview />
      <TruncateDemo />
      <ChatBubbleDemo />
      <ChipFlowDemo />
      <TableColumnsDemo />
      <VirtualScrollDemo />
    </div>
  );
}
