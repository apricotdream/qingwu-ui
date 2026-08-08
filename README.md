# 青梧UI (Qingwu UI)

以**中国历法（农历 / 节气 / 节假日 / 调休）**为核心差异化、以**无障碍**为底线、框架无关的开源组件库。

- 🪶 **零依赖** —— 纯 TypeScript + 原生 DOM，不绑定任何框架
- ♿ **无障碍内建** —— ARIA dialog / combobox / listbox 语义，全键盘可用（方向键导航、`Esc` / 遮罩关闭、焦点进出管理）
- 🌗 **动效克制** —— 自动响应 `prefers-reduced-motion`
- 📦 **按需引入** —— ESM + CJS 双产物，`sideEffects` 精确标注，完全可 tree-shake

> 完整产品规划见 [REFACTOR_PLAN.md](./REFACTOR_PLAN.md)。

---

## 包列表

| 包名 | 说明 | 版本 | gzip |
|---|---|---|---|
| [`@qingwu/calendar`](./packages/calendar/ui) | 自渲染日历：农历 / 节气 / 节日 / 黄历宜忌 | 0.3.0 | — |
| [`@qingwu/search`](./packages/search) | 搜索框 / 命令面板：打字机占位轮播、全键盘导航、分类筛选 | 0.3.0 | ~4 kB |
| [`@qingwu/button`](./packages/button) | 胶囊形按钮：default / primary / amber / icon | 0.3.0 | — |
| [`@qingwu/upload`](./packages/upload) | 图片上传：拖拽 / 按钮触发、客户端压缩（原图 / WebP / AVIF）、独立进度条 | 0.3.0 | ~4 kB |
| [`@qingwu/ai-editor`](./packages/ai-editor) | 面向中文用户的 AI 智能编辑器 | 0.3.0 | — |

## 安装

```bash
# npm
npm install @qingwu/calendar @qingwu/search @qingwu/upload

# pnpm
pnpm add @qingwu/calendar @qingwu/search @qingwu/upload

# yarn
yarn add @qingwu/calendar @qingwu/search @qingwu/upload

# bun
bun add @qingwu/calendar @qingwu/search @qingwu/upload
```

> 当前 0.3.0 先行发布在内网私有 registry，安装时需指定：
> `npm install @qingwu/upload --registry http://192.168.3.8:8081/repository/npm-all/`

---

## 快速上手：@qingwu/search

自渲染的搜索框 / 命令面板：触发条 → 模态面板 → 结果列表 → toast，挂载即用。

### 基础用法

```ts
import { SearchBox } from "@qingwu/search";
import "@qingwu/search/style.css"; // 样式为独立子路径导出，不引入不进 bundle

const box = new SearchBox(document.getElementById("search")!, {
  items: [
    { title: "中秋节", sub: "农历八月十五", kind: "节日", glyph: "秋" },
    { title: "霜降", sub: "秋季最后一个节气", kind: "节气" },
    { title: "今日宜忌", sub: "打开黄历速查", kind: "功能" },
  ],
  onSelect: (item) => console.log("选中：", item.title),
});
```

组件自己渲染触发按钮与弹层，挂载点只需一个空容器（如 `<div id="search"></div>`）。

### 快捷键

| 按键 | 行为 |
|---|---|
| `Ctrl/⌘ + K` | 全局唤起 / 收起面板 |
| `/` | 唤起面板（输入框聚焦时不触发） |
| `↑` / `↓` | 在结果间移动 |
| `Enter` | 选中当前高亮项 |
| `Esc` | 有输入先清空，无输入则关闭 |
| `Tab` | 面板内焦点循环（焦点陷阱） |

### 属性（SearchOptions）

`new SearchBox(root: HTMLElement, options?: SearchOptions)`

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `placeholders` | `string[]` | `["搜索…"]` | 打字机轮播的占位提示词 |
| `items` | [`SearchItem[]`](#数据条目searchitem) | `[]` | 可搜索条目集合 |
| `categories` | `string[]` | `["全部", "节日", "节气", "功能", "日期"]` | 筛选类别，**首项视为「全部」** |
| `onSelect` | `(item: SearchItem) => void` | — | 选中条目回调 |
| `onQueryChange` | `(query: string) => void` | — | 输入变化回调，可在此接异步搜索 |
| `typewriter` | `boolean` | `true` | 是否启用占位词轮播动画 |

### 数据条目（SearchItem）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | `string` | ✔ | 主标题，参与匹配与高亮 |
| `sub` | `string` | — | 副标题，参与匹配与高亮 |
| `kind` | `string` | — | 类别标签，需与 `categories` 对应才可被筛选命中 |
| `glyph` | `string` | — | 左侧图标字符，缺省取 `title` 首字 |

### 实例方法

| 方法 | 说明 |
|---|---|
| `open()` | 打开面板（幂等） |
| `close()` | 关闭面板，焦点归还触发前元素 |
| `destroy()` | 销毁组件：清理定时器与全部 document 级监听、清空 DOM |

### 样式定制

- 样式经 `@qingwu/search/style.css` 单独导出，类名统一 `qs-` 前缀
- 尊重 `prefers-reduced-motion`：开启后自动退化为静态占位、无入场动画

### 单独使用打字机引擎

```ts
import { Typewriter } from "@qingwu/search";

const tw = new Typewriter(el, ["第一句", "第二句", "第三句"], {
  typeMs: 80,     // 逐字打入间隔 ms，默认 80
  delMs: 38,      // 逐字删除间隔 ms，默认 38
  holdFull: 1500, // 全文停顿 ms，默认 1500
  holdEmpty: 320, // 空文停顿 ms，默认 320
  reduced: false, // true 时静态显示首条，零定时器
});

tw.start();   // 启动（幂等）
tw.stop();    // 暂停
tw.destroy(); // 销毁，清理定时器
```

---

## 快速上手：@qingwu/upload

自渲染的图片上传组件：拖拽 / 按钮触发 → 客户端压缩 → 逐项进度条上传，挂载即用。

### 基础用法

```ts
import { ImageUpload } from "@qingwu/upload";
import "@qingwu/upload/style.css"; // 样式为独立子路径导出；按钮触发形态样式已内置

const uploader = new ImageUpload(document.getElementById("upload")!, {
  trigger: "dropzone",                  // "dropzone" 拖拽区 | "button" 按钮（复用 @qingwu/button）
  url: "/api/upload",                   // 内置 XHR 上传（upload.onprogress 真实进度）
  compress: true,                       // 压缩总开关
  formats: ["original", "webp", "avif"], // 输出格式，可三选一 / 都要
  quality: 0.8,
  maxSizeMB: 10,                        // 单张大小上限
  maxCount: 3,                          // 数量上限（0 不限）
  onSuccess: (item) => console.log("完成：", item.name, item.format),
});
```

### 压缩与格式

- 每张图按 `formats` 配置产出多份（原图 / WebP / AVIF），每份独立上传项、独立进度条
- AVIF 编码仅 Chromium 系支持，不可用时按 **WebP → PNG** 自动降级
- GIF / SVG 不支持压缩，按原图上传（标注「不压缩」）
- `createImageBitmap` 解码自动修正 EXIF 方向，超出 `maxWidth` / `maxHeight` 等比缩放

### 属性（UploadOptions）

`new ImageUpload(root: HTMLElement, options?: UploadOptions)`

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `trigger` | `"dropzone" \| "button"` | `"dropzone"` | 触发形态；button 复用 `@qingwu/button` 样式（随 style.css 合并导出） |
| `accept` | `string[]` | `["image/*"]` | 接受的 MIME 类型 |
| `supportedFormats` | `string[]` | 全支持 | 支持的图片格式白名单（无点扩展名，如 `"jpg"`、`"png"`、`"webp"`、`"gif"`、`"avif"`）；指定后映射为 input accept 并驱动提示文案，显式传 `accept` 时以 `accept` 为准 |
| `multiple` | `boolean` | `true` | 是否允许多选 / 多拖 |
| `maxCount` | `number` | `0` | 上传项总数上限，0 不限 |
| `maxSizeMB` | `number` | `10` | 单张文件大小上限 |
| `compress` | `boolean` | `true` | 压缩总开关，关闭时仅按原图上传 |
| `formats` | [`OutputFormat[]`](#输出格式outputformat) | `["original","webp","avif"]` | 输出格式，可三选一 / 都要 |
| `quality` | `number` | `0.8` | 压缩质量 0-1 |
| `maxWidth` / `maxHeight` | `number` | `2048` | 缩放上限（像素） |
| `url` | `string` | — | 内置 XHR 上传地址（与 `uploadFn` 二选一） |
| `fieldName` | `string` | `"file"` | FormData 字段名 |
| `headers` | `Record<string, string>` | — | 自定义请求头 |
| `uploadFn` | [`UploadFn`](#上传函数uploadfn) | — | 自定义上传函数，覆盖内置 XHR |
| `onStart` / `onProgress` / `onSuccess` / `onError` / `onChange` | 回调 | — | 事件回调（回调参数见 [UploadItem](#上传项uploaditem)） |

### 输出格式（OutputFormat）

`"original" | "webp" | "avif"` —— 原图格式保持、WebP / AVIF 为压缩产物；AVIF 不可编码时降级 WebP → PNG。

### 上传函数（UploadFn）

```ts
type UploadFn = (file: File, onProgress: (percent: number) => void) => Promise<void>;
```

不传 `url` 时传入 `uploadFn` 可完全接管上传（模拟进度、私有协议、对象存储直传皆可）。

### 上传项（UploadItem）

`file`、`name`、`mime`、`originalSize`、`size`（压缩后）、`format`、`status`（`pending | uploading | success | error`）、`progress`（0-100）、`preview`（缩略图 dataURL）、`skipped`（GIF/SVG 跳过压缩标记）。

### 实例方法

| 方法 | 说明 |
|---|---|
| `getItems()` | 当前全部上传项 |
| `remove(id)` | 移除上传项（上传中会中止请求） |
| `clear()` | 清空全部上传项 |
| `destroy()` | 销毁组件，释放对象 URL 与全部监听 |

---

## 快速上手：@qingwu/calendar

自渲染日历组件：输入框触发 → 弹出面板 → 农历 / 节气 / 节日 / 黄历详情，挂载即用。

### 基础用法

```ts
import { Calendar } from "@qingwu/calendar";
import "@qingwu/calendar/style.css"; // 样式为独立子路径导出，不引入不进 bundle

const cal = new Calendar(document.getElementById("calendar")!, {
  selected: "2026-07-29",
  onChange: (date) => console.log("选中：", date),
});
```

### 属性（CalendarUiOptions）

`new Calendar(root: HTMLElement, options?: CalendarUiOptions)`

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `selected` | `Date \| string` | 今天 | 初始选中日期 |
| `min` / `max` | `Date \| string` | — | 最小 / 最大可选日期 |
| `placeholder` | `string` | `"选择日期"` | 输入框占位文本 |
| `inputName` | `string` | — | 输入框 name 属性 |
| `onChange` | `(date: string) => void` | — | 选中日期回调 |
| `onOpenChange` | `(open: boolean) => void` | — | 面板开合回调 |
| `showDetailPanel` | `boolean` | `true` | 右侧农历 / 节气 / 节日 / 黄历详情面板 |
| `holidays` | `{ holidays?: string[]; workdays?: string[] }` | — | 法定节假日与调休补班日期（`YYYY-MM-DD`） |
| `dayMetaProviders` | [`DayMetaProvider[]`](#扩展接口provider) | 内置农历/休假 | 自定义日期格 meta（追加在内置之后，可覆盖小字 / 角标） |
| `panelProviders` | [`PanelProvider[]`](#扩展接口provider) | 内置详情 | 自定义详情面板内容块（追加在内置之后） |

### 实例方法

| 方法 | 说明 |
|---|---|
| `open()` / `close()` | 打开 / 关闭面板 |
| `getSelectedDate()` | 获取当前选中日期（含时分秒） |
| `setSelectedDate(date)` | 设置选中日期 |
| `destroy()` | 销毁组件，清理监听与 DOM |

### 视图与键盘

- 日 / 月 / 年三档视图，标题栏点击切换；`今天` 按钮快速回位
- 面板内时间选择（时:分:秒 + 零时 / 日终快捷键）
- `←` / `→` 翻页，`Esc` 关闭，点击遮罩关闭；面板打开时焦点移入「今天」按钮，关闭动画结束后焦点归还输入框
- 打开时面板从输入框方向"弱出"（锚定动画），自动响应 `prefers-reduced-motion`（降级为无动画）

### 扩展接口（Provider）

日历通过双接口开放内容扩展，**内置 Provider 默认注册**（农历 / 节日 / 节气小字、休工角标、详情面板），用户 Provider 追加在后——小字 / 角标以追加在后的为准，可覆盖内置。

**DayMetaProvider** —— 日期格 meta（同步）：

```ts
import { Calendar, type DayMetaProvider } from "@qingwu/calendar";

const birthdayProvider: DayMetaProvider = {
  id: "birthday",
  getDayMeta(date) {
    if (date.getMonth() === 7 && date.getDate() === 15) {
      return { sub: "生日", subClass: "is-festival" }; // 覆盖内置小字
    }
    return null;
  },
};

new Calendar(el, { dayMetaProviders: [birthdayProvider] });
```

**PanelProvider** —— 详情面板内容块（同步契约；异步内容自行处理加载 / 失败态，如天气卡片）：

```ts
import { Calendar, type PanelProvider } from "@qingwu/calendar";

const weatherProvider: PanelProvider = {
  id: "weather",
  render(date) {
    const box = document.createElement("div");
    box.className = "qw-detail-section";
    box.innerHTML = `<div class="qw-detail-label">天气</div>`;
    // 异步：先渲染骨架，再自行 fetch 并替换节点
    return box;
  },
};

new Calendar(el, { panelProviders: [weatherProvider] });
```

- `PanelProvider.render(date)` 仅在**选中日期变化**时重渲（打开面板时渲染一次选中日期；翻月不重渲，避免异步请求风暴）
- `destroy()` 会调用各 Provider 的 `destroy?.()` 钩子（用于清理定时器 / 监听）

### 节假日数据与更新机制

- 内置节假日 / 调休数据来源为**国务院办公厅历年放假安排通知**（公开政务数据），覆盖 2025–2027，逐年由维护者核对更新；文档内黄历宜忌为**简化示意数据**（非专业黄历），仅供参考，不作为行事依据。
- 官方每年 11–12 月发布次年安排后，通过更新 `packages/calendar/ui/src/data.ts` 完成年更；业务侧也可通过 `holidays` 属性在运行时传入自己的节假日 / 调休数据（优先级高于内置）。

---

## 在框架中使用

组件为原生 DOM 实现，React / Vue 仅需一层生命周期包装。

### React

```tsx
import { useEffect, useRef } from "react";
import { SearchBox, type SearchOptions } from "@qingwu/search";
import "@qingwu/search/style.css";

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

### Vue 3

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { SearchBox } from "@qingwu/search";
import "@qingwu/search/style.css";

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

> 官方薄包装 `@qingwu/calendar-react` / `@qingwu/calendar-vue` 在路线图中（见 [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) Phase 5）。

---

## 仓库结构

```
qingwu-ui/
├── packages/
│   ├── calendar/ui/     # @qingwu/calendar —— 自渲染日历组件
│   ├── search/          # @qingwu/search —— 搜索框 / 命令面板组件
│   ├── button/          # @qingwu/button —— 胶囊形按钮
│   ├── upload/          # @qingwu/upload —— 图片上传 / 客户端压缩组件
│   └── ai-editor/      # @qingwu/ai-editor —— AI 智能编辑器
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

- [x] 0.1.0 —— `@qingwu/search` 组件 + `@qingwu/calendar` 基础日期工具（calendar-core 已并入）
- [ ] 0.2.0 —— `@qingwu/calendar` 状态机（reducer 式 ViewState）、规则引擎、键盘导航
- [ ] 0.3.0 —— `@qingwu/calendar` 渲染层重构 + design tokens / `@layer` 主题体系
- [ ] 0.4.0 —— `@qingwu/lunar` 农历 / 节气 / 节假日数据管线
- [ ] 1.0.0 —— API 冻结、React / Vue 官方薄包装、文档站

## 许可证

[Apache-2.0](./LICENSE) © Qingwu UI Contributors —— 适用于本项目全部包（根目录与各包目录内的 `LICENSE` 均为 Apache-2.0 全文）。

