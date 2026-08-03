"use client";

import { useState } from "react";
import DemoCard from "@/components/DemoCard";

type InputStyle = "glow" | "simple";

const STYLE_LABELS: Record<InputStyle, string> = {
  glow: "流光边框",
  simple: "简约经典",
};

const snippets = {
  react: [
    'import "@qingwu/calendar/style.css";',
    "",
    "export default function InputDemo() {",
    "  return (",
    "    <>",
    '      <input className="qw-input" type="text" placeholder="流光边框..." />',
    '      <input className="qw-input-simple" type="text" placeholder="简约经典..." />',
    "    </>",
    "  );",
    "}",
  ].join("\n"),
  html: [
    "<!DOCTYPE html>",
    '<html lang="zh-CN">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <link rel="stylesheet" href="https://unpkg.com/@qingwu/calendar/style.css" />',
    "</head>",
    "<body>",
    '  <input class="qw-input" type="text" placeholder="流光边框..." />',
    '  <input class="qw-input-simple" type="text" placeholder="简约经典..." />',
    "</body>",
    "</html>",
  ].join("\n"),
  vue: [
    "<template>",
    '  <input class="qw-input" type="text" placeholder="流光边框..." />',
    '  <input class="qw-input-simple" type="text" placeholder="简约经典..." />',
    "</template>",
    "",
    "<style scoped>",
    "/* @property --qw-input-angle 已在全局生效 */",
    "</style>",
  ].join("\n"),
};

export default function InputPage() {
  const [style, setStyle] = useState<InputStyle>("glow");

  return (
    <div className="demo-grid">
      <DemoCard
        title="Input 输入框"
        desc="流光边框 / 简约经典两种样式，通过 className 切换"
        full
        snippets={snippets}
      >
        {/* props 面板 */}
        <div className="cal-props-panel">
          <div className="cal-props-grid">
            <label className="cal-props-field">
              <span className="cal-props-label">样式选择</span>
              <select
                className="cal-props-input"
                value={style}
                onChange={(e) => setStyle(e.target.value as InputStyle)}
              >
                <option value="glow">流光边框</option>
                <option value="simple">简约经典</option>
              </select>
            </label>
          </div>
        </div>

        {/* 输入框展示 */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className={style === "glow" ? "qw-input" : "qw-input-simple"}
            type="text"
            placeholder={style === "glow" ? "流光边框..." : "简约经典..."}
            readOnly
          />
        </div>
      </DemoCard>
    </div>
  );
}
