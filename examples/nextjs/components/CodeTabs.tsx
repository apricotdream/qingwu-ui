"use client";

import { ICON_CHEVRON_UP, ICON_CODE, ICON_COPY } from "@icon/icons";
import { useState } from "react";

function SvgHtml({ html, size = 14 }: { html: string; size?: number }) {
  const sized = html
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`);
  // biome-ignore lint/security/noDangerouslySetInnerHtml: 渲染 @icon/icons 可信 SVG 字符串
  return <span dangerouslySetInnerHTML={{ __html: sized }} />;
}

const TAB_LABELS: Record<string, string> = {
  react: "React",
  html: "HTML",
  vue: "Vue",
};

/**
 * 三框架代码面板：React / HTML / Vue tab + 折叠 + 复制。
 * DemoCard 与 Playground 共用，保证全站代码区风格一致。
 */
export default function CodeTabs({
  snippets,
  defaultFmt = "react",
  hideTabs = false,
  defaultOpen = false,
  bare = false,
}: {
  snippets: Record<string, string>;
  defaultFmt?: string;
  /** 单格式代码：不渲染框架 tab，只保留复制/展开 */
  hideTabs?: boolean;
  /** 初始即展开代码区（用于弹层等 CodeTabs 直接就是主角的场景） */
  defaultOpen?: boolean;
  /** 去除为 .demo-card 设计的外边距/分隔线，由外层容器控制间距 */
  bare?: boolean;
}) {
  const keys = Object.keys(snippets);
  const [fmt, setFmt] = useState(keys.includes(defaultFmt) ? defaultFmt : keys[0]);
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const displayCode = snippets[fmt] ?? "";
  if (!displayCode) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默（部分非安全上下文）
    }
  };

  return (
    <>
      <div className={`demo-card-toolbar${bare ? " is-bare" : ""}`}>
        {!hideTabs && <div className="demo-code-tabs">
          {keys.map((k) => (
            <button
              key={k}
              className={`demo-code-tab${fmt === k ? " is-active" : ""}`}
              type="button"
              onClick={() => setFmt(k)}
            >
              {TAB_LABELS[k] ?? k}
            </button>
          ))}
        </div>
        }
        <div className="demo-code-actions" style={{ marginLeft: "auto" }}>
          <button className="demo-toggle-code" type="button" onClick={copy}>
            <SvgHtml html={ICON_COPY} />
            {copied ? "已复制" : "复制"}
          </button>
          <button className="demo-toggle-code" type="button" onClick={() => setOpen(!open)}>
            <SvgHtml html={open ? ICON_CHEVRON_UP : ICON_CODE} />
            {open ? "收起代码" : "展开代码"}
          </button>
        </div>
      </div>
      <div className={`demo-card-code${open ? " is-open" : ""}${bare ? " is-bare" : ""}`}>
        <div className="demo-card-code-inner">
          <pre>
            <code>{displayCode}</code>
          </pre>
        </div>
      </div>
    </>
  );
}
