# @qingwu-ui/confirm

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **确认框组件** —— 框架无关，纯 DOM + CSS，零依赖。

- **缩放同源转场**：从触发控件中心「长」出，确认 / 取消后弹性缩回控件（iOS / macOS 经典 presentation 风格）
- **互斥单例**：同时只存在一个确认框，新调用替换旧框
- **异步确认**：`onConfirm` 返回 Promise 时进入 loading 态，成功才缩回；失败保持打开并抛错
- **三态返回值**：`'confirm' | 'cancel' | 'dismiss'`，Promise 在关闭动画结束后 settle
- 完整无障碍：`role="dialog"` / `aria-modal` / 焦点陷阱 / Esc / 焦点回归触发按钮
- 自动尊重 `prefers-reduced-motion`；SSR 安全

## 安装

```bash
npm install @qingwu-ui/confirm
```

## 使用

```ts
import { confirm } from "@qingwu-ui/confirm";
import "@qingwu-ui/confirm/style.css";

const btn = document.querySelector("#delete-btn");

const result = await confirm(btn, {
  title: "删除文件？",
  message: "该操作不可撤销，**删除后无法恢复**。",
  danger: true,
  confirmText: "删除",
  onConfirm: async () => {
    await deleteFile();
  },
});

if (result === "confirm") {
  toast.success("已删除");
}
```

## API

```ts
confirm(trigger: HTMLElement, options?: ConfirmOptions): Promise<ConfirmResult>
confirm.dismiss(): void
confirm.configure(options: ConfirmOptions): void

type ConfirmResult = "confirm" | "cancel" | "dismiss";
```

> 完整 API 见 [青梧UI 根 README](https://github.com/apricotdream/qingwu-ui)。
