"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import "@qingwu/calendar/style.css";
import "@qingwu/search/style.css";
import "@qingwu/toast/style.css";
import "@qingwu/skeleton/style.css";
import "./globals.css";
import {
  ICON_BOX,
  ICON_EDIT,
  ICON_CALENDAR,
  ICON_SEARCH,
  ICON_UPLOAD,
  ICON_TYPE,
  ICON_FILE,
  ICON_INFO,
  ICON_SUN,
  ICON_MOON,
  ICON_SIDEBAR_TOGGLE,
} from "@icon/icons";

/* ---- 内联 Icon 渲染组件 ---- */
function SvgHtml({ html, size = 15 }: { html: string; size?: number }) {
  const sized = html.replace(/width="[^"]*"/, `width="${size}"`).replace(/height="[^"]*"/, `height="${size}"`);
  return <span dangerouslySetInnerHTML={{ __html: sized }} />;
}

/* ---- 导航分组 ---- */

interface NavItem { label: string; href: string; icon: string; }

const NAV_GROUPS: { title: string; icon: string; items: NavItem[] }[] = [
  {
    title: "通用",
    icon: ICON_BOX,
    items: [
      { label: "Button 按钮", href: "/demo/button", icon: ICON_BOX },
      { label: "Input 输入框", href: "/demo/input", icon: ICON_EDIT },
      { label: "Toast 轻提示", href: "/demo/toast", icon: ICON_INFO },
    ],
  },
  {
    title: "数据录入",
    icon: ICON_CALENDAR,
    items: [
      { label: "Calendar 日历", href: "/demo/calendar-popup", icon: ICON_CALENDAR },
      { label: "Search 搜索", href: "/demo/search", icon: ICON_SEARCH },
      { label: "Upload 上传", href: "/demo/upload", icon: ICON_UPLOAD },
    ],
  },
  {
    title: "生产力",
    icon: ICON_FILE,
    items: [
      { label: "Editor 编辑器", href: "/demo/editor", icon: ICON_EDIT },
      { label: "Text Layout 排版", href: "/demo/text-layout", icon: ICON_TYPE },
      { label: "Skeleton 骨架", href: "/demo/skeleton", icon: ICON_TYPE },
    ],
  },
  {
    title: "更多",
    icon: ICON_INFO,
    items: [
      { label: "更新日志", href: "/demo/changelog", icon: ICON_FILE },
    ],
  },
];

function Sidebar({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const pathname = usePathname();
  return (
    <aside className={`qw-sider${collapsed ? " is-collapsed" : ""}`}>
      <button
        className={`qw-sider-collapse${collapsed ? " is-expand" : ""}`}
        type="button"
        aria-label={collapsed ? "展开左侧栏" : "收缩左侧栏"}
        aria-expanded={!collapsed}
        onClick={onToggleCollapse}
      >
        <SvgHtml html={ICON_SIDEBAR_TOGGLE} size={18} />
      </button>
      {NAV_GROUPS.map((group) => (
        <div className="qw-sider-group" key={group.title}>
          <div className="qw-sider-group-title">
            <span className="qw-sider-group-icon"><SvgHtml html={group.icon} /></span>
            {group.title}
          </div>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`qw-sider-link${pathname === item.href ? " is-active" : ""}`}
            >
              <span className="qw-sider-link-icon"><SvgHtml html={item.icon} /></span>
              {item.label}
            </Link>
          ))}
        </div>
      ))}
      <div className="qw-sider-footer">
        <div className="qw-sider-version">
          <span className="qw-sider-version-dot" />
          v0.4.0
        </div>
      </div>
    </aside>
  );
}

function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("qw-theme");
    if (stored === "dark") {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("qw-theme", next);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  return (
    <header className="qw-header">
      <div className="qw-header-left">
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, color: "inherit", textDecoration: "none" }}>
          <div className="qw-header-seal">青</div>
          <span className="qw-header-logo">青梧 UI</span>
        </Link>
      </div>
      <div className="qw-header-actions">
        <button
          className="qw-theme-toggle"
          type="button"
          aria-label={theme === "light" ? "切换到暗色模式" : "切换到亮色模式"}
          onClick={toggleTheme}
        >
          <SvgHtml html={theme === "light" ? ICON_MOON : ICON_SUN} size={16} />
        </button>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>青梧 UI — 中国历法组件库</title>
      </head>
      <body>
        <Header />
        <div className={`qw-body${collapsed ? " is-sider-collapsed" : ""}`}>
          <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
          <main className="qw-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
