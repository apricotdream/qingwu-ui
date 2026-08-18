# @qingwu-ui/calendar
## 0.9.1-beta.0

### Minor Changes

- 新增 `detailPosition` 选项：控制详情面板悬浮方式 —— `right`（默认，右侧展开、面板加宽）/ `left`（左侧展开、面板向左加宽、网格锚点不变）/ `inside`（面板内右缘覆盖浮层、不改变面板/网格宽度）。
- 修复窄输入框/小屏下日期网格右侧列被 popover overlay 裁剪的问题：日期格允许收缩、overlay 放开裁剪、面板宽度跟随实际尺寸。
- 修复详情侧栏宽度过渡中间值导致面板宽度测量不准；点击日期/关闭详情后重新锚定。
- 操作栏钉在面板底部（sticky + 置顶），详情浮层展开时确认/取消按钮始终可见可点。

### Minor Changes

- 新增 `dateOnly` 选项：仅选日期模式，隐藏时分秒时间行，`onChange` 回发 `YYYY-MM-DD`（默认仍回发完整 `YYYY-MM-DD HH:mm:ss`）。适用于截止日期、生日等纯日期场景；`input`/`getSelectedDate`/取消回滚同步为 date-only 格式。无破坏性变更。

## 0.8.0

### Minor Changes

- 版本统一对齐 0.8.0（无功能变更；所有 @qingwu 包版本对齐）


## 0.7.4

### Patch Changes

- 面板高度全面钳制进视口，**内容溢出时内部可滚**，任何视口尺寸下面板不再有不可达区域：
  - **popover**：锚定算法升级——下方放不下上翻；两侧都放不下时选空间更大的一侧，并以内联 `max-height` 钳制面板高度（原先上翻后 top 钳制在 8px，面板底部被视口裁切不可达）。
  - **modal**：面板新增 `max-height: calc(100vh - 84px)`（移动端底部 sheet 放宽至 `calc(100vh - 24px)`），遮罩增加兜底 `overflow-y: auto`（应对移动端 `100vh` 大于可视 viewport 的情形）。
  - 被钳制时主区（网格+时间+操作栏）`.qw-cal-main` 整体可滚；详情栏 `.qw-cal-detail` 原已 `overflow-y: auto`，现可随面板高度收缩（侧栏改列向 flex，`min-height: 0`），不再被 `overflow: hidden` 裁掉。
  - 无 API 变更；详情栏既有的 `max-height`（modal 500px / popover 480px / 移动端 300px）保留为内容上限。

## 0.7.3

### Patch Changes

- 确认/取消改为**统一提交制**（modal 与 popover 语义拉齐）：点日期 / 改时间只更新面板内部状态，**点「确认」（或 Enter）才回发 `onChange`**（完整 `YYYY-MM-DD HH:mm:ss`）并收起；「取消」/ Esc / 点面板外部 / 滚动收起（popover）一律回滚到打开前状态且不回发。popover 形态因此也渲染底部「取消 / 确认」操作栏（紧凑尺寸）。**行为变更提示**：modal 原点日期实时回发 date-only `onChange` 的行为取消；popover 原点日期实时回发 datetime 的行为取消。
- 修复 popover 形态点面板内任意处（日期格、时间框、按钮等）会误收起的问题：文档级 mousedown 外部点击判定此前只排除了触发区 `root`，未排除挂在 `document.body` 上的浮层本体。

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

- 版本统一对齐 0.6.0（无功能变更；`@qingwu-ui/tag-input` 随本版首次发布）

## 0.5.0

### Minor Changes

- 版本统一对齐 0.5.0（无功能变更；repository/homepage/bugs 统一为 apricotdream/qingwu-ui）

## 0.3.1

### Patch Changes

- 版本统一对齐 0.3.1。工程级更新：发版流程接入 `bun run publish-check` 产物校验门禁（workspace 依赖残留 / CHANGELOG 版本一致 / exports 产物齐全）；新增 Playwright e2e（拖拽上传、压缩产出 WebP/AVIF、单张限制、按钮触发、真实上传）；README 同步 0.3.0 状态与 upload 组件文档。

## 0.3.0

### Minor Changes

- 版本统一对齐 0.3.0，API 完全兼容，无行为变更。
- **合并 `@qingwu-ui/calendar-core` 入 `@qingwu-ui/calendar`**：core 包仅有 5 个日期工具且本包仅引用其 `DayMeta` 类型（dayRenderer/RichDayMeta/selectedDetail 均为从未生效的死代码），判定独立包无必要，删除 core 包。

  - 移除 `CalendarUiOptions.dayRenderer` 选项与 `RichDayMeta` 导出类型
  - `@qingwu-ui/calendar-core` 不再发布，日期工具与类型契约不再对外提供

## 0.2.0

### Minor Changes

- 首个公开版本 0.2.0。自渲染日历组件 `Calendar` —— 农历（`solarToLunar` / `lunarToSolar` / `formatLunarDate` / `getLunarMonthName` / `getLunarDayName` / `getYearGanzhi`）、二十四节气（`getSolarTerm` / `getNearbySolarTerms` / `getSolarTermDetail`）、节日（`getLunarFestival` / `getSolarFestival`）与黄历宜忌（`getAlmanac`）。框架无关、零 DOM 副作用，样式经 `@qingwu-ui/calendar/style.css` 子路径单独导出；运行时依赖 `@qingwu-ui/calendar-core`（`^0.2.0`）。
