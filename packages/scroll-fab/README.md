# @qingwu-ui/scroll-fab

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **悬浮滚动栏** —— 框架无关，纯 DOM + CSS，零强依赖。

- **绕圈翻转**：桌面悬停 / 触屏按住推进描边进度，绕满一圈在「滚动到底部 / 返回顶部」间纯切换（不附带滚动），未绕满移开/松手则描边衰减倒转
- **点击与描边正交**：轻点恒直接执行当前模式动作；触屏绕满后的释放被消费，避免同一手势既翻转又滚动
- **Lenis 可插拔**：内置 rAF 缓动，可选接入 [Lenis](https://github.com/darkroomengineering/lenis)（未安装静默回退）
- **异形形状**：银杏叶等自定义外形，进度描边沿外扩轮廓完全包裹
- 程序滚动支持 wheel / touch / keydown 打断、懒加载变长追击
- 移动端一等支持：Pointer Events 单路径、ghost click 抑制、safe-area 定位、44px 命中下限
- 尊重 `prefers-reduced-motion`；window 与自定义容器双支持

## 安装

```bash
npm install @qingwu-ui/scroll-fab
# 可选：启用 Lenis 平滑滚动
npm install lenis
```

## 使用

```ts
import { ScrollFab } from "@qingwu-ui/scroll-fab";
import "@qingwu-ui/scroll-fab/style.css";

// 零配置：右下角圆形悬浮栏
const fab = new ScrollFab();

// 销毁
fab.destroy();
```

### 接入 Lenis

```ts
// ① 自建实例（仅驱动按钮程序滚动，不劫持页面滚轮）
new ScrollFab({
  lenis: true,
  onLenisReady: (lenis) => console.log("Lenis 就绪", lenis),
});

// ② 透传 Lenis 配置（target 容器自动映射为 wrapper）
new ScrollFab({ lenis: { duration: 1.1 } });

// ③ 复用宿主已有的 Lenis 实例（组件永不销毁它）
const lenis = new Lenis();
new ScrollFab({ lenis });
```

未安装 `lenis` 时自动回退内置 rAF，无任何报错。

### 异形形状（银杏叶等）

进度要「完全包裹」形状必须用双 path：`fill` 是叶片实体，`outline` 是外扩一圈的闭合轮廓（SVG 描边居中于路径，单 path 会有一半笔画压进形状内部）。

```ts
const LEAF = "M24 46 L23.2 34 C16 33 9 28 7 20 Z /* …完整 path d… */";

new ScrollFab({
  shape: {
    fill: LEAF,
    outline: LEAF, // 与 fill 同形
    outlineTransform: "translate(24 24) scale(1.13) translate(-24 -24)",
  },
});
```

异形模式下圆形外壳自动退场（背景/边框/圆角），阴影改用 `drop-shadow` 跟随叶片真实形状；命中区仍为矩形以保证 44px 触控目标。

## API

```ts
new ScrollFab(options?: ScrollFabOptions): ScrollFab

interface ScrollFabOptions {
  target?: HTMLElement | null;          // 滚动容器，默认 window
  size?: number;                        // 直径 px，默认 48（最小 44）
  ringDuration?: number;                // 绕圈时长 ms，默认 800
  decayDuration?: number;               // 衰减倒转 ms，默认 300
  cancelThreshold?: number;             // 触屏位移放弃阈值 px，默认 10
  content?: string | HTMLElement;       // 中心内容，默认方向箭头
  position?: ScrollFabPosition;         // 悬浮位置，默认右下 24/24
  zIndex?: number;                      // 默认 9999
  className?: string;
  animate?: boolean;                    // 默认 true
  lenis?: boolean | ScrollFabLenisConfig | LenisLike;
  shape?: ScrollFabShape;
  onLenisReady?: (lenis: LenisLike) => void;
  ariaLabelToBottom?: string;
  ariaLabelToTop?: string;
  onModeChange?: (mode: "to-bottom" | "to-top") => void;
}
```

实例方法：`scrollToBottom()` / `scrollToTop()` / `refresh()` / `destroy()`；只读属性 `currentMode`、`el`。
