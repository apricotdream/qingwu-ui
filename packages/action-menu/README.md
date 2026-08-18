# @qingwu-ui/action-menu

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **径向快捷操作菜单** —— 框架无关，纯 DOM + CSS，零依赖。

- **扇形展开动画**：hover 触发时菜单呈扇形逐项展开，标签沿切线排布（stagger 级联）
- **多触发形态**：FAB 悬浮球 / 自定义触发器
- **键盘优先**：`↑ ↓` / 方向键导航、`Enter` 选中、`Esc` 关闭
- 自动尊重 `prefers-reduced-motion`

## 安装

```bash
npm install @qingwu-ui/action-menu
```

## 使用

```ts
import { ActionMenu } from "@qingwu-ui/action-menu";

const menu = new ActionMenu(document.getElementById("fab")!, {
  items: [
    { label: "编辑", action: () => startEdit() },
    { label: "分享", action: () => share() },
    { label: "删除", action: () => remove() },
  ],
});
```

> 完整 API 见 [青梧UI 根 README](https://github.com/apricotdream/qingwu-ui)。
