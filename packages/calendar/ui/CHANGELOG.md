# @qingwu/calendar

## 0.7.2

### Patch Changes

- popover 形态详情改为**面板右侧内嵌**（复用 `qw-cal-side` 详情栏，窄版 240px），删除第二层 `qw-cal-detail-pop` 悬浮浮层。交互变更：打开即展示当前选中日期详情，点日期只更新选中与详情**不收起**（点外部 / Esc 收起），`onChange` 实时回发完整 `YYYY-MM-DD HH:mm:ss`。面板宽度 = 触发区宽 + 详情栏宽（激活时），日期格保持原尺寸不被挤占；移动端（≤700px）详情栏收起，保持窄面板。

## 0.7.1

### Patch Changes

- 修复 popover 形态浮层被宿主 `overflow`/`transform` 容器裁剪的问题：浮层改为 `position: fixed` 挂到 `document.body`，锚定与向上翻由 JS 按输入框位置计算（width 跟随输入框、左缘对齐、空间不足向上翻）。滚动即收起逻辑不变。

## 0.7.0

### Minor Changes

- 新增 `mode: 'popover'` 形态：锚定输入框下方的紧凑浮层（无遮罩、不锁 body 滚动、宽度跟随输入框；下方空间不足自动向上翻；滚动即收起）。popover 下点日期即选中并收起，`onChange` 回发完整 `YYYY-MM-DD HH:mm:ss`；配合 `showDetailPanel` 时，选中后弹出第二层详情浮层展示该日黄历信息。`mode` 缺省保持 `'modal'` 全屏弹窗原行为。

## 0.6.0

### Patch Changes

- 版本统一对齐 0.6.0（无功能变更；`@qingwu/tag-input` 随本版首次发布）

## 0.5.0

### Minor Changes

- 版本统一对齐 0.5.0（无功能变更；repository/homepage/bugs 统一为 apricotdream/qingwu-ui）

## 0.3.1

### Patch Changes

- 版本统一对齐 0.3.1。工程级更新：发版流程接入 `bun run publish-check` 产物校验门禁（workspace 依赖残留 / CHANGELOG 版本一致 / exports 产物齐全）；新增 Playwright e2e（拖拽上传、压缩产出 WebP/AVIF、单张限制、按钮触发、真实上传）；README 同步 0.3.0 状态与 upload 组件文档。

## 0.3.0

### Minor Changes

- 版本统一对齐 0.3.0，API 完全兼容，无行为变更。
- **合并 `@qingwu/calendar-core` 入 `@qingwu/calendar`**：core 包仅有 5 个日期工具且本包仅引用其 `DayMeta` 类型（dayRenderer/RichDayMeta/selectedDetail 均为从未生效的死代码），判定独立包无必要，删除 core 包。

  - 移除 `CalendarUiOptions.dayRenderer` 选项与 `RichDayMeta` 导出类型
  - `@qingwu/calendar-core` 不再发布，日期工具与类型契约不再对外提供

## 0.2.0

### Minor Changes

- 首个公开版本 0.2.0。自渲染日历组件 `Calendar` —— 农历（`solarToLunar` / `lunarToSolar` / `formatLunarDate` / `getLunarMonthName` / `getLunarDayName` / `getYearGanzhi`）、二十四节气（`getSolarTerm` / `getNearbySolarTerms` / `getSolarTermDetail`）、节日（`getLunarFestival` / `getSolarFestival`）与黄历宜忌（`getAlmanac`）。框架无关、零 DOM 副作用，样式经 `@qingwu/calendar/style.css` 子路径单独导出；运行时依赖 `@qingwu/calendar-core`（`^0.2.0`）。
