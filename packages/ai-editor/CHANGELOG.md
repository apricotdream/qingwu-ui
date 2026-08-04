# @qingwu/ai-editor

## Unreleased

### Minor Changes

- 新增：粘贴外部 Markdown（Obsidian / Typora 等）时，**本地相对路径图片/附件自动检测与解析**（新增 `RelativeMedia` 扩展，随 `getEditorExtensions` 默认启用）：
  - 剪贴板随文本带入的文件按文件名匹配后直接上传换链，无需用户操作；
  - 剪贴板没有文件时弹窗说明原因，用户同意后通过系统文件夹选择器按相对路径读取（File System Access API，Chrome / Edge；精确路径 → 去头段 → basename 兜底）；
  - 不支持文件夹读取的浏览器（Safari / Firefox）降级为"拖拽文件进编辑器"引导弹窗；
  - 每个文件先过附件限额校验，完成后 toast 汇总"已上传 / 仅本次可见 / 未找到清单"，不再留下无声碎图
- 重构：Obsidian `[[wiki]]` 粘贴不再把剪贴板文件转 base64 dataURL 内联进文档（一次性且膨胀文档），统一走"objectURL 占位预览 → 上传 → 换持久 URL"管线
- 移除：已无调用的手写 Markdown 兜底解析器（`_obsidianToFragment` 及关联约 450 行死代码）

## 0.7.0

### Minor Changes

- Toast 提示默认**常驻不自动消失**（`persist: true`）+ **内容完整显示**（不再按行截断）：`toast()` 通道统一生效，长提示完整展示
- `onToast` 回调新增第三参 `options`（透传 `persist` / `maxLines` / `duration`）；旧二参签名自动兼容，宿主无需改动
- 内置兜底 `@qingwu/toast` 同步升级 `^0.7.0`（`persist` / `persistMaxVisible` 数量上限 / 默认去截断）

## 0.6.1

### Patch Changes

- **@qingwu/ai-editor**

  - 修复：Toast 提示默认内置 `@qingwu/toast` 渲染（不再静默丢弃），新增 `setToastProvider()` 全局替换与 `onToast` 实例级覆盖，并支持 `maxLines` / `duration` 透传
  - 新增：删除确认开放 `setConfirmProvider()` 覆盖接口，默认仍用内置项目 `DeleteConfirmDialog`，6 处删除流程（图片/视频/音频/附件/代码块/表格）统一生效
  - 修复：MD 导入选择兜底由原生 `window.confirm` 改为内置项目风格弹窗（渲染/附加/取消），取消不再误附加
  - 修复：Obsidian 粘贴本地路径图片/视频警告改走统一 toast 通道
  - 新增：图片加载失败（本地路径/远程加载失败）占位支持右上角删除按钮（带确认弹窗）

  **@qingwu/upload**

  - 修复：依赖对齐 `@qingwu/button` `^0.5.0` → `^0.6.0`

## 0.6.0

### Patch Changes

- 版本统一对齐 0.6.0（无功能变更；`@qingwu/tag-input` 随本版首次发布）

## 0.5.0

### Minor Changes

- 包更名 `@qingwu/editor` → `@qingwu/ai-editor`（组件类 `QingWuAIEditor`，README/文档同步更新）

  - **Toast 解耦**：不再内置 Toast 渲染宿主，改为模块级事件通道 `toast()` / `subscribeToast()`；`QingWuAIEditor` 通过 `onToast` 回调把消息转发给宿主自己的 Toast 组件（如 `@qingwu/toast`），未传 `onToast` 时消息静默丢弃
  - **附件限制运行期可调**：新增 `getEditorAttachmentLimits`，上传路径从编辑器 storage 实时读取当前限制，宿主运行期更新配置即时生效（tiptap setOptions 不重建扩展，配置变更走 storage）
  - clipper 抓取、README 等随更名同步更新

## 0.4.0

### Minor Changes

- `QingWuAIEditor` 新增必填 props：`maxAttachmentSize`（单文件上传大小上限）与 `maxTotalAttachmentSize`（文档内附件总大小上限）。全部上传路径（拖拽/粘贴、图片弹窗、斜杠命令）在插入前同步校验，超限直接拦截并 toast 提示；加载已超限的旧文档时发警告、不阻止编辑
- 为 `videoEmbed` / `audioEmbed` / `image` 节点新增 `size` 属性，附件总大小统计覆盖 attachment/video/audio/image 四类节点；导出 `validateAttachmentFile` / `getDocAttachmentTotal` / `formatBytes` 工具函数
- 修复斜杠命令 `/audio` `/attachment` 仅创建 blob URL 占位（刷新失效、文件不持久化）的问题：改为走存储上传并替换为真实 URL

### Patch Changes

- - `@qingwu/upload` 新增 `supportedFormats` 属性：图片格式白名单（无点扩展名），指定后映射为 input accept 并驱动拖拽区提示文案；不传默认全支持（原行为不变）
  - 图片上传支持 AVIF：`@qingwu/upload` 拖拽区提示文案、editor 图片上传对话框白名单与文案补充 avif（editor 其余图片识别路径早已支持）
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
  - Web Clipper：浏览器端接收器经主入口导出，Node HTTP 接收器经独立子入口 `@qingwu/ai-editor/clipper` 暴露。
