# @qingwu-ui/button

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **胶囊形按钮组件** —— 框架无关，纯 DOM + CSS，零依赖。

- **四种形态**：`default` / `primary` / `amber` / `icon`（图标按钮）
- **无障碍内建**：原生 `<button>` 语义，支持 `aria-label`、焦点态与禁用态
- 尊重 `prefers-reduced-motion`；样式经 `@qingwu-ui/button/style.css` 单独导出

## 安装

```bash
npm install @qingwu-ui/button
```

## 使用

```ts
import { Button } from "@qingwu-ui/button";
import "@qingwu-ui/button/style.css";

const btn = new Button(document.getElementById("btn")!, {
  variant: "primary",
  label: "确定",
  onClick: () => console.log("clicked"),
});
```

> 完整 API 见 [青梧UI 根 README](https://github.com/apricotdream/qingwu-ui)。
