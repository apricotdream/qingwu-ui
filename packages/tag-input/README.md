# @qingwu/tag-input

标签快捷插入组件：输入框 + 下方标签快捷栏。点击标签按钮自动填入输入框；已插入的标签从快捷栏消失，从输入值中删除后自动重现。布局由 `@qingwu/text-layout` 的 `layoutChips` 驱动（展开/收起 + 标签栏高度）。

零框架依赖 · 纯 TypeScript + 原生 DOM · 受控/非受控双模式 · 全键盘可用。

## 安装

```bash
npm install @qingwu/tag-input
```

## 基础用法

```ts
import { TagInput } from "@qingwu/tag-input";
import "@qingwu/tag-input/style.css";

const ti = new TagInput(document.querySelector("#app")!, {
  defaultTags: ["React", "TypeScript", "CSS"],
  onChange: (value) => console.log(value),
});
```

交互行为：

1. 点击标签按钮 → 标签填入输入框（多个标签以 `", "` 分隔）
2. 已填入的标签从快捷栏消失；删除输入值中的标签后自动重现
3. 点击 chip 上的 × → 从快捷栏移除该标签（不会改动输入值）
4. 标签过多时折叠为 "+N 更多"，点击展开，展开后点"收起"折叠

## 自定义格式

```ts
const ti = new TagInput(root, {
  defaultTags: ["React"],
  formatInsert: (tag) => `#${tag}`,          // 插入为 #React
  parseTags: (value) => value.split(",").map((s) => s.trim().replace(/^#/, "")),
});
```

## 受控模式

```ts
let value = "";
let tags = ["React"];

const ti = new TagInput(root, {
  value,
  tags,
  onChange: (v) => {
    value = v;          // 外部更新状态
    ti.update({ value }); // 同步回组件
  },
  onTagsChange: (t) => {
    tags = t;
    ti.update({ tags });
  },
});
```

## chip-in-input 模式（inline）

已选标签以 chip 内嵌输入框，**input 只承载正在输入的草稿，不重复显示已选**；草稿经 `Enter` / 逗号 / 失焦 / 点建议提交进已选。已选以**数组**为一等公民（`selected` / `defaultSelected` / `onSelectedChange`），`value` 字符串在该模式下不生效。

```ts
let selected = ["前端", "组件库"];

const ti = new TagInput(root, {
  selected,
  defaultTags: ["前端", "组件库", "React", "Vue"],
  inline: true,
  maxTags: 5,
  onSelectedChange: (s) => {
    selected = s;           // 外部更新状态
    ti.update({ selected }); // 同步回组件（回灌不影响正在输入的草稿）
  },
});
```

行为要点：

1. 输入 `a,b,c` → 逗号分段提交，`a`、`b` 即时成为 chip，草稿保留 `c`
2. `Enter` / 失焦提交草稿并清空；已达 `maxTags` 上限时草稿保留等待处理
3. chip 的 × 删除、下方建议 chip 点击插入，均走 `onSelectedChange`

## API

### `new TagInput(root, options)`

| 选项 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `value` | `string` | - | 受控输入值（传入后进入受控模式；inline 下不生效） |
| `defaultValue` | `string` | `""` | 非受控初始输入值（inline 下不生效） |
| `onChange` | `(value: string) => void` | - | 输入值变化回调（inline 下为草稿文本） |
| `tags` | `string[]` | - | 受控可用标签列表 |
| `defaultTags` | `string[]` | `[]` | 非受控初始可用标签列表 |
| `onTagsChange` | `(tags: string[]) => void` | - | 标签列表变化回调（× 移除时） |
| `selected` | `string[]` | - | inline 专属：受控已选标签数组 |
| `defaultSelected` | `string[]` | `[]` | inline 专属：非受控初始已选标签数组 |
| `onSelectedChange` | `(selected: string[]) => void` | - | inline 专属：已选数组变化回调 |
| `formatInsert` | `(tag: string) => string` | 原样 | 标签插入格式器 |
| `parseTags` | `(value: string) => string[]` | 逗号分割 | 从输入值解析已存在标签 |
| `maxRows` | `number` | `2` | 标签栏最大行数，超出折叠；`0` 不折叠 |
| `moreLabel` | `(count: number) => string` | `+N 更多` | 折叠按钮文案 |
| `collapseLabel` | `string` | `收起` | 展开后收起按钮文案 |
| `placeholder` | `string` | - | 输入框占位符 |
| `disabled` | `boolean` | `false` | 禁用 |
| `readOnly` | `boolean` | `false` | 只读 |
| `removable` | `boolean` | `true` | 是否渲染 × 移除按钮 |
| `className` | `string` | - | 追加到根容器类名 |
| `font` | `string` | computed | CSS font（text-layout 测量用） |

### 实例方法 / 属性

| 成员 | 说明 |
|---|---|
| `ti.value` | 当前输入值（inline 下为草稿文本） |
| `ti.selected` | inline 已选标签数组（bar 模式返回 `[]`） |
| `ti.tags` | 全部可用标签 |
| `ti.insertTag(tag)` | 程序化插入标签（已存在则忽略；inline 下提交到已选并清空草稿） |
| `ti.removeTag(tag)` | 从快捷栏移除标签 |
| `ti.update({ value?, tags?, selected? })` | 外部同步受控值（inline 下用 `selected`） |
| `ti.setDisabled(v)` / `ti.setReadOnly(v)` | 动态切换状态 |
| `ti.destroy()` | 销毁组件，清空宿主容器 |

## 键盘操作

- `Tab` 在输入框与标签按钮间移动焦点
- `←` / `→` 在标签按钮间快速移动
- `Enter` / `Space` 插入焦点标签
