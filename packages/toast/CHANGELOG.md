# @qingwu-ui/toast

## 0.9.0-beta
### Minor Changes

- 版本统一对齐 0.9.0（无功能变更；首次以 @qingwu-ui scope 发布，@qingwu → @qingwu-ui 品牌迁移）


## 0.8.0

### Minor Changes

- 新增 `description` 次级说明行：纯文本、可换行、不参与 `maxLines` 截断，供错误提示携带详情
- 新增 `action` 单个操作按钮（`{ label, onClick }`）：点击即关闭 toast，供「重试」类操作

## 0.7.0

### Minor Changes

- 新增 `persist` 选项：常驻不自动消失（等价 `duration: 0`），受 `persistMaxVisible`（默认 3，按容器位置独立）数量上限约束，超限按 FIFO 挤掉最老的常驻 toast
- 默认不再按行数截断（原默认 `maxLines: 2`）：长文本完整显示、内容自适应；`maxLines` 保留为显式截断选项；无截断模式下行省略号彻底禁用（`qt-truncate` 门控 `text-overflow`），只截断不加 `…`
- 文本区域增加 `overflow-wrap: break-word`，长不可断行 token（URL/文件名）强制断词，防止撑破容器宽度上限
- 修复：排队（超出 `maxVisible`）的 toast 出队时丢失单条 `duration`、被全局默认覆盖（`_dequeue` 改读条目自身时长）
- `promise()` 终态（success/error）强制自动消失，不跟随 `persist`（避免「保存成功」永久挂屏）

## 0.6.0

### Patch Changes

- 版本统一对齐 0.6.0（无功能变更；`@qingwu-ui/tag-input` 随本版首次发布）

## 0.5.0

### Minor Changes

- 默认定位改为 **顶部居中**（top-center，EP/AntD 惯例），`position` 仍可覆盖
  - 消息支持 `**关键词**` 强调标记，渲染为语义色 `<em>` 节点（全部 textContent，无 innerHTML，杜绝 XSS）
  - 新增 `vibrate` 选项（默认 true）：error 类型触发设备震动（navigator.vibrate 三次短脉冲），桌面端无马达时静默忽略

### Patch Changes

- Updated dependencies
  - @qingwu-ui/text-layout@0.5.0

## 0.4.0

### Minor Changes

- 新增 Toast 轻提示组件：零依赖、纯 TypeScript、ARIA live region 内建、6 种定位、4 种语义类型、Promise 链、队列管理、明暗双主题、prefers-reduced-motion 克制、移动端 safe-area 适配
