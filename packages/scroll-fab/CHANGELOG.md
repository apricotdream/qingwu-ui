# @qingwu-ui/scroll-fab

## 0.9.0-beta.1
### Minor Changes

- 新增 @qingwu-ui/scroll-fab 悬浮滚动栏：默认"滚动到底部"模式；桌面悬停推进描边、触屏按住同样驱动，绕满一圈翻转为"返回顶部"（纯模式切换、不附带滚动），未绕满离开/松手则描边衰减倒转；点击（轻点）恒直接执行当前模式动作、与描边正交，触屏绕满后的释放被消费避免同一手势既翻转又滚动，按住期间移动超阈值即放弃描边并放行页面手势；rAF 缓动程序滚动支持滚轮/触摸/键盘打断与懒加载变长追击，尊重 prefers-reduced-motion；键盘 Enter/Space 一键切换模式；window 与自定义容器双支持、可滚动才渲染；移动端一等支持（Pointer Events 单路径、ghost click 抑制、safe-area 定位、44px 命中下限）；零框架依赖
- 首次发布
