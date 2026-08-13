# @qingwu-ui/action-menu

## 0.9.0-beta
### Minor Changes

- 版本统一对齐 0.9.0（无功能变更；首次以 @qingwu-ui scope 发布，@qingwu → @qingwu-ui 品牌迁移）

## 0.8.0

### Minor Changes

- 版本统一对齐 0.8.0（无功能变更；所有 @qingwu 包版本对齐）


## 0.7.0

### Minor Changes

- **首发**：框架无关扇形动作菜单（`@qingwu-ui/action-menu`）
  - 悬浮展开扇形 · 两段式披露：打开仅显示图标，hover 扇区沿切向伸出该扇区 label（旋转钳制 ±45° 保证可读）
  - hover 扇区不收起菜单，点击扇区才触发动作并收起
  - 双触发模式：缺省内置 FAB 悬浮球（`position` 可配悬浮位），或传入 `trigger` 锚定任意外部元素展开
  - 几何可配：`spread`（扇形张角，默认 180°）/ `radius`（图标弧半径，默认 56）自由调整
  - 全键盘导航（方向键移动高亮、跳过禁用、Enter 触发、Esc 关闭），ARIA `menu` / `menuitem` + `aria-activedescendant`
  - 零依赖纯 DOM + CSS，CSS 自定义属性驱动明暗双主题，尊重 `prefers-reduced-motion`
