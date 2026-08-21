# @qingwu-ui/carousel

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **轮播图 / Hero 组件** —— 框架无关，纯 DOM + CSS，零依赖。

- **双层图分层入场** —— 左侧视觉由「背景图 + 角色透明图」两层构成：背景先从左往右滑入（700ms），角色随后淡入上移（700ms 后启动），先搭舞台、再交代信息
- **文案逐行滑入** —— 右列 eyebrow / 标题 / 副标题 / 描述 / 链接逐行错峰、从右往左滑入
- **缩略图导航** —— 底部缩略图条右对齐至左图右缘，点击即切换；仅首次加载入场，切换图片时保持稳定不动
- **触屏横滑** —— 移动端图片区支持左右滑动切换（`touch-action: pan-y` 保留页面纵向滚动，48px 阈值过滤点按）
- **自动播放 / 循环 / 受控** —— 播放间隔与倍速可调，支持受控模式（只回调不内部切换）
- **无障碍内建** —— `role="region"` + `aria-roledescription="carousel"`、缩略图 tablist 语义、左右方向键切换、`prefers-reduced-motion` 自动降级

## 安装

```bash
npm install @qingwu-ui/carousel
# or: pnpm add @qingwu-ui/carousel / bun add @qingwu-ui/carousel
```

## 使用

```ts
import { Carousel } from "@qingwu-ui/carousel";
import "@qingwu-ui/carousel/style.css"; // 样式为独立子路径导出，不引入不进 bundle

const carousel = new Carousel(document.getElementById("hero")!, {
  items: [
    {
      value: "01",
      title: "晨光",
      subtitle: "Morning Light",
      eyebrow: "OPENING SCENE",
      description: "背景先入场，角色随后登台，文案逐行交代。",
      background: "/hero-01-bg.png",   // 背景图：先从左往右滑入
      image: "/hero-01-char.png",      // 角色透明图：随后淡入上移
      href: "#",
    },
    // ...
  ],
  defaultValue: "01",
  autoplay: true,
  interval: 3800,  // 播放间隔 ms
  speed: 1,        // 倍速：实际间隔 = interval / speed（下限 250ms）
  loop: true,
  showArrows: true,
  showThumbs: true,
});

// 组件销毁时释放全部资源（定时器等）
carousel.destroy();
```

### 入场时序

| 图层 | 动画 | 时序 |
|---|---|---|
| 背景图（`.qcar-bg`） | 从左往右滑入 + 淡入 | 0ms 起，700ms 完成 |
| 角色图（`.qcar-figure`） | 淡入上移 | delay 700ms（等背景播完），900ms |
| 右列文案 | 逐行从右往左滑入 | 180ms 起，每行错峰 90ms |
| 缩略图条 | 淡入上移 | 仅首次加载播放一次 |

每次切换（自动 / 手动）都会重放上述入场动画（缩略图条除外，它保持稳定）。

## 移动端

- **触屏横滑** —— 图片区支持 pointer 横滑切换（左滑下一张 / 右滑上一张）。`touch-action: pan-y` 保证页面纵向滚动不被劫持，位移不足 48px 视为点按不切换；鼠标拖拽不启用（桌面走箭头 / 键盘 / 缩略图）
- **悬浮缩略图变体**（opt-in）—— 在根元素追加 `qcar--thumbs-float` 类后，≤560px 时缩略图条与图片区同格重叠、以毛玻璃胶囊悬浮在卡片底部；缩略图脱离文档流后卡片少一行、整体变矮，适合画廊式多卡场景。默认不启用，桌面 / 平板（>560px）仍为底部缩略图条

```ts
// 启用悬浮缩略图变体
const carousel = new Carousel(el, {
  items,
  className: "qcar--thumbs-float",
});
```

## API

### `new Carousel(root, options?)`

| 选项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `items` | `CarouselItem[]` | `[]` | 轮播项（`title`/`image` 必填） |
| `value` | `string \| null` | — | 受控模式：由外部指定当前项 |
| `defaultValue` | `string \| null` | 第一项 | 初始项 |
| `className` | `string` | `""` | 追加到根元素的类名 |
| `autoplay` | `boolean` | `false` | 自动播放 |
| `interval` | `number` | `4200` | 播放间隔 ms |
| `speed` | `number` | `1` | 倍速，实际间隔 = interval / speed（下限 250ms） |
| `loop` | `boolean` | `true` | 循环切换 |
| `showArrows` | `boolean` | `true` | 左右箭头 |
| `showThumbs` | `boolean` | `true` | 底部缩略图条 |
| `ariaLabel` | `string` | `"轮播图"` | 根元素无障碍标签 |
| `onChange` | `(value, item, index) => void` | — | 切换回调 |

### `CarouselItem`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `value` | `string` | 否 | 项标识（受控模式用） |
| `image` | `string` | 是 | 角色透明图（主体视觉，`object-fit: contain`） |
| `background` | `string` | 否 | 背景图（先入场层） |
| `thumbnail` | `string` | 否 | 缩略图，缺省用 `image` |
| `alt` | `string` | 否 | 图片替代文本，缺省用 `title` |
| `title` | `string` | 是 | 标题 |
| `subtitle` | `string` | 否 | 副标题 |
| `description` | `string` | 否 | 描述 |
| `eyebrow` | `string` | 否 | 眉题（小号标签） |
| `href` | `string` | 否 | 详情链接 |
| `linkLabel` | `string` | 否 | 链接文案，缺省 `"查看详情"` |

### 实例方法 / 属性

| 成员 | 类型 | 说明 |
|---|---|---|
| `next()` / `prev()` | 方法 | 下一张 / 上一张 |
| `goTo(index)` | 方法 | 跳到指定项（越界按 `loop` 归一化） |
| `update(patch)` | 方法 | 运行时更新任意选项（`items`/`autoplay`/`interval`/`speed`/`loop`/`showArrows`/`showThumbs`/`value`） |
| `start()` / `stop()` | 方法 | 恢复 / 暂停自动播放（hover 自动暂停） |
| `destroy()` | 方法 | 释放全部资源并清空根节点 |
| `value` | 只读 | 当前项 value |
| `currentIndex` | 只读 | 当前索引 |
