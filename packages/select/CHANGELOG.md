# @qingwu-ui/select

## 0.9.0-beta.1
### Minor Changes

- 新增 `frosted` 选项（默认 `true`）：面板半透明磨砂质感（半透明底 + `backdrop-filter` 毛玻璃）；设为 `false` 回退不透明实体面板。`update({ frosted })` 可动态切换
- 演示页 `demo.html`：磨砂面板 vs 不透明面板 + 切换按钮（`bun run build:browser` 后打开）

## 0.9.0-beta
### Minor Changes

- 版本统一对齐 0.9.0（无功能变更；首次以 @qingwu-ui scope 发布，@qingwu → @qingwu-ui 品牌迁移）

## 0.8.0

### Minor Changes

- 版本统一对齐 0.8.0（无功能变更；所有 @qingwu 包版本对齐）


## 0.7.0

### Minor Changes

- **首发**：框架无关下拉选择器（`@qingwu-ui/select`）
  - 单选 · 手风琴错峰展开动画（选项像琴键逐项按下，向上展开反向级联）
  - 选项禁用（置灰、点击无效、键盘导航跳过）+ 整体禁用
  - 向上/向下自适应翻转（贴近视口底边自动向上弹）
  - 选项数超过 `maxStagger`（默认 12）自动降级为整体淡入
  - 键盘导航（↑↓ Home End Enter Esc Tab）+ 完整 ARIA combobox/listbox/option

### Patch Changes

- **悬浮反馈升级**：选项悬浮时「底色 + 轻微上浮 + 右侧 `›` 箭头」；选中项悬浮放大对勾。悬浮改为纯 `:hover` 视觉（跟手不粘滞），不再写死键盘焦点态 `is-active`（键盘导航才更新）
- 错峰动画结束帧不再锁定 transform，避免覆盖悬浮上浮效果
