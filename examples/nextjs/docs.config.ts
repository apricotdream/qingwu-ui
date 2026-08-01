/* ============================================================
   青梧 UI · 文档站单一数据源
   侧栏 / 头部导航 / 页面标题区 / 本页目录 / 上一页下一页 / 搜索索引
   全部由此配置生成，新增页面只需在此登记。
   ============================================================ */

import {
  ICON_BOX,
  ICON_EDIT,
  ICON_CALENDAR,
  ICON_SEARCH,
  ICON_UPLOAD,
  ICON_TYPE,
  ICON_FILE,
  ICON_INFO,
} from "@icon/icons";

export interface DocPage {
  /** 页面路由（同时作为搜索跳转目标） */
  href: string;
  /** 中文名 / 组件名（标题区主标题） */
  title: string;
  /** 英文名（标题区灰字，若 title 已包含则省略） */
  en: string;
  /** 一句话描述（标题区 + 搜索索引） */
  desc: string;
  /** 搜索关键词（参与全文匹配，弥补 SearchBox 仅匹配 title/sub 的局限） */
  keywords: string[];
  /** 侧栏图标 */
  icon: string;
}

export interface DocSection {
  id: string;
  title: string;
  icon: string;
  pages: DocPage[];
}

/* ---- 指南区 ---- */
export const GUIDE_SECTION: DocSection = {
  id: "guide",
  title: "指南",
  icon: ICON_BOX,
  pages: [
    {
      href: "/guide/install",
      title: "安装",
      en: "Installation",
      desc: "按需安装组件包，零依赖、纯 TypeScript、原生 DOM 渲染，React / Vue / 原生 HTML 均可使用。",
      keywords: ["npm", "pnpm", "bun", "安装", "快速开始", "quick start", "CDN", "unpkg", "ESM", "CJS", "style.css"],
      icon: ICON_BOX,
    },
    {
      href: "/guide/lunar",
      title: "历法说明",
      en: "Lunar Calendar",
      desc: "1900-2100 年农历引擎：查表法推算、节气近似算法、节日习俗数据、干支生肖与休假表注入。",
      keywords: ["农历", "节气", "节日", "干支", "生肖", "宜忌", "黄历", "lunar", "solar term", "festival", "holiday"],
      icon: ICON_CALENDAR,
    },
  ],
};

/* ---- 组件区（Element Plus 式分类） ---- */
export const COMPONENT_SECTIONS: DocSection[] = [
  {
    id: "basic",
    title: "基础组件",
    icon: ICON_BOX,
    pages: [
      {
        href: "/demo/button",
        title: "Button 按钮",
        en: "Button",
        desc: "药丸风格按钮：默认 / 主色 / 琥珀 / 图标四变体。",
        keywords: ["按钮", "button", "主色", "琥珀", "图标", "药丸"],
        icon: ICON_BOX,
      },
      {
        href: "/demo/input",
        title: "Input 输入框",
        en: "Input",
        desc: "CSS 流光边框动画 + 简约经典两种样式。",
        keywords: ["输入框", "input", "流光", "边框", "表单"],
        icon: ICON_EDIT,
      },
      {
        href: "/demo/text-layout",
        title: "Text Layout 排版",
        en: "Text Layout",
        desc: "精准文字排版引擎：截断 / 分栏 / 虚拟滚动。",
        keywords: ["排版", "text layout", "截断", "分栏", "虚拟滚动", "文字"],
        icon: ICON_TYPE,
      },
    ],
  },
  {
    id: "data",
    title: "数据组件",
    icon: ICON_CALENDAR,
    pages: [
      {
        href: "/demo/calendar-popup",
        title: "Calendar 日历",
        en: "Calendar",
        desc: "弹出式日期选择：农历 / 节气 / 节日 / 黄历宜忌 / 休假表 / 禁用规则。",
        keywords: ["日历", "calendar", "农历", "节气", "节假日", "禁用规则", "date picker", "日期选择"],
        icon: ICON_CALENDAR,
      },
      {
        href: "/demo/skeleton",
        title: "Skeleton 骨架",
        en: "Skeleton",
        desc: "自动 DOM 测量骨架屏：零布局重复，SSR 可选。",
        keywords: ["骨架屏", "skeleton", "加载", "loading", "SSR", "占位"],
        icon: ICON_TYPE,
      },
    ],
  },
  {
    id: "form",
    title: "表单组件",
    icon: ICON_SEARCH,
    pages: [
      {
        href: "/demo/search",
        title: "Search 搜索",
        en: "Search",
        desc: "打字机轮播占位 + 类别筛选 + 全键盘导航的模态搜索框。",
        keywords: ["搜索", "search", "打字机", "筛选", "键盘", "Cmd+K"],
        icon: ICON_SEARCH,
      },
      {
        href: "/demo/upload",
        title: "Upload 上传",
        en: "Upload",
        desc: "拖拽 / 按钮触发，WebP / AVIF 客户端压缩。",
        keywords: ["上传", "upload", "拖拽", "压缩", "webp", "avif", "图片"],
        icon: ICON_UPLOAD,
      },
    ],
  },
  {
    id: "feedback",
    title: "反馈组件",
    icon: ICON_INFO,
    pages: [
      {
        href: "/demo/toast",
        title: "Toast 轻提示",
        en: "Toast",
        desc: "ARIA live region 内建 · 6 种定位 · Promise 链 · 队列管理。",
        keywords: ["toast", "轻提示", "提示", "通知", "定位", "队列"],
        icon: ICON_INFO,
      },
    ],
  },
  {
    id: "business",
    title: "业务组件",
    icon: ICON_FILE,
    pages: [
      {
        href: "/demo/editor",
        title: "AI Editor 编辑器",
        en: "AI Editor",
        desc: "AI 辅助 Markdown / WYSIWYG 编辑器。",
        keywords: ["编辑器", "editor", "ai editor", "markdown", "wysiwyg", "AI"],
        icon: ICON_EDIT,
      },
    ],
  },
];

/* ---- 更新日志（头部导航） ---- */
export const CHANGELOG_PAGE: DocPage = {
  href: "/demo/changelog",
  title: "更新日志",
  en: "Changelog",
  desc: "青梧 UI 的版本历史与更新内容。",
  keywords: ["更新日志", "changelog", "版本", "release", "0.4.0"],
  icon: ICON_FILE,
};

/* ---- 头部中心导航 ---- */
export const HEADER_NAV: { label: string; href: string; match: (pathname: string) => boolean }[] = [
  { label: "指南", href: "/guide/install", match: (p) => p.startsWith("/guide") },
  { label: "组件", href: "/demo/button", match: (p) => p.startsWith("/demo") },
  { label: "更新日志", href: "/demo/changelog", match: (p) => p === "/demo/changelog" },
];

/* ---- 全站页面顺序（prev / next 依据） ---- */
export const DOC_FLOW: DocPage[] = [
  ...GUIDE_SECTION.pages,
  ...COMPONENT_SECTIONS.flatMap((s) => s.pages),
  CHANGELOG_PAGE,
];

/* ---- 搜索索引（title 为 SearchBox 主匹配字段，sub 承载全文内容） ---- */
export const SEARCH_ITEMS = DOC_FLOW.map((page) => {
  const kind = page.href.startsWith("/guide")
    ? "指南"
    : page.href === CHANGELOG_PAGE.href
      ? "更新日志"
      : "组件";
  return {
    title: page.title,
    sub: [page.desc, ...page.keywords].join(" · "),
    kind,
    glyph: page.title.slice(0, 1),
  };
});

export const HREF_BY_TITLE = new Map(DOC_FLOW.map((p) => [p.title, p.href]));

/* ---- 查找工具 ---- */
export function findPage(href: string): DocPage | undefined {
  return DOC_FLOW.find((p) => p.href === href);
}

export function findPrevNext(href: string): { prev?: DocPage; next?: DocPage } {
  const i = DOC_FLOW.findIndex((p) => p.href === href);
  if (i < 0) return {};
  return { prev: DOC_FLOW[i - 1], next: DOC_FLOW[i + 1] };
}
