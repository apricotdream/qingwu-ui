# @qingwu-ui/confirm

## 0.9.0-beta
### Minor Changes

- 首发：框架无关、零依赖确认框
  - 缩放同源转场：从触发控件中心「长」出、确认/取消后缩回控件（translate + scale 复合 morph，纯 CSS 过冲弹性）
  - 互斥单例：同时仅一个确认框，新调用替换旧框（旧框 resolve `dismiss`）
  - 异步确认：`onConfirm` 返回 Promise 时进入 loading 态（按钮禁用 + 转菊花），成功才缩回；reject 则保持对话框打开并向外抛错
  - 三态返回值：`'confirm' | 'cancel' | 'dismiss'`，Promise 在关闭动画结束后 settle
  - 遮罩点击行为可配：`backdrop: 'dismiss' | 'cancel' | 'ignore'`（默认 dismiss）
  - 完整 a11y：`role="dialog"` / `aria-modal` / 焦点陷阱 / Esc 关闭 / 关闭后焦点回归触发按钮
  - 自动尊重 `prefers-reduced-motion`（退化为淡入淡出）；SSR 安全（无 window 时 resolve `dismiss`）
