# @qingwu/search

[青梧UI](https://github.com/qingwu-team/qingwu-ui) 的 **搜索框 / 命令面板组件** —— 框架无关，纯 DOM + CSS，零依赖。

- 自渲染：触发条 → 模态面板 → 结果列表 → toast，一行 `new SearchBox(el)` 即用
- 打字机轮播占位提示（自动尊重 `prefers-reduced-motion`）
- 键盘优先：`Ctrl/⌘ + K` 或 `/` 全局唤起，方向键导航、Enter 选择、Esc 关闭、Tab 焦点陷阱
- 无障碍内建：`role="dialog"` / `combobox` / `listbox` + `aria-activedescendant` 完整语义
- 分类筛选、关键词高亮、结果入场动画

## 安装

```bash
npm install @qingwu/search
# or: pnpm add @qingwu/search / bun add @qingwu/search
```

## 使用

```ts
import { SearchBox } from "@qingwu/search";
import "@qingwu/search/style.css";

const box = new SearchBox(document.getElementById("search")!, {
  placeholders: ["搜索节日、节气或功能…", "试试「中秋」", "试试「霜降」"],
  categories: ["全部", "节日", "节气", "功能", "日期"],
  items: [
    { title: "中秋节", sub: "农历八月十五", kind: "节日", glyph: "秋" },
    { title: "霜降", sub: "秋季最后一个节气", kind: "节气" },
  ],
  onSelect: (item) => console.log("selected:", item.title),
  onQueryChange: (query) => console.log("query:", query),
});

// 组件销毁时释放全部资源（定时器、document 级监听）
box.destroy();
```

### 按需导入打字机引擎

```ts
import { Typewriter } from "@qingwu/search";

const tw = new Typewriter(el, ["第一句", "第二句"], { typeMs: 80, holdFull: 1500 });
tw.start();
// tw.stop(); tw.destroy();
```

## API

### `new SearchBox(root, options?)`

| 选项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `placeholders` | `string[]` | `["搜索…"]` | 打字机轮播词 |
| `items` | `SearchItem[]` | `[]` | 可搜索条目（`title` 必填，`sub`/`kind`/`glyph` 可选） |
| `categories` | `string[]` | `["全部","节日","节气","功能","日期"]` | 筛选类别，首项为「全部」 |
| `onSelect` | `(item) => void` | — | 选中回调 |
| `onQueryChange` | `(query) => void` | — | 输入变化回调（可接异步搜索） |
| `typewriter` | `boolean` | `true` | 是否启用轮播动画 |
| `trigger` | `boolean` | `true` | 是否渲染内置触发条；`false` 时由宿主自定义入口，全局快捷键 `⌘K`/`/` 仍生效 |

实例方法：`open()` / `close()` / `destroy()`。

### 挂载容器要求

`root` 必须是**始终可见且处于正常文档流**的元素：

- 不要给 root 加 `display: none`——遮罩/面板/trigger 全部 append 进 root 内部，root 一隐藏面板全灭
- 不要放在带 `transform` / `filter` / `backdrop-filter` 的祖先内——遮罩是 `position: fixed`，这些属性会把它截断在祖先的包含块内（典型症状：面板只出现在 header 那几十像素里）
- 推荐做法：React/Vue 中用 portal 挂到 `document.body`（SSR 场景加 mounted 守卫，避免水合错位）；原生 JS 则把 root 直接放在 body 下
- 宿主想用自己的触发按钮时，设 `trigger: false` 并自行调用 `open()`（全局快捷键不受影响），不要再依赖 CSS 隐藏 `.qs-trigger`

### 样式

单独导出 `@qingwu/search/style.css`（`sideEffects` 已标注，不引入即不进 bundle）。类名前缀 `qs-`，覆盖样式直接针对 `--qs-*` 之外的原始类名即可。暗色主题同时支持 `<html data-theme="dark">` 与 `.dark` 类（Tailwind / Next.js 常见约定）。

## 产物

- ESM + CJS + 类型声明（TS7 生成），体积预算 gzip ≤ 12 kB（当前约 4 kB）
- 支持 `prefers-reduced-motion`、`forced-colors` 友好

## 许可证

[MIT](./LICENSE) © Qingwu UI Contributors
