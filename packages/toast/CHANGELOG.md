# @qingwu/toast

## 0.6.0

### Patch Changes

- 版本统一对齐 0.6.0（无功能变更；`@qingwu/tag-input` 随本版首次发布）

## 0.5.0

### Minor Changes

- 默认定位改为 **顶部居中**（top-center，EP/AntD 惯例），`position` 仍可覆盖
  - 消息支持 `**关键词**` 强调标记，渲染为语义色 `<em>` 节点（全部 textContent，无 innerHTML，杜绝 XSS）
  - 新增 `vibrate` 选项（默认 true）：error 类型触发设备震动（navigator.vibrate 三次短脉冲），桌面端无马达时静默忽略

### Patch Changes

- Updated dependencies
  - @qingwu/text-layout@0.5.0

## 0.4.0

### Minor Changes

- 新增 Toast 轻提示组件：零依赖、纯 TypeScript、ARIA live region 内建、6 种定位、4 种语义类型、Promise 链、队列管理、明暗双主题、prefers-reduced-motion 克制、移动端 safe-area 适配
