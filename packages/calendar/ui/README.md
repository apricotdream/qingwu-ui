# @qingwu-ui/calendar

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **自渲染日历组件** —— 框架无关，纯 DOM + CSS，零依赖。以**中国历法**为核心差异化：农历 / 节气 / 节日 / 黄历宜忌。

- **中国历法内建**：农历、二十四节气、节假日与调休（国务院历年放假安排，2025–2027），黄历宜忌示意
- **三种视图**：日 / 月 / 年切换，`今天` 快速回位；日期 + 时分秒选择
- **`dateOnly` 纯日期模式**：隐藏时间行，`onChange` 回发 `YYYY-MM-DD`（0.9.0 新增）
- **无障碍内建**：全键盘导航（`←` / `→` 翻页、`Esc` / 遮罩关闭）、ARIA dialog 语义、焦点进出管理
- **开放扩展**：`DayMetaProvider` / `PanelProvider` 双接口，可追加或覆盖小字、角标与详情面板
- 锚定弹出动画，自动响应 `prefers-reduced-motion`

## 安装

```bash
npm install @qingwu-ui/calendar
```

## 使用

```ts
import { Calendar } from "@qingwu-ui/calendar";
import "@qingwu-ui/calendar/style.css";

const cal = new Calendar(document.getElementById("calendar")!, {
  selected: "2026-07-29",
  onChange: (date) => console.log("选中：", date),
});
```

> 完整 API（属性 / 实例方法 / Provider 扩展）见 [青梧UI 根 README](https://github.com/apricotdream/qingwu-ui)。
