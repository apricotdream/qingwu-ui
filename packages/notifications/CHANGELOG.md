# @qingwu-ui/notifications

## 0.9.0-beta.2
### Patch Changes

- 修复左侧徽标（glyph）传入长文本（如 "system"）时溢出 30px 方块、与右侧标题重叠错位的问题：纯拉丁 ≤2 字符大写保留（"ai"→"AI"），超长取首字母（"system"→"S"），中日韩及混合文本取首字符；完整值经 `title` 属性悬停可见
- 徽标补充 `overflow: hidden; white-space: nowrap` 溢出兜底；拉丁字符改用 UI 字体（楷体拉丁字形怪异）

## 0.9.0-beta.1
### Patch Changes

- 面板定位改右对齐：悬浮框从铃铛左侧展开（面板右缘对齐铃铛右缘、向左展开），铃铛位于头部右侧时面板不再探出视口右缘；面板过宽时仍右贴视口钳制

## 0.9.0-beta
### Minor Changes

- 新增 @qingwu-ui/notifications 通知铃铛组件：铃铛触发器 + 未读红点徽标 + 手风琴错峰下拉面板，ARIA menu/menuitem 全键盘导航，空态 / 自定义渲染 / 受控更新 / 向上翻转
- 首次发布（随 12 包 0.9.0 全量对齐，以 @qingwu-ui scope 上线）
