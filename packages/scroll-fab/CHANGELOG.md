# @qingwu-ui/scroll-fab

## 0.9.0-beta.1
### Minor Changes

- 新增 @qingwu-ui/scroll-fab 悬浮滚动栏：默认"滚动到底部"模式；按住绕满描边一圈翻转为"返回顶部"并顺带平滑滚到底，未绕满松手描边衰减倒转、短按执行当前模式动作，按住期间移动超阈值即放弃描边并放行页面手势；rAF 缓动程序滚动支持滚轮/触摸/键盘打断与懒加载变长追击，尊重 prefers-reduced-motion；键盘 Enter/Space 一键切换模式；window 与自定义容器双支持、可滚动才渲染；移动端一等支持（Pointer Events 单路径、ghost click 抑制、safe-area 定位、44px 命中下限）；零框架依赖
- 首次发布
