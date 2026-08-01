# @qingwu/calendar

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
