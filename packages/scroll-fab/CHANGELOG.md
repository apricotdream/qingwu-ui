# @qingwu-ui/scroll-fab

## 0.9.0-beta.3
### Minor Changes

- 修复键盘语义错误：Enter/Space 不再翻转模式——改为执行当前模式动作（走浏览器原生按钮激活 → click，与鼠标点击同一路径）；双模式下新增方向键翻转（ArrowUp=返回顶部 / ArrowDown=滚动到底，preventDefault 只翻转不滚页，同方向不重复触发），单模式方向键不响应；键盘激活与点击行为完全对齐
- 新增显隐配置：showThreshold（默认 0，行为不变，负数按 0）——scrollPos 未越过阈值时按钮隐藏，跨越即时显隐、无过渡动画，隐藏只改渲染不影响进行中的程序滚动与模式状态；modes（缺省 ["to-bottom","to-top"]）——初始模式取数组首项，规范化去重过滤，空数组/全非法构造时抛 TypeError，单模式无绕环翻转/描边（静态 aria「返回顶部」「滚动到底部」），图标按唯一模式方向显示
- 新增 onScroll(pct) 滚动进度回调：0..1 小数（maxScroll 为 0 时吐 0），scroll/resize/程序滚动时 rAF 节流一帧一吐，按钮隐藏期间照常吐，构造完成与 refresh() 后各补发一次

## 0.9.0-beta.2
### Minor Changes

- 新增 Lenis 平滑滚动可插拔后端：`lenis` option 支持三态——传 Lenis 实例复用宿主（组件不负责销毁）、`true`/配置对象在首次点击时动态 import(`lenis`) 自建、缺省/`false` 沿用内置 rAF；`lenis` 为 optional peerDependency，未安装静默回退 rAF，主包零增长；自建实例默认 `smoothWheel:false`（只驱动按钮程序滚动、不劫持宿主滚轮），`target` 容器自动映射为 Lenis `wrapper`，自建路径保留 wheel/touch/keydown 打断（`stop/start`）与懒加载到底追击语义，`onLenisReady` 向宿主抛出内部实例（对齐 ai-editor `onEditorReady`）
- 新增异形形状 `shape: { viewBox?, fill, outline, outlineTransform? }`：双 path 保证进度描边沿外扩轮廓「完全包裹」形状外缘（单 path 描边居中必有一半压入形状内部）；`outline` 可与 `fill` 同形再配 `outlineTransform`（如 `translate(24 24) scale(1.13) translate(-24 -24)`）外扩；异形模式自动退场圆形外壳（背景/边框/圆角），阴影改用 `drop-shadow` 跟随叶片真实形状；保持矩形命中区（44px 触控下限）；银杏叶等形状数据不内置，由文档/example 提供

## 0.9.0-beta.1
### Minor Changes

- 新增 @qingwu-ui/scroll-fab 悬浮滚动栏：默认"滚动到底部"模式；桌面悬停推进描边、触屏按住同样驱动，绕满一圈翻转为"返回顶部"（纯模式切换、不附带滚动），未绕满离开/松手则描边衰减倒转；点击（轻点）恒直接执行当前模式动作、与描边正交，触屏绕满后的释放被消费避免同一手势里翻转+滚动，按住期间移动超阈值即放弃描边并放行页面手势；rAF 缓动程序滚动支持滚轮/触摸/键盘打断与懒加载变长追击，尊重 prefers-reduced-motion；键盘 Enter/Space 一键切换模式；window 与自定义容器双支持、可滚动才渲染；移动端一等支持（Pointer Events 单路径、ghost click抑制、safe-area 定位、44px 命中下限）；零框架依赖
- 首次发布
