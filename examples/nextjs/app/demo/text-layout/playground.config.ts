import { layout } from "@qingwu-ui/text-layout";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

/** 测量 / 渲染统一字体 */
const FONT = "15px system-ui, -apple-system, sans-serif";

const SAMPLE_TEXT =
  "青梧UI 是一套面向 AI 时代的前端工具库，涵盖按钮、日历、搜索、上传、编辑器等核心组件。全部零框架依赖，纯 DOM + CSS 实现。Hello CJK 中日韩文字与 Emoji 😀 混合排版。";

export const TEXT_LAYOUT_FIELDS: FieldDef[] = [
  {
    key: "maxWidth",
    label: "最大宽度",
    type: "select",
    defaultValue: "480",
    live: true,
    options: [
      { label: "320px", value: "320" },
      { label: "480px", value: "480" },
      { label: "640px", value: "640" },
    ],
  },
  {
    key: "lineHeight",
    label: "行高",
    type: "select",
    defaultValue: "22",
    live: true,
    options: [
      { label: "16px", value: "16" },
      { label: "22px", value: "22" },
      { label: "24px", value: "24" },
    ],
  },
  {
    key: "maxLines",
    label: "最大行数",
    type: "select",
    defaultValue: "2",
    live: true,
    options: [
      { label: "1 行", value: "1" },
      { label: "2 行", value: "2" },
      { label: "3 行", value: "3" },
    ],
  },
  {
    key: "overflowWrap",
    label: "溢出换行",
    type: "select",
    defaultValue: "break-word",
    live: true,
    options: [
      { label: "normal", value: "normal" },
      { label: "break-word", value: "break-word" },
    ],
  },
];

export function createTextLayout(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  const container = document.createElement("div");
  host.appendChild(container);

  const render = (values: Record<string, unknown>) => {
    const result = layout(SAMPLE_TEXT, {
      maxWidth: Number(values.maxWidth),
      lineHeight: Number(values.lineHeight),
      maxLines: Number(values.maxLines),
      overflowWrap: values.overflowWrap === "normal" ? "normal" : "break-word",
    }, FONT);

    container.textContent = "";

    const info = document.createElement("div");
    info.style.cssText = "font:12px system-ui;color:#84928f;margin-bottom:8px";
    info.textContent = `${result.lineCount} 行 · 总高 ${Math.round(result.totalHeight)}px${
      result.truncated ? " · 已截断" : ""
    }`;
    container.appendChild(info);

    const wrap = document.createElement("div");
    wrap.style.cssText = `width:${Number(values.maxWidth)}px;max-width:100%;font:${FONT};line-height:${Number(values.lineHeight)}px`;
    for (const line of result.lines) {
      const row = document.createElement("div");
      row.style.height = `${Number(values.lineHeight)}px`;
      row.style.whiteSpace = "pre";
      row.textContent = line.text || " ";
      wrap.appendChild(row);
    }
    container.appendChild(wrap);
  };

  render(v);
  log("纯函数排版完成：layout(text, options, font)");

  return {
    destroy: () => container.remove(),
    update: (values, changedKey) => {
      render(values);
      log(`参数变化重算：${changedKey}`);
    },
  };
}

export function textLayoutToCode(v: Record<string, unknown>): CodegenInput {
  const stmt = `// 纯函数调用：无实例、无副作用，任意框架内直接调用
const text = ${JSON.stringify(SAMPLE_TEXT)};

const result = layout(text, {
  maxWidth: ${Number(v.maxWidth)},
  lineHeight: ${Number(v.lineHeight)},
  maxLines: ${Number(v.maxLines)},
  overflowWrap: "${v.overflowWrap === "normal" ? "normal" : "break-word"}"
}, "${FONT}");

// 逐行渲染到挂载点（真实项目可映射到 Canvas / 虚拟列表）
result.lines.forEach(function (line) {
  const row = document.createElement("div");
  row.textContent = line.text;
  row.style.height = "${Number(v.lineHeight)}px";
  row.style.whiteSpace = "pre";
  el.appendChild(row);
});
// result.lineCount / totalHeight / truncated → 行数 / 总高 / 是否截断`;

  return {
    meta: PKG.textLayout,
    symbol: ["layout"],
    stmt,
    destroy: "// 纯函数，无需卸载",
  };
}
