# @qingwu/upload

## 0.6.0

### Patch Changes

- 版本统一对齐 0.6.0（无功能变更；`@qingwu/tag-input` 随本版首次发布）

## 0.5.0

### Minor Changes

- 新增 **URL 导入** 功能（dropzone 形态）：从 URL 批量导入图片

  - 支持多行批量导入，协议白名单仅 http/https/data，非法协议与格式错误给出中文提示
  - 导入前 HEAD 预检 Content-Length 超限拦截，不支持的协议按 GET 降级；单次请求超时 `urlImportTimeout`（默认 10000ms）可配
  - 按文件头签名（magic bytes）识别真实图片格式（PNG/JPEG/GIF/BMP/WebP/AVIF/SVG），后缀不再可信，作为 accept 校验 / 命名 / 压缩判断的权威依据
  - 新增 `source`（local/url）与 `originalUrl` 字段；无预览的失败条目以占位符展示
  - 新增 `urlImport` / `urlImportTimeout` 配置项与对应样式

### Patch Changes

- Updated dependencies
  - @qingwu/button@0.5.0

## 0.4.0

### Minor Changes

- - `@qingwu/upload` 新增 `supportedFormats` 属性：图片格式白名单（无点扩展名），指定后映射为 input accept 并驱动拖拽区提示文案；不传默认全支持（原行为不变）
  - 图片上传支持 AVIF：`@qingwu/upload` 拖拽区提示文案、editor 图片上传对话框白名单与文案补充 avif（editor 其余图片识别路径早已支持）

### Patch Changes

- 版本统一对齐至 0.4.0
- Updated dependencies
  - @qingwu/button@0.3.2

## 0.3.1

### Patch Changes

- 版本统一对齐 0.3.1。工程级更新：发版流程接入 `bun run publish-check` 产物校验门禁（workspace 依赖残留 / CHANGELOG 版本一致 / exports 产物齐全）；新增 Playwright e2e（拖拽上传、压缩产出 WebP/AVIF、单张限制、按钮触发、真实上传）；README 同步 0.3.0 状态与 upload 组件文档。
- Updated dependencies
  - @qingwu/button@0.3.1

## 0.3.0

### Minor Changes

- 新增 @qingwu/upload 图片上传组件：拖拽/按钮两种触发形态（trigger 复用 @qingwu/button）、独立进度条、客户端压缩（原图/WebP/AVIF 按配置多份输出、AVIF 不支持时自动降级 WebP/PNG）、内置 XHR 上传与可插拔自定义上传函数、数量/大小/类型校验。

### Patch Changes

- Updated dependencies
  - @qingwu/button@0.3.0
