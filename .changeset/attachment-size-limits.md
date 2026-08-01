---
"@qingwu/editor": minor
"@qingwu/button": patch
"@qingwu/search": patch
"@qingwu/skeleton": patch
"@qingwu/text-layout": patch
"@qingwu/toast": patch
"@qingwu/upload": patch
---

`QingWuEditor` 新增必填 props：`maxAttachmentSize`（单文件上传大小上限）与 `maxTotalAttachmentSize`（文档内附件总大小上限）。全部上传路径（拖拽/粘贴、图片弹窗、斜杠命令）在插入前同步校验，超限直接拦截并 toast 提示；加载已超限的旧文档时发警告、不阻止编辑。同时为 `videoEmbed` / `audioEmbed` / `image` 节点新增 `size` 属性用于总大小统计，修复斜杠命令 `/audio` `/attachment` 仅创建 blob URL 占位的问题（改为走存储上传）。版本统一对齐至 0.4.0。
