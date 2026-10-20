"use client";

import { QingWuAIEditor } from "@qingwu-ui/ai-editor";
import Link from "next/link";

const DEMO_MARKDOWN = [
  "# LaTeX 公式演示",
  "",
  "下面每一处公式都可以**直接点击**，在浮层里修改 LaTeX 源码并实时预览。",
  "",
  "## 行内公式",
  "",
  "质能方程 $E = mc^2$，分式 $\\frac{20}{100}$，希腊字母 $\\alpha$、$\\beta$。",
  "",
  "## 块级公式",
  "",
  "$$",
  "\\frac{20}{100}",
  "$$",
  "",
  "## 多行块级公式",
  "",
  "$$",
  "\\int_{0}^{1} x^2 \\, dx = \\frac{1}{3}",
  "$$",
  "",
  "## 矩阵",
  "",
  "$$",
  "\\begin{pmatrix}",
  "a & b \\\\",
  "c & d",
  "\\end{pmatrix}",
  "$$",
  "",
  "## 自己试试",
  "",
  "1. 行内：输入 `$\\sqrt{x^2 + y^2}$`",
  "2. 块级单行：输入 `$$\\sum_{i=1}^{n} i$$`",
  "3. 块级多行：先输入 `$$`，换行写公式，最后一行再输入 `$$`",
  "",
  "## Mermaid 图表",
  "",
  "在下面的 mermaid 代码块右上角点击「渲染图表」，再点击生成的图表即可放大 / 缩放。",
  "",
  "```mermaid",
  "graph TD",
  "  A[开始] --> B{判断}",
  "  B -->|是| C[完成]",
  "  B -->|否| D[结束]",
  "```",
  "",
].join("\n");

export default function MathDemoPage() {
  return (
    <div className="min-h-screen bg-default-50 dark:bg-default-950">
      <header className="sticky top-0 z-40 border-b border-default-200 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-wide sm:text-lg">LaTeX 公式演示</h1>
            <p className="truncate text-[11px] text-default-500 sm:text-xs">
              行内 / 块级 / 多行公式 · KaTeX 渲染 · 点击公式即可编辑
            </p>
          </div>
          <Link
            href="/demo/editor"
            className="shrink-0 rounded-lg border border-default-200 px-3 py-1.5 text-xs text-default-600 transition-colors hover:bg-default-100 dark:text-default-300 dark:hover:bg-default-800"
          >
            返回完整编辑器
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6">
        <QingWuAIEditor
          initialContent={DEMO_MARKDOWN}
          mode="edit"
          showToc={false}
          maxAttachmentSize={50 * 1024 * 1024}
          maxTotalAttachmentSize={100 * 1024 * 1024}
        />
      </main>
    </div>
  );
}
