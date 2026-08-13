# @apricotdream/skeleton

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **运行时测量自动骨架屏** —— 框架无关，纯 DOM + CSS，零依赖。

- **运行时测量**：挂载即按目标元素实际尺寸就地生成骨架（in-place measurement），复杂布局可选 portal 浮层覆盖
- **合成器驱动微光**：shimmer 走 compositor 合成层，动画流畅且可被 `prefers-reduced-motion` 关闭
- **快照到静态 HTML**：`renderSkeletonSnapshot` 可将骨架渲染为静态 HTML，供 SSR 直出，避免首屏闪烁

## 安装

```bash
npm install @apricotdream/skeleton
```

## 使用

```ts
import { AutoSkeleton } from "@apricotdream/skeleton";

const sk = new AutoSkeleton(document.getElementById("card")!, {
  shape: "rounded",
});
```

> 完整 API 见 [青梧UI 根 README](https://github.com/apricotdream/qingwu-ui)。
