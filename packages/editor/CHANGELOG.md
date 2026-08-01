# @qingwu/editor

## 0.4.0

### Minor Changes

- `QingWuEditor` 新增必填 props：`maxAttachmentSize`（单文件上传大小上限）与 `maxTotalAttachmentSize`（文档内附件总大小上限）。全部上传路径（拖拽/粘贴、图片弹窗、斜杠命令）在插入前同步校验，超限直接拦截并 toast 提示；加载已超限的旧文档时发警告、不阻止编辑
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

- 版本统一对齐 0.2.0。面向中文用户的 AI 智能编辑器 `QingWuEditor`（Tiptap/ProseMirror 内核）：
  - 编辑能力：斜杠命令（`createSlashCommandExtension`）、代码块高亮（`CodeBlock`）、搜索高亮（`SearchHighlight`）、图片上传、视频嵌入、目录面板（`TocPanel`）；
  - AI 写作助手：LangChain.js 统一接口（`setAIProvider` / `getAIProvider`），内置 OpenAI / DeepSeek / Qwen Provider；
  - i18n（`setLocale` / `t` / `tf`）、存储插件（本地 / COS / OSS / S3）、HTML 安全工具（`sanitizeHtml` / `sanitizeSvg`）；
  - Web Clipper：浏览器端接收器经主入口导出，Node HTTP 接收器经独立子入口 `@qingwu/editor/clipper` 暴露。
