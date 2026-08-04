# @qingwu/select

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **下拉选择器组件** —— 框架无关，纯 DOM + CSS，零依赖。

- **手风琴错峰动画**：打开面板时选项像琴键一样逐项按下（stagger 级联 + 弹性回弹），向上展开时反向级联
- **选项禁用**：单个选项 `disabled` 置灰、点击无效、键盘导航自动跳过
- **向上/向下自适应翻转**：贴近视口底边自动向上弹，动画方向同步反转
- **性能保护**：选项超过 `maxStagger`（默认 12）自动降级为面板整体淡入，避免冗长开幕
- **键盘优先**：`↑ ↓` 导航（跳过禁用）、`Home`/`End`、`Enter` 选中、`Esc` 关闭、`Tab` 移出关闭
- **无障碍内建**：`role="combobox"` / `listbox` / `option` + `aria-activedescendant` 完整语义
- 自动尊重 `prefers-reduced-motion`

## 安装

```bash
npm install @qingwu/select
# or: pnpm add @qingwu/select / bun add @qingwu/select
```

## 使用

```ts
import { Select } from "@qingwu/select";
import "@qingwu/select/style.css";

const el = document.querySelector("#root");
const select = new Select(el, {
  placeholder: "选择框架",
  defaultValue: "react",
  options: [
    { value: "react", label: "React", hint: "框架无关 · 原生 DOM" },
    { value: "vue", label: "Vue", hint: "new Select(el) 即用" },
    { value: "svelte", label: "Svelte" },
    { value: "ember", label: "Ember", disabled: true },
  ],
  onChange: (value, option) => console.log("选中", value, option),
});

select.open(); // 或 select.close() / select.toggle()

// 受控：外部同步显示值（不触发 onChange）
select.update({ value: "vue" });

select.destroy();
```

React / Vue 集成时在 `useEffect` / `onMounted` 中实例化，卸载时调用 `destroy()`。

## 配置

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `options` | `SelectOption[]` | `[]` | 选项列表 |
| `value` | `string \| null` | `-` | 受控值（传入后用户选择仅回调 `onChange`，显示值由 `update({ value })` 同步） |
| `defaultValue` | `string \| null` | `null` | 非受控初始值 |
| `placeholder` | `string` | `""` | 未选中时占位文本 |
| `disabled` | `boolean` | `false` | 整体禁用 |
| `open` | `boolean` | `false` | 受控展开 |
| `defaultOpen` | `boolean` | `false` | 非受控初始展开 |
| `className` | `string` | `""` | 附加到根容器类名 |
| `width` | `"trigger" \| "auto"` | `"trigger"` | 面板宽度：跟随触发器 / 内容自适应 |
| `duration` | `number` | `380` | 单个选项错峰动画时长 ms |
| `stagger` | `number` | `28` | 选项错峰间隔 ms |
| `animate` | `boolean` | `true` | 手风琴错峰动画开关 |
| `maxStagger` | `number` | `12` | 超过该选项数降级为整体淡入，`0` 不降级 |
| `ariaLabel` | `string` | `placeholder` | 触发器无障碍标签 |
| `onOpenChange` | `(open) => void` | `-` | 展开状态变化回调 |
| `onChange` | `(value, option) => void` | `-` | 选中值变化回调（取消为 `null`） |

`SelectOption`：`{ value: string; label: string; disabled?: boolean; hint?: string; glyph?: string }`

## 实例方法

| 方法 | 说明 |
| --- | --- |
| `open()` / `close()` / `toggle()` | 展开 / 关闭 / 切换 |
| `update(patch)` | 外部同步值 / 选项 / 禁用 / 占位 / 展开（`value` 同步不触发 `onChange`） |
| `setValue(value)` | 程序化选中（等价 `update({ value })`） |
| `setDisabled(v)` | 动态切换整体禁用 |
| `destroy()` | 销毁组件，清空宿主容器并移除面板 |

## 属性

| 属性 | 说明 |
| --- | --- |
| `.value` | 当前选中值（`string \| null`） |
| `.expanded` | 是否展开 |

## 主题

样式由 `--qsel-*` 令牌驱动，复用宿主已定义的 `--paper / --card / --ink / --teal / --line` 等；支持 `<html data-theme="dark">` 与 `.dark` 类两种暗色约定。详情见 `style.css`。
