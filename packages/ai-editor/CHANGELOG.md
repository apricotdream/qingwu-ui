# @qingwu-ui/ai-editor

## 0.9.0-beta.26
### Patch Changes

- 尺寸单位改为 rem 为主：间距、字号、控件尺寸跟随浏览器字号设置；弹层与全屏高度改用 dvh/svh，适配移动端浏览器工具栏；大标题用 clamp 随屏幕宽度平滑缩放；贴边元素避开刘海与底部安全区。

## 0.9.0-beta.25
### Patch Changes

- **依赖模型调整（含迁移说明）**：把 Tiptap 全套（`@tiptap/core`、`@tiptap/react` 及各扩展，`^3.28.0`）和文件预览全套（`@file-viewer/react` 及 pdf / word / spreadsheet / presentation / archive / text 渲染器，`2.2.2`）从 peerDependencies 移到 dependencies。库构建仍把它们标记为 external、**不打进 bundle**，所以运行时依旧是同一份共享模块，不会出现 Tiptap 双实例；改的只是"由谁安装"——现在 `npm install @qingwu-ui/ai-editor` 会自动带入，用户无需再手动逐个安装、也不会版本错配。React / react-dom 与 `ai` 仍是必需 peer，`@ai-sdk/openai`、`devicon` 仍是可选 peer。
- **新增附件预览资源 CLI**：文件预览的 worker / wasm / 字体不是普通 JS 模块，npm install 不会放进静态目录。新增 bin 命令 `npx @qingwu-ui/ai-editor copy-assets [--out 目录]`，从已安装的 `@file-viewer` 包及其传递依赖（pdfjs-dist、@file-viewer/ppt、@file-viewer/docx、@file-viewer/pptx、libarchive.js、@fontsource-variable/noto-sans-sc、renderer-spreadsheet）抽出资源，拷到 `public/file-viewer/`，与 `FILE_VIEWER_OPTIONS` 默认的 `/file-viewer/vendor/...` 路径对齐。定位方式是以各 `@file-viewer/renderer-*` 为锚点创建 require 再解析传递依赖，兼容 bun 隔离 node_modules 与 npm/pnpm 布局。
- **迁移**：升级到本版后，可从项目 dependencies 中删掉此前手动安装的 `@tiptap/*` 与 `@file-viewer/*`（它们已由本包自动带入）；随后在项目根目录执行一次 `npx @qingwu-ui/ai-editor copy-assets` 准备附件预览静态资源。需要自定义 Tiptap 扩展的高阶用户，仍可自行安装 `@tiptap/*`（`^3.28.0`），包管理器提升为同一实例后即可正常注册。

## 0.9.0-beta.24
### Patch Changes

- 文档与演示页更新：README 补全手写 `` `代码` `` 行内代码行首/行中/行尾均可识别、气泡菜单二级面板自动避让边缘两项说明；演示页顶部工具栏新增「更新日志」入口（📝），弹窗按版本列出 beta.19 起的修复记录。本次只改文档与演示页，不改编辑器运行时代码

## 0.9.0-beta.23
### Patch Changes

- 修复手写 `` `代码` `` 在行尾不能生成行内代码：ProseMirror 自带的 codeInRule 正则含 `(?=.)` 前瞻，要求闭合反引号后还存在一个字符，因此用户在行末敲完闭合反引号（或敲完直接回车）时不触发，反引号原样残留。新增 `InlineCodeEnd` 扩展，补一个去掉前瞻的输入规则（`` `([^`]+)`$ ``），闭合反引号位于文本块结尾也能转换为 code 标记；闭合后仍有内容时继续走原有规则，二者不冲突

## 0.9.0-beta.22
### Patch Changes

- 图片/附件与正文纵向间隔再收窄二分之一：在 beta.21（约 13px）基础上，把外层块容器 `.node-image` 与附件块 `.attachment-embed` 的负外边距由 `-7px` 加大到 `-13px`，段落 20px 留白被抵至约 **7px**。真机实测图片上、下间距均为 7px；编辑态与只读态共用同一套 CSS

## 0.9.0-beta.21
### Patch Changes

- 收窄图片/附件与正文之间的纵向间隔约三分之一：此前图片、附件节点自身留白与段落 `prose` 外边距叠加（块级格式化上下文阻止外边距合并），相邻文字被撑开约 20px，多处堆叠时更大。统一间距来源——间距只加在 ProseMirror 为图片节点生成的外层块容器（`.node-image`，NodeViewWrapper 的 `.image-node-view` 是其内部元素，加在内部无效）及附件嵌入块（`.attachment-embed`）上，并以 `-7px` 负外边距把段落 20px 留白收至约 13px。编辑态与只读态共用同一套 CSS，表现一致
- 修复气泡菜单「高亮 / 链接」二级子面板被编辑器下边缘遮挡：子面板改为 `createPortal` 挂到 `document.body`，摆脱祖先 `overflow:hidden` 裁切以及 GSAP 等祖先 `transform/filter` 对 `position:fixed` 包含块的劫持；新增挂载后测量的边界翻转——当 `锚点底部 + 8 + 面板高度` 超过视口高度时自动翻转到气泡上方（`useLayoutEffect` 读真实 `offsetHeight`，避免首帧定位拿不到高度）；滚动页面（捕获阶段监听，兼容内部滚动容器）自动收起面板，窗口 resize 时按真实高度重新计算定位

## 0.9.0-beta.20
### Patch Changes

- 修复目录面板在编辑器卸载/重挂载竞态下抛 `[tiptap error]: The editor view is not available. Cannot access view['dom']`：TocPanel 的滚动监听器 / rAF / 点击回调可能比编辑器实例多活一帧（快速往返导航、HMR、StrictMode 双挂载），tiptap v3 在 view 已销毁（`editorView` 置空）后访问 `dom` 即抛错。新增并导出 `getEditorDom(editor)` 统一安全读取（先判 `isDestroyed`，再 try/catch 兜底，拿不到返回 null）；收集标题、滚动容器识别、点击跳转以及桌面侧栏滚轮「到边接棒」四处改为无 DOM 即静默跳过，不再把瞬时挂载窗口冒泡成整页错误

## 0.9.0-beta.19
### Patch Changes

- 桌面目录悬浮框改为 `createPortal` 挂到 `document.body`（同 beta.16 移动抽屉）：修复宿主存在 GSAP 入场/步骤切换动画时，`fixed` 目录在动画进行中被祖先内联 `transform` 抢走包含块，先按祖先 padding box 定位（闪现在编辑器内部）、动画 `clearProps` 后再跳到视口右侧的问题。目录样式均为全局选择器（`.qingwu-toc-desktop` / `.toc-*` / `.toc-scroll` / `.dark`），脱离 `.qingwu-editor` 作用域后表现不变；宿主以 DOM 后代关系锚定目录的选择器/观察器需改为 body 直子节点；另注意：编辑器实例常驻、仅靠祖先 `display:none` 切走编辑视图的宿主，`hidden` 不再连带隐藏 portal 出 body 的目录（桌面 aside 与移动抽屉均是），需按自身步骤/视图状态额外收掉（如 `body:has(.scene:not([data-step="1"])) > .qingwu-toc-desktop { display:none }`）

## 0.9.0-beta.18
### Patch Changes

- 修复代码块内搜狗/QQ 拼音「空格选词上屏」在行尾残留空位：Chromium×搜狗在 compositionend 提交候选词的同一按键里会额外派发一次 `beforeinput insertText " "`（isComposing=false），被当作普通输入插入；段落因 `white-space:normal` 折叠尾随空格不可见，代码块 `pre-wrap` 全量保留而暴露。新增 `ImeCommitSpaceGuard` 扩展：组合结束（compositionend / isComposing 的 input 上屏）后 100ms 内的 insertText 空格一律吞掉，组合进行中的空格与用户隔 100ms 后主动键入的空格不受影响

## 0.9.0-beta.17
### Patch Changes

- 桌面目录悬浮框「到边接棒滚正文」：悬浮框自身滚到顶/底后滚轮接力滚动编辑器正文；同时移除 beta.16 挂在悬浮框上的 `data-lenis-prevent`（该项让宿主 Lenis 直接接管滚轮，悬浮框内滚不动目录）

## 0.9.0-beta.16
### Patch Changes

- 移动端目录抽屉修复：portal 挂到 body 不再被导航栏遮挡；点击面板外自动收起；抽屉内浮动按钮上移避让「返回顶部」；修复目录项需点两次才跳转的问题

## 0.9.0-beta.15
### Patch Changes

- 代码块行号列真机底部对齐修复；深色主题代码块边框提亮

## 0.9.0-beta.14
### Patch Changes

- TOC 目录滚动自动跟踪：滚动编辑器内容时目录实时高亮当前所在章节，激活项自动滚动保持在目录视野内。跟踪引擎由 IntersectionObserver 重写为滚动位置扫描——IO 方案存在两处本质缺陷：其一缓存的 heading DOM 引用在 ProseMirror 重渲染替换节点后整体脱链（isConnected=false），observer 一直在观察已不存在的节点，跟踪完全失效；其二 IO 为边缘触发且缓存坐标过期，快速滚动会漏检。新方案监听滚动容器（自动识别 window / 内层滚动 div）scroll + resize，rAF 节流逐帧扫描，缓存脱链即现场重收集标题。激活规则为「最后一个越过基准线的标题」，基准线 84px 与标题 scroll-margin-top: 5rem 对齐（点击跳转落定即高亮零误差）；滚动到底强制激活末节（末节可能永远到不了基准线）；首个标题之上清空高亮
- TOC 点击跳转锁定：点击目录平滑滚动期间高亮锁定目标标题，中间标题不再逐个抢占产生闪烁；目标越过基准线 / 滚轮触摸手动接管 / 3s 兜底超时自动解锁
- TOC 折叠降级：激活项被祖先折叠遮住时改为高亮其最近可见祖先（尊重手动折叠，不自动展开）；目录面板自滚动用 scrollTop 手动计算，仅出视野时移动（nearest 语义防抖动），不连带滚动页面

## 0.9.0-beta.13
### Patch Changes

- 代码块解析兼容 Obsidian 逐行 div 包裹：`<pre><code><div>行</div>…</code></pre>` 时 ProseMirror 对 content:text* 的 codeBlock 只保留首行、后续行丢失（表现为「代码块只包住第一句」）。`parseHTML` 增加 `getContent`：存在行级 div 时按行拼接 `\n` 取全量文本，否则取 `textContent`。
- `initialContent` 支持 ProseMirror JSON 文档对象：对象原样透传（跳过 looksLikeMarkdown/sanitize 字符串预处理），宿主回显可直传 `getJSON()` 产物，避免 string→markdown 二次解析把代码块围栏破坏。

## 0.9.0-beta.12
### Patch Changes

- 代码块移除 2000px 高度硬裁：`.cb-code-area` 的 `max-height:2000px; overflow:hidden` 会让超过约 84 行（2000px/24px 行高）的代码块底部被裁且无滚动条，表现为「代码块被截断」（宿主粘贴 Obsidian 长代码块时复现）。改为 `max-height:none` 随内容自然撑高，滚动交给外层容器；折叠态 `.cb-code-area--collapsed` 仍收至 56px（`overflow:hidden` 兜底）。副作用：折叠/展开无 max-height 过渡动画（跳变）

## 0.9.0-beta.11
### Patch Changes

- sanitize 放行 `blob:` URI：DOMPurify 默认过滤 blob: 导致预览/详情回显编辑器内容时，拖入媒体的 blob 占位 src 被清空（视频嵌入 src 变空、无法触发上传中占位）；显式 `ALLOWED_URI_REGEXP` 放行 blob:（会话内同源，安全）
- 视频嵌入只读态上传中占位（随 0.9.0-beta.10 发布，补记）：view 模式 + src 为 blob: 时显示「视频上传中…」动画，替代黑屏播放器

## 0.9.0-beta.10
### Patch Changes

- 视频嵌入（videoEmbed）只读态（预览/详情）下 src 仍为 blob 时显示「视频上传中…」动画占位：此前直接创建播放器播 blob，上传完成瞬间 blob 被 revoke 或初始化失败会黑屏；现派生判断 `blob:` 前缀 + 非编辑态，优先于编码不支持占位渲染，上传完成换持久 URL 后经宿主 contentHtml 更新自动切回播放器

## 0.9.0-beta.9
### Patch Changes

- 视频嵌入（videoEmbed）编码不受浏览器支持时显示友好占位：浏览器缺 HEVC/H.265 解码器时 `<video>` 触发 `MEDIA_ERR_SRC_NOT_SUPPORTED`（code 4），此前黑屏 / 显示「不支持的音频或格式」；现捕获该错误改为占位提示（说明原因 + 引导安装 HEVC 扩展或转码 H.264），编辑与只读预览均生效，占位保留删除/全屏工具栏入口

## 0.9.0-beta.7
### Patch Changes

- 修复代码块行号列与内容底部错位：库内 `.qingwu-editor .ProseMirror pre`（特异性 0-2-1）覆盖自定义代码块 `.cb-code-pre`（0-1-0）的 `padding`/`line-height`，导致行号列垂直度量（.75rem / 24px）与代码区（1rem / 1.7）不一致、行号列底部比内容高出一段；改为通用 pre 规则排除 `.cb-code-pre`（`pre:not(.cb-code-pre)`），卡片视觉（背景/边框/圆角）移入 `.cb-code-pre` 自身，补齐 dark / 选中态边框，行号与代码逐行对齐

## 0.9.0-beta.4
### Patch Changes

- 修复 slash 命令框列表滚轮被宿主 Lenis 劫持：弹窗 portal 到 body 不在宿主 `data-lenis-prevent` 子树内，滚轮事件被 Lenis `preventDefault` 吞掉、列表无法滚动；弹窗自身挂 `data-lenis-prevent` 放行原生滚动
- 修复键盘导航选中项滚出可视区：ArrowUp/Down 切换选中项后不再原地停留，列表自动滚动让选中项进入可视区（`scrollTop` 按需修正，不依赖 `scrollIntoView` 以免联动页面滚动）

## 0.9.0-beta.3
### Patch Changes

- 修复工具栏「目录」按钮在宽屏点击时抽屉与侧栏同时出现：点击分支原以 `desktopTocVisible`（此刻恒为 false）判断是否叠开抽屉，导致宽屏下两个面板重叠；改为按展开后的侧栏可显示性（`isWide && 非全屏`）决定，宽屏只出侧栏、窄屏/全屏才叠开抽屉

## 0.9.0-beta.2
### Patch Changes

- 修复目录切换按钮在预构建 CSS 下恒被隐藏的问题：`@media (width < 64rem)` 被构建器转译为 `@media not all and (width>=64rem)`，在 Chromium 下实际恒命中，导致 `--desktop-only` 按钮（含目录开关）对使用预构建产物（如 Vite 应用）的宿主全部隐藏；改为 `(max-width: 63.999rem)` 等价写法，仅 <64rem 隐藏

## 0.9.0-beta.1
### Patch Changes

- TOC 目录语义统一为「默认展开状态」：`showToc={false}` 不再关闭目录功能，而是**控件可用但默认收起**（工具栏按钮 / 悬浮球 / 抽屉仍可展开），实现宿主「默认关闭」诉求
- 只读（view）态下文档含标题时亮出目录悬浮球作为唯一入口，点击展开目录抽屉；窄屏（<64rem）编辑态工具栏目录按钮隐藏后同样由悬浮球接管入口
- 新增内部 `hasHeadings` / `isDesktop` 状态：仅当文档存在 h1~h6 标题且工具栏按钮不可见时才展示悬浮球，避免无标题文档空转悬浮球

## 0.9.0-beta
### Minor Changes

- 版本统一对齐 0.9.0（无功能变更；首次以 @qingwu-ui scope 发布，@qingwu → @qingwu-ui 品牌迁移）


## 0.8.0

### Minor Changes

- AI 面板宽度随编辑器宽度自适应、左缘对齐编辑器左缘（无法测量编辑器宽度时回退 288px），面板高度钳进视口（`max-height` + flex 布局），避免撑高编辑器引发滚动跳变
- AI 替换（选中 / 全文）前弹确认弹窗：列出本次将被移除的媒体节点（图片 / 附件 / 视频 / 音频），确认后才执行替换
- 全文 / 选区替换后的**孤儿媒体资源延迟删除**：替换后「旧文档有、新文档无」的资源异步从存储删除，带 30s 延迟窗口——期间 `undo`（Ctrl+Z）把 URL 还原回文档即取消删除，避免「undo 后图片 404」；编辑器销毁时立即 flush 剩余孤儿
- 依赖：`@qingwu-ui/toast` 保持 `^0.8.0`

## 0.7.3

### Patch Changes

- AI 面板锚定工具栏按钮：点击 AI 按钮时面板贴近按钮下沿弹出（`createPortal` 挂载）

## 0.7.2

### Patch Changes

- 新增：粘贴外部 Markdown（Obsidian / Typora 等）时，**本地相对路径图片/附件自动检测与解析**（新增 `RelativeMedia` 扩展，随 `getEditorExtensions` 默认启用）：
  - 剪贴板随文本带入的文件按文件名匹配后直接上传换链，无需用户操作；
  - 剪贴板没有文件时弹窗说明原因，用户同意后通过系统文件夹选择器按相对路径读取（File System Access API，Chrome / Edge；精确路径 → 去头段 → basename 兜底）；
  - 不支持文件夹读取的浏览器（Safari / Firefox）降级为"拖拽文件进编辑器"引导弹窗；
  - 每个文件先过附件限额校验，完成后 toast 汇总"已上传 / 仅本次可见 / 找到但读取失败（云同步占位文件引导「始终保留在此设备」）/ 未找到清单"，不再留下无声碎图；放弃选择文件夹时也明确提示占位状态与拖拽补救路径
  - 诚实计数："已上传至存储"只在换链后的存储 URL **真实渲染出图片**后才计入（Image 解码探针，私有桶走与 ImageView 一致的签名请求 + blob 回退）；上传成功但页面仍是碎图时如实报"上传成功但页面渲染失败"，不再虚报成功数
  - 兜底：目录方式仍有遗漏（云同步占位文件、文件夹名匹配不上等）时，弹窗引导用系统文件选择器直接选文件（可多选），按文件名匹配后直传——系统对话框走 OS 外壳，能取到真实字节
  - 修复：同一文件既以图片节点嵌入、又被链接引用（`[Open: x.png](x.jpeg)`，Obsidian 常见导出形状）时，引用收集按 src 去重会**跨类型互吞**——链接先命中、图片节点被跳过，表现为"toast 报已上传但图片占位永久残留"；现链接型与节点型各自收集、各自换链
  - 计数与上传按**文件归组**：上述节点型 + 链接型引用归为一组，同一文件的字节只读取/上传一次，组内所有节点与链接共享同一存储 URL，"已上传"只计一次——修复"粘 5 张图 toast 却报 10 个已上传"（每张图的节点与 Open: 链接被重复上传、重复计数）；授权/降级弹窗的"检测到 N 个本地图片/附件"同口径改为文件数
  - 编排稳定性：多图粘贴**只弹一次**授权弹窗（收尾阶段复用已授权目录补齐新出现的引用，不弹第二次）；**文档是唯一事实来源**——重粘、撤销回滚后再次出现的同路径引用会重新解析，不会因"曾解析成功"被永久跳过、留下无声占位；失败/取消后暂停探测到下一次粘贴再重试，不会随每次击键重复弹窗；链接型附件换链成功才计"已上传"
- 重构：Obsidian `[[wiki]]` 粘贴不再把剪贴板文件转 base64 dataURL 内联进文档（一次性且膨胀文档），统一走"objectURL 占位预览 → 上传 → 换持久 URL"管线
- 移除：已无调用的手写 Markdown 兜底解析器（`_obsidianToFragment` 及关联约 450 行死代码）
- 修复：AI 模型调用显式走 `openai.chat()`（`/chat/completions`）——`@ai-sdk/openai` 默认调用走 Responses API（`POST /responses`），DeepSeek / 通义 / GLM 等兼容端点会 404
- 修复：`showToc` prop 运行期变化（宿主读者侧目录开关）同步进内部状态，初值仍取 prop
- 依赖：`@qingwu-ui/toast` 升至 `^0.8.0`（`description` 详情行 / `action` 操作按钮）

## 0.7.0

### Minor Changes

- Toast 提示默认**常驻不自动消失**（`persist: true`）+ **内容完整显示**（不再按行截断）：`toast()` 通道统一生效，长提示完整展示
- `onToast` 回调新增第三参 `options`（透传 `persist` / `maxLines` / `duration`）；旧二参签名自动兼容，宿主无需改动
- 内置兜底 `@qingwu-ui/toast` 同步升级 `^0.7.0`（`persist` / `persistMaxVisible` 数量上限 / 默认去截断）

## 0.6.1

### Patch Changes

- **@qingwu-ui/ai-editor**

  - 修复：Toast 提示默认内置 `@qingwu-ui/toast` 渲染（不再静默丢弃），新增 `setToastProvider()` 全局替换与 `onToast` 实例级覆盖，并支持 `maxLines` / `duration` 透传
  - 新增：删除确认开放 `setConfirmProvider()` 覆盖接口，默认仍用内置项目 `DeleteConfirmDialog`，6 处删除流程（图片/视频/音频/附件/代码块/表格）统一生效
  - 修复：MD 导入选择兜底由原生 `window.confirm` 改为内置项目风格弹窗（渲染/附加/取消），取消不再误附加
  - 修复：Obsidian 粘贴本地路径图片/视频警告改走统一 toast 通道
  - 新增：图片加载失败（本地路径/远程加载失败）占位支持右上角删除按钮（带确认弹窗）

  **@qingwu-ui/upload**

  - 修复：依赖对齐 `@qingwu-ui/button` `^0.5.0` → `^0.6.0`

## 0.6.0

### Patch Changes

- 版本统一对齐 0.6.0（无功能变更；`@qingwu-ui/tag-input` 随本版首次发布）

## 0.5.0

### Minor Changes

- 包更名 `@qingwu-ui/editor` → `@qingwu-ui/ai-editor`（组件类 `QingWuAIEditor`，README/文档同步更新）

  - **Toast 解耦**：不再内置 Toast 渲染宿主，改为模块级事件通道 `toast()` / `subscribeToast()`；`QingWuAIEditor` 通过 `onToast` 回调把消息转发给宿主自己的 Toast 组件（如 `@qingwu-ui/toast`），未传 `onToast` 时消息静默丢弃
  - **附件限制运行期可调**：新增 `getEditorAttachmentLimits`，上传路径从编辑器 storage 实时读取当前限制，宿主运行期更新配置即时生效（tiptap setOptions 不重建扩展，配置变更走 storage）
  - clipper 抓取、README 等随更名同步更新

## 0.4.0

### Minor Changes

- `QingWuAIEditor` 新增必填 props：`maxAttachmentSize`（单文件上传大小上限）与 `maxTotalAttachmentSize`（文档内附件总大小上限）。全部上传路径（拖拽/粘贴、图片弹窗、斜杠命令）在插入前同步校验，超限直接拦截并 toast 提示；加载已超限的旧文档时发警告、不阻止编辑
- 为 `videoEmbed` / `audioEmbed` / `image` 节点新增 `size` 属性，附件总大小统计覆盖 attachment/video/audio/image 四类节点；导出 `validateAttachmentFile` / `getDocAttachmentTotal` / `formatBytes` 工具函数
- 修复斜杠命令 `/audio` `/attachment` 仅创建 blob URL 占位（刷新失效、文件不持久化）的问题：改为走存储上传并替换为真实 URL

### Patch Changes

- - `@qingwu-ui/upload` 新增 `supportedFormats` 属性：图片格式白名单（无点扩展名），指定后映射为 input accept 并驱动拖拽区提示文案；不传默认全支持（原行为不变）
  - 图片上传支持 AVIF：`@qingwu-ui/upload` 拖拽区提示文案、editor 图片上传对话框白名单与文案补充 avif（editor 其余图片识别路径早已支持）
- 版本统一对齐至 0.4.0

## 0.3.1

### Patch Changes

- 版本统一对齐 0.3.1。工程级更新：发版流程接入 `bun run publish-check` 产物校验门禁（workspace 依赖残留 / CHANGELOG 版本一致 / exports 产物齐全）；新增 Playwright e2e（拖拽上传、压缩产出 WebP/AVIF、单张限制、按钮触发、真实上传）；README 同步 0.3.0 状态与 upload 组件文档。

## 0.3.0

### Minor Changes

- 版本统一对齐 0.3.0，API 完全兼容，无行为变更。

## 0.2.0

### Minor Changes

- 版本统一对齐 0.2.0。面向中文用户的 AI 智能编辑器 `QingWuAIEditor`（Tiptap/ProseMirror 内核）：
  - 编辑能力：斜杠命令（`createSlashCommandExtension`）、代码块高亮（`CodeBlock`）、搜索高亮（`SearchHighlight`）、图片上传、视频嵌入、目录面板（`TocPanel`）；
  - AI 写作助手：LangChain.js 统一接口（`setAIProvider` / `getAIProvider`），内置 OpenAI / DeepSeek / Qwen Provider；
  - i18n（`setLocale` / `t` / `tf`）、存储插件（本地 / COS / OSS / S3）、HTML 安全工具（`sanitizeHtml` / `sanitizeSvg`）；
  - Web Clipper：浏览器端接收器经主入口导出，Node HTTP 接收器经独立子入口 `@qingwu-ui/ai-editor/clipper` 暴露。
