# @qingwu/search

## 0.6.0

### Patch Changes

- 版本统一对齐 0.6.0（无功能变更；`@qingwu/tag-input` 随本版首次发布）

## 0.5.0

### Minor Changes

- 新增 **关闭按钮**（输入条最右侧，关闭整个面板），清空键 ⌫ 移入输入框内部、有文字时浮现
  - 遮罩与 toast 挂载到 `document.body`：脱离宿主 DOM，避免宿主的 transform/filter/overflow 把 fixed 定位污染成包含块裁剪
  - `destroy()` 完整清理 overlay/toast，防止残留

## 0.4.0

### Patch Changes

- 版本统一对齐至 0.4.0

## 0.3.1

### Patch Changes

- 版本统一对齐 0.3.1。工程级更新：发版流程接入 `bun run publish-check` 产物校验门禁（workspace 依赖残留 / CHANGELOG 版本一致 / exports 产物齐全）；新增 Playwright e2e（拖拽上传、压缩产出 WebP/AVIF、单张限制、按钮触发、真实上传）；README 同步 0.3.0 状态与 upload 组件文档。

## 0.3.0

### Minor Changes

- 版本统一对齐 0.3.0，API 完全兼容，无行为变更。

## 0.2.0

### Minor Changes

- 版本统一对齐 0.2.0，API 与 0.1.0 完全兼容，无破坏性变更。框架无关搜索框 / 命令面板组件：打字机占位轮播、`Ctrl/⌘+K` 与 `/` 全局唤起、全键盘导航 + 焦点陷阱、ARIA dialog/combobox/listbox 完整语义、分类筛选、关键词高亮、`destroy()` 完整资源释放。`Typewriter` 打字机组件随主入口一并导出。样式经 `@qingwu/search/style.css` 子路径单独导出。

## 0.1.0

### Minor Changes

- 首个公开版本 0.1.0。

  - `@qingwu/calendar-core`：headless 日历引擎基座 —— 本地时区语义的纯日期工具（`startOfDay` / `toISODate` / `addDays` / `isSameDay` / `compareDay`）与 v0 类型契约（`CalendarOptions` / `ViewMode` / `SelectionMode` / `DayMeta`）。零依赖、零 DOM 副作用、完全可 tree-shake。
  - `@qingwu/search`：框架无关搜索框 / 命令面板组件 —— 打字机占位轮播、`Ctrl/⌘+K` 与 `/` 全局唤起、全键盘导航 + 焦点陷阱、ARIA dialog/combobox/listbox 完整语义、分类筛选、关键词高亮、`destroy()` 完整资源释放，样式经 `@qingwu/search/style.css` 子路径单独导出。
