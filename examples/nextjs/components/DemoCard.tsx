"use client";

import { ICON_CHEVRON_UP, ICON_CODE } from "@icon/icons";
import { type ReactNode, useState } from "react";

function SvgHtml({ html, size = 14 }: { html: string; size?: number }) {
  const sized = html
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`);
  // biome-ignore lint/security/noDangerouslySetInnerHtml: 渲染 @icon/icons 可信 SVG 字符串
  return <span dangerouslySetInnerHTML={{ __html: sized }} />;
}

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
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState("react");

  const hasTabs = snippets != null;
  const displayCode = hasTabs ? (snippets[fmt] ?? snippets["react"] ?? "") : (code ?? "");

  const tabLabels: Record<string, string> = {
    react: "React",
    html: "HTML",
    vue: "Vue",
  };

  return (
    <article className={`demo-card${full ? " is-full" : ""}`}>
      <div className="demo-card-header">
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>
      <div className="demo-card-stage">{children}</div>
      {displayCode && (
        <>
          <div className="demo-card-toolbar">
            {hasTabs && (
              <div className="demo-code-tabs">
                {Object.keys(snippets).map((k) => (
                  <button
                    key={k}
                    className={`demo-code-tab${fmt === k ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setFmt(k)}
                  >
                    {tabLabels[k] ?? k}
                  </button>
                ))}
              </div>
            )}
            <button className="demo-toggle-code" type="button" onClick={() => setOpen(!open)}>
              <SvgHtml html={open ? ICON_CHEVRON_UP : ICON_CODE} />
              {open ? "收起代码" : "展开代码"}
            </button>
          </div>
          <div className={`demo-card-code${open ? " is-open" : ""}`}>
            <div className="demo-card-code-inner">
              <pre>
                <code>{displayCode}</code>
              </pre>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
