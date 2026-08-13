# 青梧UI (Qingwu UI)

> [English](./README.en.md) · 中文

为中文用户而生的组件库：**从农历黄历日历，到 AI 富文本编辑器**。

农历、节气、黄历宜忌、节假日调休——这些别家组件库很少认真做的中文场景，青梧做成了日历组件的一等公民；中文 AI 写作（DeepSeek / 通义千问 / OpenAI）、Obsidian 风格 Markdown、中英双语切换——这些中文用户真正高频的需求，青梧做成了开箱即用的 AI 编辑器。而围绕它们，是一套**零依赖、框架无关**的轻组件矩阵。

## 核心特性

- 🪶 **零依赖** —— 轻组件全部纯 TypeScript + 原生 DOM，不绑定任何框架，React / Vue 薄包装即用
- 🧠 **AI 为尖** —— `@apricotdream/ai-editor` 面向中文用户的 AI 富文本编辑器，附带浏览器剪藏扩展（Web Clipper）
- ♿ **无障碍内建** —— ARIA dialog / combobox / listbox / live region 语义，全键盘可用
- 🌗 **动效克制** —— 统一响应 `prefers-reduced-motion`
- 📦 **按需引入** —— ESM + CJS 双产物，`sideEffects` 精确标注，完全可 tree-shake

---

## 旗舰：@apricotdream/ai-editor —— 面向中文用户的 AI 富文本编辑器

基于 Tiptap + React 19，接入 Vercel AI SDK，一个组件获得完整写作工作台：

- **AI 智能辅助写作** —— 续写、润色、精简、扩写、修正、翻译、自定义指令
- **浏览器剪藏扩展** —— 配套青梧 Web Clipper（Chrome / Edge / Firefox），一键把网页剪藏为 Markdown 推回编辑器，AI 自动生成摘要与标签
- **媒体嵌入** —— 图片、视频（B站 / 直链 / 小红书）、音频、附件；**206+ 格式在线预览**（Office / PDF / CAD / 压缩包）
- **Markdown 粘贴** —— Obsidian 风格 `[[链接]]` / `![[图片]]` 语法支持
- **多存储后端** —— 本地 / 阿里云 OSS / 腾讯云 COS / S3，配置持久化
- **中英双语** —— 运行时一键切换，无需刷新

```tsx
import { QingWuAIEditor } from "@apricotdream/ai-editor";
import "@apricotdream/ai-editor/styles";

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
| [`@apricotdream/ai-editor`](./packages/ai-editor/README.md) | AI 富文本编辑器（Tiptap + React 19）+ Web Clipper 扩展 | 0.9.0-beta |
| [`@apricotdream/calendar`](./packages/calendar/ui/README.md) | 自渲染日历：农历 / 节气 / 节日 / 黄历宜忌 | 0.9.0-beta |
| [`@apricotdream/search`](./packages/search/README.md) | 搜索框 / 命令面板：打字机占位、全键盘导航、分类筛选 | 0.9.0-beta |
| [`@apricotdream/select`](./packages/select/README.md) | 下拉选择器：手风琴错峰动画、自适应翻转 | 0.9.0-beta |
| [`@apricotdream/toast`](./packages/toast/README.md) | Toast 通知：ARIA live region、Promise 链、队列管理 | 0.9.0-beta |
| [`@apricotdream/upload`](./packages/upload/README.md) | 图片上传：拖拽 / 按钮触发、客户端压缩（原图 / WebP / AVIF） | 0.9.0-beta |
| [`@apricotdream/button`](./packages/button/README.md) | 胶囊形按钮：default / primary / amber / icon | 0.9.0-beta |
| [`@apricotdream/tag-input`](./packages/tag-input/README.md) | 标签快捷插入：快捷栏 + 受控 / 非受控双模式 | 0.9.0-beta |
| [`@apricotdream/notifications`](./packages/notifications/README.md) | 通知铃铛：未读红点、手风琴错峰面板 | 0.9.0-beta |
| [`@apricotdream/action-menu`](./packages/action-menu/README.md) | 径向快捷操作菜单：扇形展开、FAB / 自定义触发 | 0.9.0-beta |
| [`@apricotdream/skeleton`](./packages/skeleton/README.md) | 运行时测量自动骨架屏，可快照静态 HTML（SSR） | 0.9.0-beta |
| [`@apricotdream/text-layout`](./packages/text-layout/README.md) | 文本排版引擎：Canvas 测量、虚拟滚动高度、多行截断 | 0.9.0-beta |

> **版本策略**：所有 `@apricotdream/*` 包统一版本号（当前 **0.9.0-beta**），无变更的包仅对齐版本号，保证全家桶依赖关系一致。

## 安装

全部包已发布至公开 npm registry，按需安装：

```bash
# 一键安装旗舰组合
npm install @apricotdream/ai-editor @apricotdream/calendar @apricotdream/search

# 按需任选
npm install @apricotdream/toast @apricotdream/select @apricotdream/upload
```

---

## 快速上手：@apricotdream/calendar

自渲染日历组件：输入框触发 → 弹出面板 → 农历 / 节气 / 节日 / 黄历详情，挂载即用。

```ts
import { Calendar } from "@apricotdream/calendar";
import "@apricotdream/calendar/style.css"; // 样式为独立子路径导出，不引入不进 bundle

const cal = new Calendar(document.getElementById("calendar")!, {
  selected: "2026-07-29",
  onChange: (date) => console.log("选中：", date),
});
```

> 完整 API（属性 / 实例方法 / Provider 扩展）见 [`@apricotdream/calendar`](./packages/calendar/ui/README.md)。

---

## 在框架中使用

轻组件为原生 DOM 实现，React / Vue 仅需一层生命周期包装：

```tsx
import { useEffect, useRef } from "react";
import { SearchBox, type SearchOptions } from "@apricotdream/search";
import "@apricotdream/search/style.css";

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
import { SearchBox } from "@apricotdream/search";
import "@apricotdream/search/style.css";

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

> 官方薄包装 `@apricotdream/calendar-react` / `@apricotdream/calendar-vue` 在路线图中（见下）。

---

## 仓库结构

```
qingwu-ui/
├── packages/
│   ├── ai-editor/       # @apricotdream/ai-editor —— AI 富文本编辑器 + Web Clipper 扩展
│   ├── calendar/ui/     # @apricotdream/calendar —— 自渲染日历（农历 / 节气 / 节日 / 黄历）
│   ├── search/          # @apricotdream/search —— 搜索框 / 命令面板
│   ├── select/          # @apricotdream/select —— 下拉选择器
│   ├── toast/           # @apricotdream/toast —— Toast 通知
│   ├── upload/          # @apricotdream/upload —— 图片上传 / 客户端压缩
│   ├── button/          # @apricotdream/button —— 胶囊形按钮
│   ├── tag-input/       # @apricotdream/tag-input —— 标签快捷插入
│   ├── notifications/   # @apricotdream/notifications —— 通知铃铛
│   ├── action-menu/     # @apricotdream/action-menu —— 径向快捷操作菜单
│   ├── skeleton/        # @apricotdream/skeleton —— 自动骨架屏
│   └── text-layout/     # @apricotdream/text-layout —— 文本排版引擎
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

## 发布

语义化版本，手动维护。**版本策略：多包统一版本号**（每次发版所有包对齐同一版本，无变更的包仅对齐版本号）。

```bash
# 1) 手动升级各包 version（package.json + CHANGELOG 首条）
# 2) 构建全部包 + 发布前校验（publish-check）
bun run release
```

发版前 `bun run publish-check` 自动校验：dist 无 `workspace:*` 依赖残留（`publish-check:fix` 一键替换）、CHANGELOG 首条版本与 package.json 一致、exports 声明产物齐全。

## 路线图

- [x] 0.1.0 – 0.8.0 —— 轻组件矩阵成型，`@apricotdream/ai-editor` AI 编辑器与 Web Clipper 扩展纳入全家桶
- [x] 0.9.0-beta —— `@apricotdream/calendar` 新增 `dateOnly` 纯日期模式；12 包版本统一对齐 0.9.0-beta，全部发布公开 npm
- [ ] 1.0.0 —— API 冻结、React / Vue 官方薄包装、文档站

## 许可证

[Apache-2.0](./LICENSE) © Qingwu UI Contributors —— 适用于本项目全部包（根目录与各包目录内的 `LICENSE` 均为 Apache-2.0 全文）。
