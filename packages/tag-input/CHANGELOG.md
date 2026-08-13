# @apricotdream/tag-input

## 0.9.0

### Minor Changes

- 版本统一对齐 0.9.0（无功能变更；首次以 @apricotdream scope 发布，@qingwu → @apricotdream 品牌迁移）

## 0.8.0

### Minor Changes

- 版本统一对齐 0.8.0（无功能变更；所有 @qingwu 包版本对齐）


## 0.6.2

### Patch Changes

- 修复 inline 模式下已选 chip 的零边距规则误伤快捷栏：`margin: 0` 收敛到 `.qti-inline .qti-input-wrap .qti-tag`，避免 `.qti-bar` 的快捷 chip 被清掉 margin 贴死在一起

## 0.6.0

### Minor Changes

- 首次发布：标签快捷插入组件 TagInput（framework-agnostic）
  - 输入框 + 下方标签快捷栏，点击标签自动填入输入框（默认逗号分隔，`formatInsert` 可自定义格式）
  - 已插入的标签从快捷栏消失，输入值中删除后自动重现（`parseTags` 驱动）
  - 受控 / 非受控双模式（`value`/`defaultValue`、`tags`/`defaultTags`、`update()` 外部同步）
  - `@apricotdream/text-layout` 的 `layoutChips` 驱动展开/收起（`maxRows` 折叠 + "+N 更多"）与标签栏高度
  - 全键盘可用：Tab / 方向键导航、Enter 插入；× 按钮移除快捷标签
  - **Apple tinted 风格** chip（teal 品牌 tint、Lucide xmark、按压反馈、暗色 systemGray6 适配）
  - `allowEnterCreate`：输入框回车将文本创建为新标签；`createTag()` 程序化创建
  - `inline`（chip-in-input）：已选标签 chip 内嵌输入框，× 删除即移除，回车添加已选
  - `maxTags`：输入值标签数量上限，超出后插入 / 回车添加被忽略
