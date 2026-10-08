"use client";

import { type ReactNode } from "react";
import CodeTabs from "./CodeTabs";

/**
 * 演示卡片：标题 / 说明 / 预览舞台 / 代码区。
 * - snippets：react/html/vue 多格式（推荐，新 demo 一律使用）
 * - code：单格式回退
 */
export default function DemoCard({
  title,
  desc,
  children,
  code,
  snippets,
  full = false,
}: {
  title: string;
  desc: string;
  children: ReactNode;
  code?: string;
  /** 多格式代码（react / html / vue），启用标签切换；未提供时回退到 code */
  snippets?: Record<string, string>;
  full?: boolean;
}) {
  const tabs = snippets ?? (code ? { react: code } : null);
  // 单格式代码不显示框架 tab 标签
  const singleMode = snippets == null && code != null;

  return (
    <article className={`demo-card${full ? " is-full" : ""}`}>
      <div className="demo-card-header">
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>
      <div className="demo-card-stage">{children}</div>
      {tabs && (
        <CodeTabs snippets={tabs} defaultFmt={singleMode ? "react" : "react"} hideTabs={singleMode} />
      )}
    </article>
  );
}
