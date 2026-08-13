# @apricotdream/skeleton

## 0.9.0

### Minor Changes

- 版本统一对齐 0.9.0（无功能变更；首次以 @apricotdream scope 发布，@qingwu → @apricotdream 品牌迁移）

## 0.8.0

### Minor Changes

- 版本统一对齐 0.8.0（无功能变更；所有 @qingwu 包版本对齐）


## 0.6.0

### Patch Changes

- 版本统一对齐 0.6.0（无功能变更；`@apricotdream/tag-input` 随本版首次发布）

## 0.5.1

### Minor Changes

- **重设计：测量与渲染分离，弃用估算器**。`createSSRSkeleton` / `computeTextSkeleton` 删除，替换为快照渲染器 `renderSkeletonSnapshot`（输入 `extractElementInfo` 测量快照，输出纯 CSS 静态骨架 HTML，块数上限 200 截断）
- **原地测量**：`AutoSkeleton` 不再移动/包裹子节点，真实内容仅通过 `qs-skeleton-measuring` 类透明化；覆盖层以 portal 挂载到 body，坐标对齐根容器。任意框架（React/Vue/vanilla）DOM 所有权零冲突，加载态期间 re-render/卸载零风险
- **TreeWalker 单遍叶子收集**：Phase 1 从递归 + 中间数组分配改为单遍遍历，常数额外内存
- **块级渐变位移动画**：单层光条（整片扫过、行间无层次）改为每块独立 `::before` 渐变层 `translateX` 滑动（合成器线程，零主线程 repaint）；**错峰**——动画块按文档序递增负 `animation-delay`（`--qs-sk-delay` 变量，首帧即级联流水，`staggerDelay` 可配，0 关闭错峰）；门槛过滤——宽 ≥ 48px 且高 ≥ 8px 的块才建动画层（头像/图标/分隔线等小碎块静态），共享常量不开放配置；层内仅 transform + linear-gradient，禁 shadow/filter；reduced-motion 隐藏全部动画层
- scroll 跟随：窗口/滚动容器滚动时覆盖层自动跟随定位
- 删除装饰性 peerDep `@apricotdream/text-layout`（代码零引用）
- **动画样式按容器**：颜色/时长/时序函数通过 per-instance CSS 变量（`--qs-sk-*`）写在 overlay 元素上（运行时）或内联在容器 div 上（静态快照），多容器并存零互相覆盖；新增 `timingFunction` 配置（CSS animation-timing-function）
- **样式单例注入**：注入 CSS 完全静态化（无实例参数），多实例共享一个 style 节点（引用计数），不再 N 实例 N 份互踩的全局规则
- **refetch 自适应**：`AutoSkeleton` 以 MutationObserver（rAF 合并）+ 结构签名哈希预筛（`structureSignature`，标签/class/style/data-skeleton-* 属性/子序/文本长度之和，忽略 ignore 子树，宁可错报不可漏报）检测 DOM 结构变化，签名变了才重测重渲——loading 期间数据到达、结构变化，骨架实时跟上；同长文本/非几何属性变化不触发
- **视口增量渲染**：运行时覆盖层只渲染视口 ±1 屏（预取）内的块，滚动时 rAF 合并增量补渲（append-only）；已渲染块上限 500，超限淘汰 ±1 屏外的块（滚回按需重渲，DOM/合成层有界）；测量仍全量单次回流，渲染层过滤
- **`zIndex` 选项**：覆盖层 z-index 可配（默认 9999，保证盖住容器内高 z-index 子元素）；页面 chrome（sticky/fixed 头部、弹层）需在骨架之上时调低，如 sticky header z-index 100 → 传 90（修复：滚动时骨架覆盖层遮挡站点头部）
- **root 脱离文档自毁**：滚动监听中检测根容器 `isConnected === false`（消费端未 destroy 就卸载）时自动 teardown 自毁——修复孤儿覆盖层泄漏：detached 元素 `getBoundingClientRect` 全零会把覆盖层钉在视口左上角跟随滚动，导航往返后出现"漂浮的位移骨架"；自毁同时释放 overlay DOM、scroll/Resize/Mutation 监听器与样式单例引用
- **加载期位置守卫**：rAF 每帧比对根容器**文档坐标**（rect + scroll，纯滚动时恒定 → 零操作），检测到文档位置变化（路由回退的布局沉降、内容重排等 RO 盲区）即重定位覆盖层 + **重测重渲染块几何**（节流 100ms 防抖动）——修复块级错位：此前只跟随覆盖层盒子，块几何仍是挂载时旧测量值，回退导航场景实测块与真实内容错位达 21px，修复后 ≤2px；rect 读取在布局干净时为缓存命中，无额外回流
- 修复：静态 `style.css` 的 `--qs-sk-*` 变量定义在已删除的 `.qs-skeleton-wrapper` 上导致变量永不生效，回退值已下沉到各规则
- 体积：gzip 2.22 kB（size-limit 上限收紧至 8 kB）

### Breaking Changes

- `createSSRSkeleton` / `computeTextSkeleton` 及 `SSRSkeletonConfig` / `SSRSkeletonTextConfig` / `SSRSkeletonRectConfig` 类型已删除，改用 `renderSkeletonSnapshot` + `RenderSkeletonSnapshotOptions`
- `AutoSkeletonOptions.ssr` 字段删除（从未生效的装饰性配置）
- peerDep `@apricotdream/text-layout` 删除

## 0.5.0

### Minor Changes

- 版本统一对齐 0.5.0（无功能变更；repository/homepage/bugs 统一为 apricotdream/qingwu-ui）

### Patch Changes

- Updated dependencies
  - @apricotdream/text-layout@0.5.0

## 0.4.0

### Patch Changes

- 版本统一对齐至 0.4.0
- Updated dependencies
  - @apricotdream/text-layout@0.3.2
