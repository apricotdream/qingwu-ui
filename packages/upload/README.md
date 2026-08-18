# @qingwu-ui/upload

[青梧UI](https://github.com/apricotdream/qingwu-ui) 的 **图片上传组件** —— 框架无关，纯 DOM + CSS，零依赖。

- **双触发形态**：拖拽区 `dropzone` / 按钮 `button`（复用 `@qingwu-ui/button`）
- **客户端压缩**：输出原图 / WebP / AVIF 多份，AVIF 不可用时自动降级 WebP → PNG
- **逐项独立进度条**：内置 XHR 上传，`uploadFn` 可完全接管（对象存储直传等）
- **图片预处理**：`createImageBitmap` 解码自动修正 EXIF 方向，超出尺寸等比缩放
- GIF / SVG 不支持压缩，按原图上传（标注「不压缩」）

## 安装

```bash
npm install @qingwu-ui/upload
```

## 使用

```ts
import { ImageUpload } from "@qingwu-ui/upload";
import "@qingwu-ui/upload/style.css";

const uploader = new ImageUpload(document.getElementById("upload")!, {
  trigger: "dropzone",
  url: "/api/upload",
  compress: true,
  formats: ["original", "webp", "avif"],
  onSuccess: (item) => console.log("完成：", item.name, item.format),
});
```

> 完整 API 见 [青梧UI 根 README](https://github.com/apricotdream/qingwu-ui)。
