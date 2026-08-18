# 青梧UI · Calendar 组件库 TS7 现代化重构实施方案

> 版本：v1.1（2026-07-31 修订：`@qingwu-ui/calendar-core` 并入 `@qingwu-ui/calendar`，状态引擎不再独立成包）｜ 编制日期：2026-07-25 ｜ 性质：规划文档（不含任何代码改动）
> 视角：资深产品经理 × 高级开发工程师 × 前端架构师
> 数据基线：本地实测排查 + 2026-07-25 实时联网调研（npm registry / GitHub API / 上游 issue 库）

---

## 第一部分：现状排查报告

### 1.1 项目实际结构（实测）

```
qingwu-ui/
├── icon/                          # 空目录，无任何文件
└── plugin/
    └── calendar/
        ├── (上游日历库)/           # 某主流日历库@4.6.13 原样克隆（git status 干净）
        │   ├── src/index.ts       # 3040 行单体闭包
        │   ├── src/l10n/          # 67 个语言文件
        │   ├── src/plugins/       # 8 个插件
        │   └── src/style/         # Stylus 源 + 8 个主题
        └── lunar-javascript/      # 6tail/lunar-javascript@1.7.7 原样克隆
            └── lunar.js           # 444KB UMD 单文件，纯 JS
```

**核心事实**：
- 根目录**没有 package.json、没有 monorepo 配置、没有构建入口、没有文档**。
- 两个子目录是上游仓库的**零修改 vendor 克隆**（remote 直指上游，本地无任何 commit）。
- 两个库之间**没有任何集成代码**——所谓"农历日历"目前只是两个并排摆放的仓库。
- 本地环境 Node v22.20.0 / npm 10.9.3，与项目工具链（Node 14 时代）严重错配。

**结论：项目处于"原材料备货"阶段，尚不存在可发布的库。** 这既是最大的问题，也是最大的机会——没有历史包袱，可以直接按 2026 年最佳实践一步到位。

### 1.2 依赖老化清单（原上游日历库工具链实测）

| 类别 | 当前版本 | 2026 现状 | 代差 |
|---|---|---|---|
| TypeScript | 4.1.3 (2020) | **7.0.2**（2026-07-08 发布，native 编译器主线） | ~5 个大版本 |
| 打包器 | rollup 2 + rollup-plugin-typescript + rollup-plugin-babel | 两个插件均已 **deprecated**（被 @rollup/plugin-* 取代），现代选择为 tsdown/Rolldown | 整代淘汰 |
| CSS 预处理 | Stylus + autoprefixer-stylus | 生态萎缩；现代方案为原生 CSS + PostCSS/Lightning CSS | 整代淘汰 |
| 测试 | jest 27 + ts-jest 27 | vitest 4.x 为库生态主流 | 3 个大版本 |
| @types/node | 14 | 22/24 | 8+ 个大版本 |
| 构建编排 | 手写 build.ts（ts-node 9 + fs-extra 9 + glob 7 + chokidar） | 声明式配置（tsdown/unbuild） | 手工作坊 |
| 覆盖率 | coveralls（服务已式微） | codecov / 内置 coverage | — |
| 目标环境 | `target: es5`、browserslist `ie >= 9` | IE 已于 2022 年终止支持 | 14 年 |
| lunar-javascript | 纯 JS UMD 单文件，无构建、无类型、无 ESM | 上游已有 TS 版 lunar-typescript（活跃维护至 2025-11） | 整代 |

### 1.3 架构缺陷

**A. 日历库内核：3040 行单体闭包（src/index.ts）**
- 单个实例构造函数内含全部逻辑：状态、DOM 渲染、事件绑定、弹层定位、输入解析、i18n、移动端分支，全部挂在 `self` 对象上互相引用。
- 无法单元测试（无状态/渲染分离）、无法局部替换、无法做 tree-shaking。
- `config/rollup.ts` 的 `onwarn` 显式**吞掉** `options.ts ↔ dates.ts` 的循环依赖警告——结构性腐坏被工程配置掩盖。

**B. 模块格式倒挂**
- `main` 指向 UMD 产物，ESM 是事后补丁（`tsconfig.esm.json` 二次编译）。
- 67 个 l10n 文件各自编译为独立 UMD bundle；8 个插件同。无 `exports` 字段、无 `sideEffects: false`——**打包器无法 tree-shake**。

**C. 样式架构原始**
- 主题 = Stylus 编译出的 8 个独立 CSS 文件（airbnb/confetti/dark/light/material_*），切换主题=换文件。
- 无 design tokens、无 CSS 自定义属性、无 `@layer`——业务方覆盖样式只能拼选择器权重，这是该类日历库社区的长期痛点。

**D. lunar 侧零工程化**
- 444KB 单文件 UMD，CommonJS 包装入口，无 `exports`、无类型、不可按需引入。
- 显示一个"农历初二"需加载包含八字/道历/佛历/纳音在内的全部数据与算法。

### 1.4 产品体验痛点（PM 视角 + 上游 issue 实证）

| 痛点 | 证据 | 影响 |
|---|---|---|
| **无障碍严重缺失** | 上游 issue（2025-01）：日期格是 `<span tabindex=-1>`、仅鼠标事件，无法键盘操作；不符合 2025-06 生效的欧盟 EAA 无障碍法案 | 出海/政企合规场景直接出局 |
| **"今天"按钮缺失** | 上游 issue（2017 年提出，数十 👍，多年未关闭） | 翻到远月后无法快速回位，基础体验缺失 |
| 时区支持缺失 | 上游 issue（数十 👍）：必须靠用户自己用 moment-timezone 手工 offset | B 端跨时区排期场景不可用 |
| 年/月单选视图残缺 | 上游 issue：月报筛选等场景无原生支持 | 需 hack 或换库 |
| 移动端 native 模式割裂 | 配置开启后行为与桌面端差异大 | 双端体验不一致 |
| **核心卖点不存在** | 日历库与 lunar 两个库零集成：日期格无农历、无节气、无节假日、无调休标记 | "中国日历"定位名不副实 |
| 中文场景体验弱 | 农历/节日/节气是中文用户日历刚需，国际日历库上游永无可能支持 | 差异化机会被浪费 |

### 1.5 迭代瓶颈（实测 + 实时调研）

- **上游已事实停摆**：原日历库仓库最后 push 时间 **2024-08-02**（距今近 2 年）；npm latest 即 4.6.13（与本地克隆同版）；**852 个 open issues**；作者曾于 2019 年发 issue 公开招募维护者，开发停滞状态延续至今（该 issue 2026-04 仍有新评论但无实质进展）。→ **继续跟随上游 = 跟随一个无人维护的项目。**
- vendor 克隆没有本地 git 历史与 fork 关系，"升级"只能整库重克隆，任何定制都会丢失。
- 无 CI、无发布流程、无版本策略、无 changelog 自动化。
- 手写 build.ts 四步串行构建（build → esm → types → post 复制 typings），新成员上手即劝退。

### 1.6 性能问题

- **lunar.js 444KB 全量加载**且不可摇树：一个日期格渲染牵出整个玄学全家桶。
- `target: es5` + IE9 兼容引入大量 polyfill（`src/utils/polyfills.ts` 至今被 index.ts import）。
- 月视图切换为**全量 DOM 重建**（redraw），无 DOM 复用/差分。
- 67 个 locale 与全部主题产物常驻 dist，分发与 CDN 缓存效率低。

---

## 第二部分：2025–2026 最新技术动态（调研结论，2026-07-25 实时数据）

### 2.1 TypeScript 7 已转正为主线

- npm `typescript@latest` = **7.0.2**（发布于 **2026-07-08**）；`next` 通道已滚动至 7.1.0-dev；`rc` 通道停在 7.0.1-rc。
- 即 **TS7 不再是预览**：微软将 Go 原生移植版（typescript-go / tsgo，代号 Corsa）作为 7.0 正式发布，取代运行了 12 年的 JS 版编译器。
- 收益：类型检查**约 10 倍提速**（官方基准）、内存占用显著下降、watch/构建体验质变。
- 迁移注意点（纳入 Phase 0 验证清单）：
  1. CLI 与常用 flag 与 tsc 基本兼容，但少量遗留/弃用 API 被移除；
  2. 第三方 dts 生成管线（tsdown 内置 dts、api-extractor 等）需确认对 7.x 的适配版本；
  3. `moduleResolution` 统一到 `bundler`/`nodenext` 语义，旧的 `node` 解析行为差异需回归；
  4. 编辑器与 CI 的 TS 服务版本同步升级。

### 2.2 库构建新范式：tsdown + Rolldown

- **tsdown 0.22.14**（rolldown 官方组织出品，4.1k stars，最后 push **2026-07-23**，极度活跃）。
- 定位「The elegant bundler for libraries」，基于 Rolldown（Rust 版 Rollup）+ OXC：
  - bundler / unbundle 双模式、内置 dts 生成、ESM-first、`exports` 映射自动生成、watch 极速。
- 对"手写 build.ts + rollup + babel + ts-node"式旧管线是**降维替代**。

### 2.3 UI 库架构主流趋势（2025–2026）

- **逻辑与样式分离（headless）**：React Aria（Adobe）、Base UI（MUI + Floating UI 合体）、Radix、Ark UI(zag-js) 已成事实标准；逻辑核心框架无关，渲染层可适配 React/Vue/原生。
- **样式新基建**：CSS `@layer` 级联层管理权重、design tokens（JSON 单一数据源 → CSS 变量）、`color-mix()`、`:has()`、Popover API、CSS Anchor Positioning（弹层定位原生化）、Container Queries。
- **工程基线**：pnpm workspaces + turborepo/nx monorepo；changesets 语义化发布；vitest + testing-library + axe-core 无障碍自动化；size-limit 体积预算 CI 卡口。
- **文档即产品**：VitePress / RsPress / Starlight，内嵌 live playground。

### 2.4 日期组件赛道格局

- 原主流日历库：停摆（见 1.5），852 个 open issues 无人处理——**重写替代的时间窗口已经打开**。
- 现役标杆：react-day-picker（v9 重写）、Base UI Date Picker、duetds-date-picker（a11y 标杆，Web Components）、zag-js date-picker。共同点：headless + 全键盘 + ARIA grid 模式。
- 农历数据：原评估 **6tail/lunar-typescript**，最终决策为自研实现（`packages/calendar/ui/src/lunar.ts`，零依赖，覆盖 1900-2100 查表 + 节气年份修正）。
- **关键洞察**：所有国际方案均无中国农历/节气/节假日能力。"headless 架构 + 完整农历"是一个空白的生态位——这正是青梧UI 的差异化定位。

---

## 第三部分：重构理由（决策论证）

### 3.1 为什么不能"修修补补继续用原上游库"

| 维度 | 补丁路线的结局 |
|---|---|
| 上游 | 已停摆近 2 年，安全/兼容问题只能自维护，等于隐性 fork 却无 fork 的掌控力 |
| 架构 | 3040 行闭包单体 + 循环依赖，加农历格子渲染、a11y 重做、时区支持任一项都是开膛手术，补丁成本 ≥ 重写 |
| 合规 | a11y 问题是结构性的（span 格子 + 鼠标事件），无法局部修复，必须重做渲染层 |
| 卖点 | 农历集成需要日期格数据管线（day meta pipeline），原实现的 createDay 闭包无扩展口 |
| 工具链 | rollup-plugin-typescript/babel 已弃用，TS7 在旧管线上无法工作 |

### 3.2 为什么选 TS7（而不是稳守 TS 5.x）

1. **官方主线已切换**：7.0.2 即 latest，5.x 进入维护态。新项目从 7 起步无迁移债；从 5 起步则 12 个月内必迁。
2. **10× 类型检查提速**直接转化为迭代速度：本库核心是重类型资产（Options 契约、67 语言类型、日期模型），全量 typecheck 从分钟级降到秒级。
3. **生态窗口期**：tsdown/vitest 等工具链 2026 年已全面适配 TS7，现在切入无工具链风险。
4. 风险可控：TS7 对 tsc API 保持兼容，Phase 0 设验证关卡（见 §7）。

### 3.3 为什么采用 headless + tokens 架构

- **一次逻辑，一套原生渲染**：状态引擎与渲染层同置于 `@qingwu-ui/calendar` 包内（纯逻辑模块零 DOM 依赖、Node 可测），原生 DOM 渲染层为正统，React/Vue 仅为生命周期薄包装——测试与 bug 修复只做一遍，框架大版本升级近乎无感（决策见 §6.6）。
- **主题即数据**：tokens JSON 单一数据源，主题切换/品牌定制=改变量，终结"8 个 CSS 文件拼权重"。
- **对齐国际标准**：与 React Aria/Base UI 同构的架构语言，降低社区贡献者理解成本，利于开源传播。

### 3.4 为什么"重写内核 + 保留 API 精神"而非完全抛弃原 API

- 主流日历库（star 数万级）验证过的 **Options API 设计是优秀资产**（`mode`、`enableTime`、`enable/disable` 规则、hooks 生命周期）——继承其 API 契约可让存量用户低成本迁移。
- 继承的是**设计与测试用例**，不继承实现：实现按 headless 架构全新编写。

---

## 第四部分：产品定位与设计目标

**一句话定位**：`qingwu-calendar` —— 以**中国历法（农历/节气/节假日/调休）**为核心差异化、以**无障碍**为底线、框架无关的开源日历/日期选择组件库。

### 核心体验目标（北极星）

1. **一眼看懂的中国日期**：每个日期格默认呈现 农历日/节气/节日/调休班·休 标记，可配置密度。
2. **三步完成任何日期选择**：打开 → 方向键移动 → Enter 确认；全键盘、读屏可用。
3. **主题零成本定制**：覆盖 ≤10 个 CSS 变量即完成品牌化。
4. **按需付费的体积**：只要公历选择时，lunar 代码 0 字节进入用户 bundle。

### v1 范围（Non-goals 同样明确）

| 做 | 不做（v1） |
|---|---|
| 日/周/月/季/年视图、单选/多选/范围、时间选择 | 通用 UI 组件库（按钮/表单全家桶） |
| 农历/节气/节日/调休数据管线 | 八字/黄历宜忌等玄学功能（保留 lunar 包可选扩展口） |
| 原生 TS 实现为主体 + React/Vue 官方薄包装（Web Component 封装为 bonus） | Angular/Solid 等单独实现（可直接消费原生类，v1.x 再看） |
| 中/英/日/韩等 12 种高频语言 | 全量 67 语言首发（按需众包） |
| light/dark/青梧 三主题 + token 体系 | 可视化主题编辑器 |

---

## 第五部分：改造范围

### 5.1 删除（Delete）

- `plugin/calendar/` 下的日历库 vendor 克隆（已于 2026-07-28 删除；新库按全新架构实现，不保留旧代码参考）。
- `plugin/calendar/lunar-javascript/` vendor 克隆（已替换为 `packages/calendar/ui/src/lunar.ts` 自研实现，零外部依赖；旧归档已移除）。
- Stylus 主题系统、`ie.styl`、`utils/polyfills.ts`、IE9/es5 目标、babel 管线、手写 build.ts。

### 5.2 继承（Inherit，迁移而非复用代码）

- 原上游 `Options` 类型契约 → 重设计为 `CalendarOptions`，输出**兼容映射表**（§8）。
- hooks 生命周期设计（onChange/onOpen/onReady…）→ 类型化事件总线。
- 行为基线 → 编写**原创 vitest 用例套件**固化（选择模式/规则引擎/键盘导航/格式化，作为行为兼容的基准线）。
- 67 个 l10n 文件 → 转为 JSON 数据包 + 按需加载器。

### 5.3 新建（Create）

- monorepo 骨架、共享工具链配置、CI/CD、changesets。
- `@qingwu-ui/calendar`（**产品主体**：内置 headless 状态引擎 + 原生 DOM 渲染层 + 默认样式）、`@qingwu-ui/calendar-react` / `@qingwu-ui/calendar-vue`（生命周期薄包装，各 ~100 行）。
- `@qingwu-ui/lunar`（历法数据包）、`@qingwu-ui/icons`（样式 tokens 并入 `@qingwu-ui/calendar` 的 CSS 子路径导出，不单设包）。
- 文档站 + playground + 迁移指南 + 旧 API 兼容层 `@qingwu-ui/calendar-compat`。

---

## 第六部分：技术架构

### 6.1 仓库结构（bun workspaces + Turborepo）

```
qingwu-ui/
├── packages/
│   ├── calendar/             # ★ 日历家族（按域分组；包名不受目录深度影响）
│   │   ├── calendar/         # @qingwu-ui/calendar —— 产品主体：内置 headless 状态引擎 + 原生 DOM 渲染层 + 默认样式
│   │   │   └── src/
│   │   │       ├── state/    # reducer 式视图状态机（视图模式/选中模型/焦点格）
│   │   │       ├── model/    # 日期模型与 date-io 适配（原生 Date 为主，Temporal 预留口）
│   │   │       ├── rules/    # enable/disable/min/max 规则引擎（继承主流日历库设计）
│   │   │       ├── a11y/     # roving tabindex 焦点管理、ARIA grid 语义、键盘导航
│   │   │       ├── i18n/     # 语言包加载器 + 类型化 locale 契约
│   │   │       ├── plugins/  # 类型化插件钩子（dayMeta 管线在此注入）
│   │   │       └── render/   # 正统渲染器：节点复用、Popover/Anchor 定位、SSR 注水
│   │   │                     # exports: "." 主体 / "./css" tokens+@layer 样式 / "./themes/*"
│   │   ├── react/            # @qingwu-ui/calendar-react —— ~100 行生命周期包装（非渲染层重写）
│   │   ├── vue/              # @qingwu-ui/calendar-vue —— ~80 行生命周期包装 + v-model 桥
│   │   └── compat/           # 旧 API 兼容层（同为原生命令式 API，仅参数映射）
│   ├── lunar/                # 基于自研 lunar.ts 的按需封装（core/festival/solar-term 子路径，零依赖）
│   └── icons/                # SVG 图标
├── apps/
│   ├── docs/                 # VitePress 文档站（内嵌 playground）
│   └── playground/           # 三端联调沙箱
├── tooling/
│   └── tsconfig/             # TS7 共享配置（strict + bundler resolution）
├── reference/                # （已清空；历法数据由 packages/calendar/ui/src/lunar.ts 自研提供）
├── turbo.json / bun.lock / .changeset/
└── .github/workflows/        # ci.yml / release.yml
```

### 6.2 核心引擎设计（@qingwu-ui/calendar 内置模块）

**分层原则**：状态（纯函数）→ 渲染模型（纯数据）→ 渲染器（**原生 DOM 为正统**；框架包仅为生命周期包装）。三层均可独立单测。

```
CalendarOptions ──► [State Reducer] ──► ViewState ──► [Render Model] ──► DayCell[][] + 元数据
   ▲                    │                                    ▲
   └── dispatch(action) ◄── 事件/键盘/插件                    └── dayMeta 管线（lunar 插件注入点）
```

- **State**：`view: {mode, anchor}`、`selection: {mode, dates}`、`focus: {activeCell}`，全部纯数据、可序列化（SSR 友好——直接解决传统日历库无法 SSR 的历史问题）。
- **date-io 抽象**：v1 基于原生 Date + `Intl.DateTimeFormat`（时区通过 IANA 名显式传入，终结时区手工 offset 痛点）；接口层为未来 TC39 Temporal 留适配位，不动状态层。
- **dayMeta 管线**：`DayMetaProvider` 接口 —— `getDayMeta(date) → { lunar?, festival?, solarTerm?, holiday?, workday?, custom? }`。lunar 以插件注入，不注入则该管线与数据完全不进 bundle。
- **插件系统**：继承主流日历库 hooks 命名习惯，但全部强类型 + 生命周期明确（`onInit/onViewChange/onDayRender/onSelect/onDestroy`）。

### 6.3 样式架构（`@qingwu-ui/calendar` 样式子系统，`./css` 与 `./themes/*` 子路径导出）

```css
@layer qingwu.reset, qingwu.tokens, qingwu.base, qingwu.components, qingwu.theme;
```

- **Tokens 单一数据源**：`tokens/*.json`（color/spacing/radius/motion/typography）→ 构建产出 CSS 变量（Style Dictionary 或轻量自研脚本，Phase 0 决策）。
- 主题 = token 覆盖：内置 `light` / `dark`（跟随 `prefers-color-scheme`）/ `qingwu`（青梧东方美学主题，替代旧式多套静态主题文件）。
- 业务方定制：覆盖 `--qw-*` 变量即可，`@layer` 保证任何业务选择器权重天然高于库内样式。
- 无障碍内建：`forced-colors`（Windows 高对比）、焦点环、RTL、`prefers-reduced-motion`。
- 弹层定位：优先 CSS Anchor Positioning，不支持的浏览器降级为 JS 定位（@qingwu-ui/calendar 内 positioning 模块）。

### 6.4 构建与产物（tsdown + TS7）

| 产物 | 说明 |
|---|---|
| ESM（主） | 每包 `dist/index.mjs`，tree-shakeable，`sideEffects: false` |
| CJS（兼容） | 过渡期保留，v2 移除 |
| d.ts | tsdown 内置 dts（TS7 生成），`exports.types` 条件导出 |
| CDN bundle | 仅 @qingwu-ui/calendar 产出单文件 IIFE（给无构建环境，替代旧 UMD） |
| 样式 | tokens CSS + 组件 CSS + 主题 CSS，均按 `exports` 子路径可单独引入 |

- `package.json` 全量现代化：`exports` 条件导出、`type: module`、`files` 白名单、`engines: node >=20`、`sideEffects: ["*.css"]`。
- 体积卡口：**@qingwu-ui/calendar 主体 gzip ≤ 30KB**、lunar 子路径 gzip ≤ 30KB、CI `size-limit` 超限即红。

### 6.5 质量与发布体系

- **测试金字塔**：vitest（状态/规则等纯逻辑模块，目标覆盖 ≥90%）+ testing-library（原生渲染层）+ 框架包装层冒烟用例 + axe-core（每次渲染自动 a11y 断言）+ Playwright（E2E 键盘流与弹层定位）。
- **CI（GitHub Actions）**：lint → typecheck(TS7) → test → build → size-limit → changesets 发布 → docs 预览部署。
- **发布**：changesets 语义化版本；`0.x` 阶段快速迭代，API 冻结后发 `1.0`。
- **规范**：Conventional Commits、PR 模板、ISSUE 模板（含旧库迁移入口）。

### 6.6 决策记录：渲染层归属（v2 修订，2026-07-25）

- **背景**：原方案为独立 core 状态引擎 + DOM/React/Vue 三套渲染层。评审后改判；2026-07-31 再修订：状态引擎并入 @qingwu-ui/calendar 包内模块（原独立 calendar-core 包仅 44 行且无人实质依赖，判定独立成包无必要）。
- **决策**：**原生 TS 实现为主体**——`@qingwu-ui/calendar` 拥有唯一的正统 DOM 渲染层；React/Vue 官方包是 ~100 行的生命周期薄包装（mount/update/destroy + 事件转发），不含任何渲染逻辑；Web Component 封装作为后续 bonus。
- **理由**：
  1. **兼容红利**：原上游库本身是原生命令式 API（`lib(el, opts)` 形态），同为原生实现使 compat 层退化为参数映射，迁移≈换构造函数调用；若 React-first，兼容层须在 React 状态之上重建命令式语义，成本高一个量级。
  2. **触达面**：中文市场的真实构成 = Vue 后台 + jQuery/原生存量 + 低代码平台（消费原生组件/Web Component）+ React；原生一次打通四层。
  3. **维护面**：渲染层 bug/a11y 修复只做一遍；框架大版本升级冲击被限制在百行包装内。带宽是本项目头号风险（§9），此决策直接对冲。
  4. **先例**：FullCalendar（原生核心 + 官方框架薄包装，十年演进）、Floating UI、Pikaday、duetds（Web Components，a11y 标杆）。
- **接受的代价**：放弃 React 原生渲染的 DevTools 组件树与 SSR 优雅度（日历交互件 SSR 需求弱，静态月格输出 + 客户端 attach 可覆盖）；以文档 React 示例优先 + 官方包装 + registry React recipe 对冲 React 生态营销引力。
- **影响**：Phase 5 由 3 周压缩至 1 周，总工期 W18 → W16；包结构见 §6.1；锁定工具链不变。

---

## 第七部分：分步执行计划

> 总原则：**旧实现原地归档为参考，新库并行建设，任何阶段可停可交付**。

### Phase 0 ｜ 决策验证与基线（第 1 周）

| # | 事项 | 验收标准 |
|---|---|---|
| 0.1 | 安装 TS 7.0.2，跑通 `tsc` + tsdown 0.22 + vitest 最小链路 | hello-lib 三件套（build/typecheck/test）全绿 |
| 0.2 | 验证 tsdown dts 在 TS7 下的兼容性；确认 moduleResolution=bundler 行为 | 输出兼容性备忘，有坑则记录降级开关 |
| 0.3 | 归档 vendor 克隆至 `reference/`（保留上游 git 历史），移除 plugin/ 旧结构 | git mv 完成，旧构建可在新位置复现一次 |
| 0.4 | 冻结 `CalendarOptions` v0 契约 + 旧 API 兼容映射表草案 | 文档评审通过（§8 映射表 v0） |
| 0.5 | 技术选型拍板：tokens 工具（Style Dictionary vs 自研）、文档框架（RsPress vs VitePress） | ADR-001/002 归档 |

**关卡**：0.1/0.2 不通过 → TS7 降级 TS 5.x 最新稳定版执行（架构方案不变，仅编译器版本调整）。

### Phase 1 ｜ Monorepo 基建（第 2–3 周）

- bun workspaces + Turborepo 任务编排（build/test/lint 缓存）。
- `tooling/tsconfig`（TS7、strict、bundler resolution）、根级 Biome 2.x（lint + format 单工具）。
- changesets + GitHub Actions 骨架（ci.yml）。
- 各包空壳（package.json + exports + README stub）发布 `0.0.0-dev` 内网可装。

### Phase 2 ｜ 状态引擎（第 4–7 周）★ 全项目关键路径

- 模块拆解实现：`state`（视图状态机）→ `rules`（enable/disable/min/max）→ `model`（date-io、时区）→ `a11y`（roving tabindex、ARIA grid、全键盘导航：方向键/PageUp·Down/Home/End/Enter/Esc）→ `i18n`（JSON 语言包，首发 zh/en/ja/ko 等 12 种）→ `plugins`（dayMeta 管线）。
- **行为测试基线**：编写原创 vitest 用例套件，覆盖选择模式 / 规则引擎 / 键盘导航 / 格式化等核心行为（行为兼容的基准线）。
- 交付物：`@qingwu-ui/calendar@0.1.0` 内置状态引擎（包内纯逻辑模块，零 DOM 依赖，Node 环境可跑全部测试）。

### Phase 3 ｜ 产品主体：原生渲染层 + 样式体系（第 8–10 周）★ 渲染层正统在此

- `@qingwu-ui/calendar` render 模块：内置 ViewState → DOM 渲染（节点复用代替全量重建，解决 §1.6 重绘问题）；Popover API + Anchor Positioning（降级方案）；SSR 注水就绪；`new QingwuCalendar(el, opts)` 命令式 API（与主流日历库 API 同构，为 compat 层铺路）。
- 样式子系统（包内 `./css` 与 `./themes/*` 子路径导出）：tokens 管线跑通，@layer 结构落地，三主题 + dark mode + forced-colors + RTL。
- axe-core 集成进 CI；键盘流 E2E（Playwright）。
- 交付物：原生可用组件 + 「今天」按钮、年/月单选视图（偿还原上游库长期缺失的历史债）。

### Phase 4 ｜ 历法能力与中文增强（第 11–13 周）★ 差异化决胜点

- `@qingwu-ui/lunar`：基于自研 lunar.ts 封装，子路径拆分（`/core` 农历日/节日/节气，`/almanac` 宜忌，`/eightchar` 八字）；lunar 插件实现 @qingwu-ui/calendar 内置 `DayMetaProvider` 接口。
- 日期格信息密度三档配置（极简/标准/全量）；调休班·休标记；节假日数据年度更新机制（文档化年更流程）。
- 时区显式支持（IANA + Intl）、今日线、周数（ISO/农历周）。
- 交付物：`docs` 站内「中国日历」完整 demo；体积验证 lunar 未引入时为 0。

### Phase 5 ｜ 框架薄包装（第 14 周）★ 因 §6.6 架构修订由 3 周压缩至 1 周

- `@qingwu-ui/calendar-react`（~100 行）：useEffect 创建/destroy + props 转发 + 受控事件；React Hook Form 友好。
- `@qingwu-ui/calendar-vue`（~80 行）：onMounted/onUnmounted + v-model 桥 + slot 转发。
- 包装层零渲染逻辑 → 无行为漂移问题；测试 = 挂载冒烟 + 事件转发断言，不再跑三端行为矩阵。

### Phase 6 ｜ 兼容层、文档与首发（第 15–16 周）

- `@qingwu-ui/calendar-compat`：旧库 `(el, options)` 签名兼容 + 运行时 deprecation 提示，覆盖 80% 高频 options 映射（原生 API 同构，此层仅为参数映射函数集）。
- 文档站：组件 API、playground、a11y 说明、**旧库迁移指南**、lunar 年更说明。
- 发布 `0.1.0`（全部包），GitHub Release + npm + 文档站上线；发布博客《为什么我们重写了日历组件》。

### 里程碑总览

```
W1        W3        W7        W10       W13     W14   W16
├─ P0 ─┤── P1 ──┤──── P2 ────┤─── P3 ──┤─── P4 ──┤ P5 ┤─ P6 ─┤
基线验证  基建就绪   状态引擎    主体渲染   农历差异化  薄包装  首发 0.1.0
```

> 较 v1 计划提前 2 周首发：渲染层归一后 Phase 5 由 3 周压缩至 1 周（决策见 §6.6）。

---

## 第八部分：API 兼容与迁移策略

`CalendarOptions` 对原上游库 `Options` 的映射原则（Phase 0 冻结 v0 全表）：

| 旧 API | 青梧 | 策略 |
|---|---|---|
| `mode: "single"/"multiple"/"range"` | `selection.mode` | 结构重命名，compat 层自动映射 |
| `enableTime`/`noCalendar` | `time.enabled`/`views` | 正交化为视图配置 |
| `enable`/`disable`/`minDate`/`maxDate` | `rules.enable/disable/min/max` | 语义保留（规则引擎直接继承设计） |
| `onChange`/`onOpen`… hooks | `on(event, handler)` + 同名快捷 props | 类型化事件总线 |
| `locale` | `i18n.locale`（JSON 包） | 数据结构兼容，加载方式改为按需 import |
| `plugins: [confirmDate(…)]` | `plugins: [plugin(…)]`（类型化钩子） | API 同构，旧插件不直接兼容（提供迁移样例） |
| `altInput`/`altFormat`/`dateFormat` | `input.format/display` | 合并简化 |
| 主题 CSS 文件切换 | `--qw-*` tokens 覆盖 | 提供旧主题 → tokens 对照表 |

迁移路径：**兼容层过渡（v0.x）→ 文档迁移指南 → v1.0 前移除兼容层独立为可选包**。

---

## 第九部分：风险评估与对策

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| TS7 工具链个别环节不兼容（dts/编辑器） | 中 | 中 | Phase 0 设硬关卡，降级开关=TS 5.x，架构零损失 |
| 自研 lunar 算法准确性 | 低 | 中 | 基于天文台历书数据持续校验；节假日期手工维护（数据与算法解耦） |
| 框架大版本冲击包装层 | 低 | 中 | 包装层仅生命周期胶水（各 ~100 行）无渲染逻辑；冒烟用例随框架版本跑 |
| 重写期原上游库存量用户流失 | 中 | 中 | compat 层 + 迁移指南先行，v0.x 即可接管 |
| 体积预算失守 | 中 | 中 | size-limit CI 卡口，lunar 强制按需（子路径 + sideEffects） |
| a11y 回归 | 中 | 高 | axe 进 CI 必跑，E2E 键盘流用例，发版前读屏人工冒烟 |
| 单人/小团队带宽不足 | 高 | 高 | Phase 2/4 为最小可发布闭环（状态引擎 + 农历），其余可后置；开源众包 l10n |

---

## 第十部分：验收指标（KPI）

**工程效率**
- TS7 全量 typecheck < 10s；tsdown 冷构建 < 5s；CI 全流程 < 8min。

**产物质量**
- @qingwu-ui/calendar 主体 gzip ≤ 30KB；lunar 子路径 gzip ≤ 30KB；状态/规则模块测试覆盖 ≥ 90%；框架包装层合计 < 300 行源码。

**体验与合规**
- axe-core 零违规；WCAG 2.2 AA；全键盘完成所有选择操作 ≤ 3 次按键（常用路径）；NVDA/VoiceOver 冒烟通过。

**生态目标（首发 6 个月）**
- npm 周下载 > 1k；文档站 UV > 5k/月；至少 1 个外部贡献的 l10n/主题 PR。

---

## 附：一页纸决策摘要

| 问题 | 答案 |
|---|---|
| 现在是什么状态？ | 两个停摆/陈旧上游库的零修改克隆，无集成、无工程、无文档——尚不是"库" |
| 为什么必须重构？ | 上游停摆（852 issues 无人管）+ 3040 行闭包单体 + a11y 结构性缺失 + 农历卖点零实现，补丁成本 > 重写 |
| 为什么是 TS7？ | 2026-07-08 起 7.0.2 已是 npm latest（native 编译器主线），10× 类型检查提速，新债不如不欠 |
| 用什么构建？ | tsdown 0.22（Rolldown 系，2026-07-23 仍在活跃迭代），替代已弃用的 rollup2+babel 全家桶 |
| 架构一句话？ | 原生 TS 为主体（@qingwu-ui/calendar 内置 headless 状态引擎 + 原生 DOM 正统渲染）+ React/Vue 百行薄包装 + token/@layer 样式 + 农历 dayMeta 管线（§6.6） |
| 差异化是什么？ | 国际全线日历组件均无中国历法能力——这是空白生态位 |
| 多久见到成果？ | W7 状态引擎可测、W10 原生组件可用、W13 农历差异化落地、**W16 首发 0.1.0**（渲染层归一后提前 2 周） |
| 最大风险？ | 带宽；对策是 Phase 2+4 构成最小发布闭环，其余可众包/后置 |
