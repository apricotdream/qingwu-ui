# @apricotdream/notifications

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **通知铃铛组件** —— 框架无关，纯 DOM + CSS，零依赖。

- **未读红点徽标**：`unreadCount > 0` 时铃铛右上角弹入红点（纯点，不带数字）
- **手风琴错峰动画**：打开面板时条目像琴键一样逐项按下（stagger 级联 + 弹性回弹），向上展开时反向级联
- **条目渲染**：内置 title/sub/glyph/未读圆点布局，`renderItem` 可完全自定义
- **向上/向下自适应翻转**：贴近视口底边自动向上弹，动画方向同步反转
- **无障碍内建**：`role="button" + menu / menuitem` + `aria-activedescendant` 键盘导航（`↑ ↓` / `Home` / `End` / `Enter` / `Esc` / `Tab`）
- 自动尊重 `prefers-reduced-motion`；明暗双主题（`--qntf-*` 令牌）

## 安装

```bash
npm install @apricotdream/notifications
```

## 使用

```ts
import { Notifications } from "@apricotdream/notifications";
import "@apricotdream/notifications/style.css";

const root = document.querySelector("#bell");
const bell = new Notifications(root, {
  unreadCount: 3,
  items: [
    { id: 1, title: "欢迎来到回声日记", sub: "这是消息中心的第一条消息", glyph: "迎" },
    { id: 2, title: "新文章已发布", sub: "《落叶与风》已公开", unread: true },
  ],
  onItemClick: (item) => console.log("点击", item),
  onOpenChange: (open) => {
    if (open) bell.update({ unreadCount: 0 }); // 打开即清红点（宿主自行落库）
  },
});

bell.update({ items: [...], unreadCount: 0 });
bell.destroy();
```

React / Vue 集成时在 `useEffect` / `onMounted` 中实例化，卸载时调用 `destroy()`。

## 配置

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `unreadCount` | `number` | `0` | 未读数：>0 显示红点徽标 |
| `items` | `NotificationItem[]` | `[]` | 下拉条目（空时显示 `emptyText`） |
| `emptyText` | `string` | `"暂无消息"` | 空列表文案 |
| `triggerContent` | `string \| HTMLElement` | 内置铃铛图标 | 触发器内容自定义 |
| `ariaLabel` | `string` | `"消息"` | 触发器无障碍标签 |
| `className` | `string` | `""` | 附加到根容器类名 |
| `width` | `"trigger" \| "auto"` | `"auto"` | 面板宽度：跟随触发器 / 内容自适应 |
| `duration` | `number` | `380` | 单个条目错峰动画时长 ms |
| `stagger` | `number` | `28` | 条目错峰间隔 ms |
| `animate` | `boolean` | `true` | 手风琴错峰动画开关 |
| `maxStagger` | `number` | `12` | 超过该条目数降级为面板整体淡入，`0` 不降级 |
| `open` | `boolean` | `-` | 受控展开 |
| `defaultOpen` | `boolean` | `false` | 非受控初始展开 |
| `renderItem` | `(item) => HTMLElement` | `-` | 自定义条目渲染（覆盖默认 title/sub 布局） |
| `onItemClick` | `(item) => void` | `-` | 点击条目回调（组件自动收起） |
| `onOpenChange` | `(open) => void` | `-` | 展开状态变化回调 |

`NotificationItem`：`{ id: string \| number; title: string; sub?: string; glyph?: string; unread?: boolean; [key: string]: unknown }`

## 实例方法

| 方法 | 说明 |
| --- | --- |
| `open()` / `close()` / `toggle()` | 展开 / 关闭 / 切换 |
| `update(patch)` | 外部同步条目 / 未读数 / 展开 / 文案 / 标签 |
| `destroy()` | 销毁组件，清空宿主容器并移除面板 |

## 属性

| 属性 | 说明 |
| --- | --- |
| `.expanded` | 是否展开 |

## 主题

样式由 `--qntf-*` 令牌驱动，复用宿主已定义的 `--card / --ink / --line / --teal / --vermilion / --hover` 等；支持 `<html data-theme="dark">` 与 `.dark` 类两种暗色约定。详情见 `style.css`。
