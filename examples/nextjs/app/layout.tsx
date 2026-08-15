"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "./css-order.css";
import "@qingwu-ui/calendar/style.css";
import "@qingwu-ui/search/style.css";
import "@qingwu-ui/toast/style.css";
import "@qingwu-ui/skeleton/style.css";
import "./globals.css";
import {
  ICON_CHEVRON_DOWN,
  ICON_CLOSE,
  ICON_GITHUB,
  ICON_MENU,
  ICON_MOON,
  ICON_SEARCH,
  ICON_SIDEBAR_TOGGLE,
  ICON_SUN,
} from "@icon/icons";
import { SearchBox, type SearchItem } from "@qingwu-ui/search";
import DocToc from "@/components/DocToc";
import PageHero from "@/components/PageHero";
import PrevNext from "@/components/PrevNext";
import {
  COMPONENT_SECTIONS,
  GUIDE_SECTION,
  HEADER_NAV,
  HREF_BY_TITLE,
  SEARCH_ITEMS,
} from "@/docs.config";

/* ---- 内联 Icon 渲染组件 ---- */
function SvgHtml({ html, size = 15 }: { html: string; size?: number }) {
  const sized = html
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`);
  // biome-ignore lint/security/noDangerouslySetInnerHtml: 渲染 @icon/icons 可信 SVG 字符串
  return <span dangerouslySetInnerHTML={{ __html: sized }} />;
}

/* ---- 侧栏：指南页显示指南导航，其余显示组件分组（双栏切换） ---- */
function Sidebar({
  onNavigate,
  collapsed = false,
  onToggle,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const isGuide = pathname.startsWith("/guide");
  const groups = isGuide ? [GUIDE_SECTION] : COMPONENT_SECTIONS;

  return (
    <aside className={`qw-sider${collapsed ? " is-collapsed" : ""}`}>
      {onToggle && (
        <div className="qw-sider-head">
          <button
            className="qw-sider-toggle"
            type="button"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            aria-expanded={!collapsed}
            onClick={onToggle}
          >
            <SvgHtml html={ICON_SIDEBAR_TOGGLE} size={15} />
          </button>
        </div>
      )}
      {collapsed ? (
        /* 折叠态：所有页面以 SVG 图标纵排呈现，点击直达 */
        <div className="qw-sider-rail">
          {groups
            .flatMap((g) => g.pages)
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={item.title}
                className={`qw-sider-rail-link${pathname === item.href ? " is-active" : ""}`}
              >
                <SvgHtml html={item.icon} size={17} />
              </Link>
            ))}
        </div>
      ) : (
        groups.map((group) => (
          <div className="qw-sider-group" key={group.id}>
            <div className="qw-sider-group-title">
              <span className="qw-sider-group-icon">
                <SvgHtml html={group.icon} />
              </span>
              {group.title}
            </div>
            {group.pages.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`qw-sider-link${pathname === item.href ? " is-active" : ""}`}
              >
                <span className="qw-sider-link-icon">
                  <SvgHtml html={item.icon} />
                </span>
                {item.title}
              </Link>
            ))}
          </div>
        ))
      )}
    </aside>
  );
}

/* ---- 头部 ---- */
function Header({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [versionOpen, setVersionOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchRootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<SearchBox | null>(null);
  const versionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("qw-theme");
    if (stored === "dark") {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  /* 初始化文档站全文搜索（自定义头部入口，trigger: false） */
  useEffect(() => {
    const root = searchRootRef.current;
    if (!root || boxRef.current) return;
    boxRef.current = new SearchBox(root, {
      trigger: false,
      items: SEARCH_ITEMS,
      categories: ["全部", "指南", "组件", "更新日志"],
      placeholders: ["搜索组件…", "试试「日历」", "试试「农历」", "试试「安装」"],
      onSelect: (item: SearchItem) => {
        const href = HREF_BY_TITLE.get(item.title);
        if (href) router.push(href);
      },
    });
    return () => {
      boxRef.current?.destroy();
      boxRef.current = null;
    };
  }, [router]);

  /* 版本下拉：点击外部关闭 */
  useEffect(() => {
    if (!versionOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!versionRef.current?.contains(e.target as Node)) setVersionOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [versionOpen]);

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
        <button
          className="qw-header-burger"
          type="button"
          aria-label="打开导航"
          onClick={onOpenDrawer}
        >
          <SvgHtml html={ICON_MENU} size={18} />
        </button>
        <Link href="/" className="qw-header-brand">
          <img
            src="/logo.png"
            alt="青梧 UI"
            width={32}
            height={32}
            className="qw-header-logo-mark"
          />
          <span className="qw-header-logo">青梧 UI</span>
        </Link>
      </div>

      <nav className="qw-header-nav" aria-label="主导航">
        {HEADER_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`qw-header-nav-link${n.match(pathname) ? " is-active" : ""}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="qw-header-actions">
        <button
          className="qw-header-search-trigger"
          type="button"
          aria-label="搜索文档"
          onClick={() => boxRef.current?.open()}
        >
          <SvgHtml html={ICON_SEARCH} size={14} />
          <span className="qw-header-search-label">搜索文档</span>
          <span className="qw-header-search-keys">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
        </button>

        <div className="qw-version" ref={versionRef}>
          <button
            className="qw-version-trigger"
            type="button"
            aria-expanded={versionOpen}
            aria-haspopup="menu"
            onClick={() => setVersionOpen(!versionOpen)}
          >
            v0.9.0-beta.1
            <SvgHtml html={ICON_CHEVRON_DOWN} size={12} />
          </button>
          {versionOpen && (
            <div className="qw-version-menu" role="menu">
              <button className="qw-version-item is-current" type="button" role="menuitem">
                v0.9.0-beta.1 <span>当前版本</span>
              </button>
              <Link
                className="qw-version-item"
                href="/demo/changelog"
                role="menuitem"
                onClick={() => setVersionOpen(false)}
              >
                查看全部版本
              </Link>
            </div>
          )}
        </div>

        <a
          className="qw-header-github"
          href="https://github.com/apricotdream/qingwu-ui"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub 仓库"
        >
          <SvgHtml html={ICON_GITHUB} size={17} />
        </a>

        <button
          className="qw-theme-toggle"
          type="button"
          aria-label={theme === "light" ? "切换到暗色模式" : "切换到亮色模式"}
          onClick={toggleTheme}
        >
          <SvgHtml html={theme === "light" ? ICON_MOON : ICON_SUN} size={16} />
        </button>
      </div>

      {/* SearchBox 挂载点（trigger: false 时不渲染触发条，仅承载遮罩面板） */}
      <div ref={searchRootRef} className="qw-search-host" />
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const pathname = usePathname();

  /* 路由变化时关闭抽屉 */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖 pathname 触发“路由变化时关闭抽屉”
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  /* 侧边栏折叠状态持久化 */
  useEffect(() => {
    if (localStorage.getItem("qw-sider-collapsed") === "1") setSiderCollapsed(true);
  }, []);

  const toggleSider = () => {
    setSiderCollapsed((c) => {
      const next = !c;
      localStorage.setItem("qw-sider-collapsed", next ? "1" : "0");
      return next;
    });
  };

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <title>青梧 UI — 中国历法组件库</title>
      </head>
      <body>
        <Header onOpenDrawer={() => setDrawerOpen(true)} />
        <div className="qw-body">
          <Sidebar collapsed={siderCollapsed} onToggle={toggleSider} />
          <main className="qw-content">
            <PageHero />
            {children}
            <PrevNext />
          </main>
          <DocToc />
        </div>

        {drawerOpen && (
          <div className="qw-drawer-layer">
            <button
              type="button"
              className="qw-drawer-backdrop"
              aria-label="关闭导航"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="qw-drawer">
              <div className="qw-drawer-head">
                <span className="qw-drawer-title">导航</span>
                <button
                  className="qw-drawer-close"
                  type="button"
                  aria-label="关闭导航"
                  onClick={() => setDrawerOpen(false)}
                >
                  <SvgHtml html={ICON_CLOSE} size={16} />
                </button>
              </div>
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
