import { ICON_CALENDAR_DOT, ICON_CLOCK, ICON_MICROPHONE, ICON_USERS } from "@icon/icons";
import Link from "next/link";

function SvgHtml({ html, size = 20 }: { html: string; size?: number }) {
  const sized = html
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`);
  // biome-ignore lint/security/noDangerouslySetInnerHtml: 渲染 @icon/icons 可信 SVG 字符串
  return <span dangerouslySetInnerHTML={{ __html: sized }} />;
}

const FEATURE_ICONS = [
  { html: ICON_CLOCK, cls: "teal" },
  { html: ICON_CALENDAR_DOT, cls: "vermilion" },
  { html: ICON_USERS, cls: "amber" },
  { html: ICON_MICROPHONE, cls: "ink" },
];

const COMPONENTS = [
  {
    href: "/demo/button",
    title: "Button 按钮",
    desc: "药丸风格按钮，默认 / 主色 / 琥珀 / 图标四变体",
    icon: "◇",
    iconClass: "button",
    badge: "stable",
    badgeText: "稳定",
  },
  {
    href: "/demo/carousel",
    title: "Carousel 轮播图",
    desc: "左侧大图 + 右侧文案 + 底部缩略图切换",
    icon: "◐",
    iconClass: "carousel",
    badge: "new",
    badgeText: "新",
  },
  {
    href: "/demo/input",
    title: "Input 输入框",
    desc: "CSS 流光边框动画 + 简约经典样式",
    icon: "→",
    iconClass: "input",
    badge: "stable",
    badgeText: "稳定",
  },
  {
    href: "/demo/toast",
    title: "Toast 轻提示",
    desc: "ARIA live region 内建 · 6 种定位 · Promise 链 · 队列管理",
    icon: "◈",
    iconClass: "toast",
    badge: "stable",
    badgeText: "稳定",
  },
  {
    href: "/demo/calendar-popup",
    title: "Calendar 日历",
    desc: "输入框弹出面板，农历 / 节气 / 节日 / 黄历宜忌",
    icon: "田",
    iconClass: "calendar",
    badge: "stable",
    badgeText: "稳定",
  },
  {
    href: "/demo/search",
    title: "Search 搜索",
    desc: "打字机轮播占位 + 类别筛选 + 全键盘导航",
    icon: "◎",
    iconClass: "search",
    badge: "stable",
    badgeText: "稳定",
  },
  {
    href: "/demo/upload",
    title: "Upload 上传",
    desc: "拖拽 / 按钮触发，WebP / AVIF 客户端压缩",
    icon: "↑",
    iconClass: "upload",
    badge: "stable",
    badgeText: "稳定",
  },
  {
    href: "/demo/editor",
    title: "AI Editor 编辑器",
    desc: "AI 辅助 Markdown/WYSIWYG 编辑器",
    icon: "✎",
    iconClass: "editor",
    badge: "stable",
    badgeText: "稳定",
  },
  {
    href: "/demo/text-layout",
    title: "Text Layout 排版",
    desc: "精准文字排版引擎，截断 / 分栏 / 虚拟滚动",
    icon: "¶",
    iconClass: "text",
    badge: "stable",
    badgeText: "稳定",
  },
  {
    href: "/demo/skeleton",
    title: "Skeleton 骨架",
    desc: "自动 DOM 测量骨架屏，零布局重复，SSR 可选",
    icon: "◫",
    iconClass: "skeleton",
    badge: "new",
    badgeText: "新",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ---- Hero ---- */}
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          开源 · Apache-2.0 协议
        </div>
        <h1>
          以<span className="hero-gradient">中国历法</span>为内核的
          <br />
          框架无关 UI 组件库
        </h1>
        <p className="hero-sub">
          零依赖的<strong>纯 TypeScript</strong>组件，原生 DOM 渲染，
          <strong>React / Vue / 原生 HTML</strong> 均可使用。 内置 1900-2100 年
          <strong>农历引擎</strong>，精准节气与节日计算。
        </p>
        <div className="hero-stats">
          {[
            { value: "8", label: "核心组件" },
            { value: "0", label: "运行时依赖" },
            { value: "30k", label: "日历包体积" },
            { value: "2100", label: "历法覆盖年份" },
          ].map((s) => (
            <div key={s.label} className="hero-stat">
              <div className="hero-stat-value">{s.value}</div>
              <div className="hero-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- 特性亮点 ---- */}
      <div className="features">
        {[
          {
            title: "零依赖",
            desc: "纯 TypeScript + 原生 DOM，无框架绑定，精确 tree-shaking，ESM/CJS 双格式输出。",
          },
          {
            title: "中国历法引擎",
            desc: "自研农历算法，覆盖 1900-2100 年。节气、干支、宜忌、休假日历开箱即用。",
          },
          {
            title: "框架无关",
            desc: "React、Vue、Svelte、原生 HTML —— 同一套 API，同一套样式，自由组合。",
          },
          {
            title: "无障碍优先",
            desc: "ARIA 语义完整、全键盘导航、prefers-reduced-motion 感知，为每一位用户设计。",
          },
        ].map((f, i) => (
          <div key={f.title} className="feature-card">
            <div className={`feature-icon ${FEATURE_ICONS[i].cls}`}>
              <SvgHtml html={FEATURE_ICONS[i].html} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* ---- 组件列表 ---- */}
      <div className="section-header">
        <h2>所有组件</h2>
        <div className="section-header-line" />
      </div>

      <div className="comp-grid">
        {COMPONENTS.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className="comp-card"
            style={{ animationDelay: `${0.05 * i}s` }}
          >
            <div className={`comp-card-icon ${item.iconClass}`}>{item.icon}</div>
            <div className="comp-card-body">
              <div className="comp-card-title">
                {item.title}
                <span className={`comp-card-badge ${item.badge}`}>{item.badgeText}</span>
              </div>
              <div className="comp-card-desc">{item.desc}</div>
            </div>
            <div className="comp-card-arrow">→</div>
          </Link>
        ))}
      </div>

      {/* ---- 快速开始 ---- */}
      <div className="quickstart">
        <h2>快速开始</h2>
        <p>选择需要的组件，独立安装使用。所有组件都是可选的，不会引入不需要的代码。</p>
        <div className="quickstart-code">
          <code>
            <span className="hl-comment"># 安装日历组件</span>
            {"\n"}
            <span className="hl-keyword">npm</span> install @qingwu-ui/calendar{"\n\n"}
            <span className="hl-comment">{"// 在代码中使用"}</span>
            {"\n"}
            <span className="hl-keyword">import</span> {"{"} Calendar {"}"}{" "}
            <span className="hl-keyword">from</span>{" "}
            <span className="hl-string">&quot;@qingwu-ui/calendar&quot;</span>;{"\n"}
            <span className="hl-keyword">import</span>{" "}
            <span className="hl-string">&quot;@qingwu-ui/calendar/style.css&quot;</span>;{"\n\n"}
            <span className="hl-keyword">const</span> cal = <span className="hl-keyword">new</span>{" "}
            Calendar(el, {"{"}
            {"\n"}
            {"  "}placeholder: <span className="hl-string">&quot;选择日期&quot;</span>,{"\n"}
            {"  "}onChange: (date) =&gt; console.log(date),{"\n"}
            {"}"});
          </code>
        </div>
      </div>
    </>
  );
}
