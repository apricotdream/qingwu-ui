# @qingwu/button

## 0.4.0

### Patch Changes

- 版本统一对齐至 0.4.0

## 0.3.1

### Patch Changes

- 版本统一对齐 0.3.1。工程级更新：发版流程接入 `bun run publish-check` 产物校验门禁（workspace 依赖残留 / CHANGELOG 版本一致 / exports 产物齐全）；新增 Playwright e2e（拖拽上传、压缩产出 WebP/AVIF、单张限制、按钮触发、真实上传）；README 同步 0.3.0 状态与 upload 组件文档。

## 0.3.0

### Minor Changes

- 版本统一对齐 0.3.0，API 完全兼容。按钮样式现随 `@qingwu/upload` 的 style.css 合并导出（upload 按钮触发形态无需单独引入 `@qingwu/button/style.css`）。

## 0.2.0

### Minor Changes

- 首个公开版本 0.2.0。青梧 UI 通用按钮 —— 胶囊形（pill）风格，`default` / `primary` / `amber` / `icon` 四种变体，纯 DOM + CSS 实现，零依赖、框架无关。样式经 `@qingwu/button/style.css` 子路径单独导出。
