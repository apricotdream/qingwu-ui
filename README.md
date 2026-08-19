# 青梧UI (Qingwu UI)

> [English](./README.en.md) · 中文

为中文用户而生的组件库：**从农历黄历日历，到 AI 富文本编辑器**。

农历、节气、黄历宜忌、节假日调休——这些别家组件库很少认真做的中文场景，青梧做成了日历组件的一等公民；中文 AI 写作（DeepSeek / 通义千问 / OpenAI）、Obsidian 风格 Markdown、中英双语切换——这些中文用户真正高频的需求，青梧做成了开箱即用的 AI 编辑器。而围绕它们，是一套**零依赖、框架无关**的轻组件矩阵。

## 核心特性

- 🪶 **零依赖** —— 轻组件全部纯 TypeScript + 原生 DOM，不绑定任何框架，React / Vue 薄包装即用
- 🧠 **AI 为尖** —— `@qingwu-ui/ai-editor` 面向中文用户的 AI 富文本编辑器，附带浏览器剪藏扩展（Web Clipper）
- ♿ **无障碍内建** —— ARIA dialog / combobox / listbox / live region 语义，全键盘可用
- 🌗 **动效克制** —— 统一响应 `prefers-reduced-motion`
- 📦 **按需引入** —— ESM + CJS 双产物，`sideEffects` 精确标注，完全可 tree-shake

---

## 旗舰：@qingwu-ui/ai-editor —— 面向中文用户的 AI 富文本编辑器

基于 Tiptap + React 19，接入 Vercel AI SDK，一个组件获得完整写作工作台：

- **AI 智能辅助写作** —— 续写、润色、精简、扩写、修正、翻译、自定义指令
- **浏览器剪藏扩展** —— 配套青梧 Web Clipper（Chrome / Edge / Firefox），一键把网页剪藏为 Markdown 推回编辑器，AI 自动生成摘要与标签
- **媒体嵌入** —— 图片、视频（B站 / 直链 / 小红书）、音频、附件；**206+ 格式在线预览**（Office / PDF / CAD / 压缩包）
- **Markdown 粘贴** —— Obsidian 风格 `[[链接]]` / `![[图片]]` 语法支持
- **多存储后端** —— 本地 / 阿里云 OSS / 腾讯云 COS / S3，配置持久化
- **中英双语** —— 运行时一键切换，无需刷新

```tsx
import { QingWuAIEditor } from "@qingwu-ui/ai-editor";
import "@qingwu-ui/ai-editor/styles";

<QingWuAIEditor
  placeholder="开始写作吧…"
  onChange={(html) => console.log(html)}
/>
```

完整文档（安装 / Props / AI 接入 / 剪藏扩展）见 [`packages/ai-editor/README.md`](./packages/ai-editor/README.md)。

---

## 包总览

| 包名 | 定位 | 版本 |
|---|---|---|
| [`@qingwu-ui/ai-editor`](./packages/ai-editor/README.md) | AI 富文本编辑器（Tiptap + React 19）+ Web Clipper 扩展 | 0.9.0-beta |
| [`@qingwu-ui/calendar`](./packages/calendar/ui/README.md) | 自渲染日历：农历 / 节气 / 节日 / 黄历宜忌 | 0.9.0-beta |
| [`@qingwu-ui/search`](./packages/search/README.md) | 搜索框 / 命令面板：打字机占位、全键盘导航、分类筛选 | 0.9.0-beta |
| [`@qingwu-ui/select`](./packages/select/README.md) | 下拉选择器：手风琴错峰动画、自适应翻转 | 0.9.0-beta |
| [`@qingwu-ui/toast`](./packages/toast/README.md) | Toast 通知：ARIA live region、Promise 链、队列管理 | 0.9.0-beta |
| [`@qingwu-ui/upload`](./packages/upload/README.md) | 图片上传：拖拽 / 按钮触发、客户端压缩（原图 / WebP / AVIF） | 0.9.0-beta |
| [`@qingwu-ui/button`](./packages/button/README.md) | 胶囊形按钮：default / primary / amber / icon | 0.9.0-beta |
| [`@qingwu-ui/tag-input`](./packages/tag-input/README.md) | 标签快捷插入：快捷栏 + 受控 / 非受控双模式 | 0.9.0-beta |
| [`@qingwu-ui/notifications`](./packages/notifications/README.md) | 通知铃铛：未读红点、手风琴错峰面板、未读响铃摆动 | 0.9.0-beta |
| [`@qingwu-ui/action-menu`](./packages/action-menu/README.md) | 径向快捷操作菜单：扇形展开、FAB / 自定义触发 | 0.9.0-beta |
| [`@qingwu-ui/skeleton`](./packages/skeleton/README.md) | 运行时测量自动骨架屏，可快照静态 HTML（SSR） | 0.9.0-beta |
| [`@qingwu-ui/text-layout`](./packages/text-layout/README.md) | 文本排版引擎：Canvas 测量、虚拟滚动高度、多行截断 | 0.9.0-beta |
| [`@qingwu-ui/carousel`](./packages/carousel/README.md) | 轮播图 / Hero：双层图分层入场（背景先滑入、角色再淡入上移）、文案逐行滑入、缩略图导航 | 0.9.0-beta |

> **版本策略**：所有 `@qingwu-ui/*` 包统一版本号（当前 **0.9.0-beta**），无变更的包仅对齐版本号，保证全家桶依赖关系一致。

## 安装

全部包已发布至公开 npm registry，按需安装：

```bash
# 一键安装旗舰组合
npm install @qingwu-ui/ai-editor @qingwu-ui/calendar @qingwu-ui/search

# 按需任选
npm install @qingwu-ui/toast @qingwu-ui/select @qingwu-ui/upload @qingwu-ui/carousel
```

---

## 快速上手：@qingwu-ui/calendar

自渲染日历组件：输入框触发 → 弹出面板 → 农历 / 节气 / 节日 / 黄历详情，挂载即用。

```ts
import { Calendar } from "@qingwu-ui/calendar";
import "@qingwu-ui/calendar/style.css"; // 样式为独立子路径导出，不引入不进 bundle

const cal = new Calendar(document.getElementById("calendar")!, {
  selected: "2026-07-29",
  onChange: (date) => console.log("选中：", date),
});
```

> 完整 API（属性 / 实例方法 / Provider 扩展）见 [`@qingwu-ui/calendar`](./packages/calendar/ui/README.md)。

---

## 快速上手：@qingwu-ui/carousel

轮播图 / Hero 组件：左侧视觉由「背景图 + 角色透明图」双层构成，背景先从左往右滑入、角色随后淡入上移；右列文案逐行从右往左滑入；底部缩略图条右对齐至左图右缘，点击即切换。

```ts
import { Carousel } from "@qingwu-ui/carousel";
import "@qingwu-ui/carousel/style.css"; // 样式为独立子路径导出

const carousel = new Carousel(document.getElementById("hero")!, {
  items: [
    {
      value: "01",
      title: "晨光",
      background: "/hero-01-bg.png",  // 背景图：先入场
      image: "/hero-01-char.png",     // 角色透明图：随后入场
    },
  ],
  autoplay: true,
  interval: 3800,
});

// carousel.next() / prev() / goTo(i) / update(...) / destroy()
```

> 完整 API（选项 / 数据模型 / 入场时序）见 [`@qingwu-ui/carousel`](./packages/carousel/README.md)。

---

## 在框架中使用

轻组件为原生 DOM 实现，React / Vue 仅需一层生命周期包装：

```tsx
import { useEffect, useRef } from "react";
import { SearchBox, type SearchOptions } from "@qingwu-ui/search";
import "@qingwu-ui/search/style.css";

export function QingwuSearch(props: SearchOptions) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const box = new SearchBox(ref.current, props);
    return () => box.destroy();
  }, []);

  return <div ref={ref} />;
}
```

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { SearchBox } from "@qingwu-ui/search";
import "@qingwu-ui/search/style.css";

const root = ref<HTMLElement>();
let box: SearchBox | undefined;

onMounted(() => {
  box = new SearchBox(root.value!, {
    items: [{ title: "中秋节", kind: "节日" }],
    onSelect: (item) => console.log(item.title),
  });
});
onUnmounted(() => box?.destroy());
</script>

<template>
  <div ref="root" />
</template>
```

> 官方薄包装 `@qingwu-ui/calendar-react` / `@qingwu-ui/calendar-vue` 在路线图中（见下）。

---

## 仓库结构

```
qingwu-ui/
├── packages/
│   ├── ai-editor/       # @qingwu-ui/ai-editor —— AI 富文本编辑器 + Web Clipper 扩展
│   ├── calendar/ui/     # @qingwu-ui/calendar —— 自渲染日历（农历 / 节气 / 节日 / 黄历）
│   ├── search/          # @qingwu-ui/search —— 搜索框 / 命令面板
│   ├── select/          # @qingwu-ui/select —— 下拉选择器
│   ├── toast/           # @qingwu-ui/toast —— Toast 通知
│   ├── upload/          # @qingwu-ui/upload —— 图片上传 / 客户端压缩
│   ├── button/          # @qingwu-ui/button —— 胶囊形按钮
│   ├── tag-input/       # @qingwu-ui/tag-input —— 标签快捷插入
│   ├── notifications/   # @qingwu-ui/notifications —— 通知铃铛
│   ├── action-menu/     # @qingwu-ui/action-menu —— 径向快捷操作菜单
│   ├── skeleton/        # @qingwu-ui/skeleton —— 自动骨架屏
│   ├── carousel/        # @qingwu-ui/carousel —— 轮播图（双层图分层入场 / 缩略图导航）
│   └── text-layout/     # @qingwu-ui/text-layout —— 文本排版引擎
├── examples/nextjs/     # Next.js 演示站（组件 demo 与配置面板）
├── tooling/
│   ├── tsconfig/        # TS7 共享配置
│   └── publish-check/   # 发版前产物校验（workspace 依赖 / 版本一致 / 产物齐全）
└── REFACTOR_PLAN.md     # 完整重构方案（排查 / 调研 / 架构 / 分阶段计划）
```

## 本地开发

环境要求：[Bun](https://bun.sh) ≥ 1.3、Node ≥ 20。

```bash
bun install        # 安装依赖
bun run ci         # lint + build + typecheck + test + size 全链路
bun run build      # 构建全部包
bun run test       # 运行 vitest 测试
```

技术基线：TypeScript 7 · tsdown (Rolldown) · Bun + Turborepo · Biome · vitest · size-limit。

## 在线演示

组件演示站部署在 GitHub Pages（仅静态托管，由 `.github/workflows/pages.yml` 在 **push 到 main** 时自动构建导出并部署）：

- **演示站：<https://apricotdream.github.io/qingwu-ui/>**
- 部署入口页：https://github.com/apricotdream/qingwu-ui/actions（`Pages` 工作流）
- 说明：
  - 静态导出（`output: export`），部署于 `/qingwu-ui/` 子路径（`basePath`）；代码中引用公共资源须经 `examples/nextjs/lib/assets.ts` 的 `asset()` 助手（配合 `NEXT_PUBLIC_BASE_PATH` 环境变量，本地开发无需设置）
  - 静态站不支持 API 路由：`/api/upload`（上传演示）、`/api/preview`（S3 预览代理）在线上不可用，页面本身正常渲染
  - 本地预览完整功能（含 API）：`cd examples/nextjs && bun run dev` 后访问 http://localhost:3000

## 发布

语义化版本，手动维护。**版本策略：多包统一版本号**（每次发版所有包对齐同一版本，无变更的包仅对齐版本号）。

```bash
# 1) 手动升级各包 version（package.json + CHANGELOG 首条）
# 2) 构建全部包 + 发布前校验（publish-check）
bun run release
```

发版前 `bun run publish-check` 自动校验：dist 无 `workspace:*` 依赖残留（`publish-check:fix` 一键替换）、CHANGELOG 首条版本与 package.json 一致、exports 声明产物齐全。

### 双远端推送（gitee + github）

源码仓库同时托管于 gitee（origin）与 github，提交后一条命令推送到两端：

```bash
bun run push:all   # 等价于 git push origin HEAD && git push github HEAD
```

首次使用需先注册 github 远端（已在本仓库配置）：

```bash
git remote add github git@github.com:apricotdream/qingwu-ui.git
```

## 路线图

- [x] 0.1.0 – 0.8.0 —— 轻组件矩阵成型，`@qingwu-ui/ai-editor` AI 编辑器与 Web Clipper 扩展纳入全家桶
- [x] 0.9.0 —— `@qingwu-ui/calendar` 新增 `dateOnly` 纯日期模式；13 包版本统一对齐 0.9.0-beta（含新成员 `@qingwu-ui/carousel`），全部发布公开 npm
- [ ] 1.0.0 —— API 冻结、React / Vue 官方薄包装、文档站

## 许可证

[Apache-2.0](./LICENSE) © Qingwu UI Contributors —— 适用于本项目全部包（根目录与各包目录内的 `LICENSE` 均为 Apache-2.0 全文）。
