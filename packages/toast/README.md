# @qingwu-ui/toast

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **Toast 通知组件** —— 框架无关，纯 DOM + CSS，零依赖。

- **无障碍内建**：ARIA `live region` 语义，屏幕阅读器可感知
- **Promise 链 + 队列管理**：连续弹窗自动排队，`maxLines` 截断、`description` 次级说明行、`action` 操作按钮
- **轻量单例**：`toast.success() / info() / error()` 一行唤起，样式经 `@qingwu-ui/toast/style.css` 单独导出
- 自动尊重 `prefers-reduced-motion`

## 安装

```bash
npm install @qingwu-ui/toast
```

## 使用

```ts
import { toast } from "@qingwu-ui/toast";
import "@qingwu-ui/toast/style.css";

toast.success("保存成功");
toast.error("网络异常", { description: "请检查网络后重试", action: { label: "重试", onClick: retry } });
```

> 完整 API 见 [青梧UI 根 README](https://github.com/apricotdream/qingwu-ui)。
