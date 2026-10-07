# @qingwu-ui/text-layout

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **文本排版引擎** —— 框架无关，纯 TypeScript + Canvas 测量，零依赖。受 Pretext 启发的两阶段布局（prepare / layout）。

- **Canvas 测量**：Unicode 感知的断行（CJK / 拉丁混合），不依赖浏览器原生 API 的差异
- **虚拟滚动高度**：`computeVirtualHeights` / `findVisibleRange` 支撑长文按需渲染
- **多行截断**：`truncateToHeight` / `truncateToLines` 精确到像素级
- **Chip 流式布局**：`layoutChips` 驱动标签流（展开 / 收起 + 高度计算，`@qingwu-ui/tag-input` 即基于它）
- **表格列宽**：`computeColumnWidths` / `fitRowToColumns` 自适应列宽计算

## 安装

```bash
npm install @qingwu-ui/text-layout
```

## 使用

```ts
import { layout, measure, prepare } from "@qingwu-ui/text-layout";

const plan = prepare(text, { width: 320, font: "16px sans-serif" });
const rows = layout(plan);
```

> 完整 API 见 [青梧UI 根 README](https://github.com/apricotdream/qingwu-ui)。
