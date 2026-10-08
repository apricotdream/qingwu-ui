import { ImageUpload, type OutputFormat, type UploadItem } from "@qingwu-ui/upload";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

export const UPLOAD_FIELDS: FieldDef[] = [
  {
    key: "trigger",
    label: "触发形态",
    type: "select",
    defaultValue: "dropzone",
    options: [
      { label: "拖拽区", value: "dropzone" },
      { label: "按钮（复用 @qingwu-ui/button）", value: "button" },
    ],
  },
  {
    key: "compress",
    label: "压缩",
    type: "boolean",
    defaultValue: "true",
    options: [
      { label: "开启", value: "true" },
      { label: "关闭", value: "false" },
    ],
  },
  {
    key: "quality",
    label: "压缩质量",
    type: "select",
    defaultValue: "0.8",
    options: [
      { label: "0.5", value: "0.5" },
      { label: "0.8", value: "0.8" },
      { label: "1.0", value: "1" },
    ],
  },
  {
    key: "maxSizeMB",
    label: "单张限制",
    type: "select",
    defaultValue: "10",
    options: [
      { label: "1 MB", value: "1" },
      { label: "5 MB", value: "5" },
      { label: "10 MB", value: "10" },
      { label: "20 MB", value: "20" },
    ],
  },
  {
    key: "maxCount",
    label: "数量上限",
    type: "select",
    // 默认单文件：容器承载大图预览（URL 导入入口在图片框内），多图能力可选
    defaultValue: "1",
    options: [
      { label: "不限", value: "0" },
      { label: "1 张", value: "1" },
      { label: "3 张", value: "3" },
    ],
  },
  {
    key: "previewFit",
    label: "大图适配",
    type: "select",
    defaultValue: "cover",
    options: [
      { label: "铺满（裁切）", value: "cover" },
      { label: "等比例缩小（完整显示）", value: "contain" },
      { label: "自动（按尺寸选择）", value: "auto" },
    ],
  },
  {
    key: "persist",
    label: "持久化",
    type: "select",
    // 默认不开启：未完成的上传项（File）存 IndexedDB，刷新后恢复列表并自动重传
    defaultValue: "off",
    options: [
      { label: "关闭", value: "off" },
      { label: "标签页级（session）", value: "session" },
      { label: "跨会话（local）", value: "local" },
    ],
  },
];

const fmtBytes = (b: number) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(1)} KB`;

export function createUpload(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  /** onProgress 日志节流：每 10% 记一条，附字节量证明为 XHR 真实进度 */
  const lastLogged = new Map<string, number>();

  const count = Number(v.maxCount);
  const uploader = new ImageUpload(host, {
    trigger: v.trigger === "button" ? "button" : "dropzone",
    compress: v.compress !== false,
    formats: ["original", "webp", "avif"] as OutputFormat[],
    quality: Number(v.quality),
    maxSizeMB: Number(v.maxSizeMB),
    maxCount: count > 0 ? count : undefined,
    url: "/api/upload",
    persist: (v.persist === "off" ? "off" : v.persist) as "off" | "session" | "local",
    previewFit: (v.previewFit === "contain" || v.previewFit === "auto"
      ? v.previewFit
      : "cover") as "cover" | "contain" | "auto",
    onStart: (item: UploadItem) => log(`开始上传 → ${item.name}（${item.format}）`),
    onProgress: (item: UploadItem) => {
      if (item.progress >= 100) return; // 完成交给 onSuccess
      const last = lastLogged.get(item.id) ?? 0;
      if (item.progress - last < 10) return;
      lastLogged.set(item.id, item.progress);
      const sent = (item.size * item.progress) / 100;
      log(
        `进度 ${item.progress}% · ${fmtBytes(sent)} / ${fmtBytes(item.size)} ← ${item.name}（${item.format}）`,
      );
    },
    onSuccess: (item: UploadItem) =>
      log(`完成 → ${item.name}（${item.format}，${(item.size / 1024).toFixed(1)} KB）`),
    onError: (item: UploadItem, e: Error) =>
      log(`失败 → ${item.name}（${item.format}）：${e.message}`),
  });
  log(`上传组件渲染完成（trigger: ${v.trigger === "button" ? "button" : "dropzone"}）`);

  return {
    destroy: () => uploader.destroy(),
  };
}

export function uploadToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = [];
  if (v.trigger === "button")
    lines.push('  trigger: "button",            // 按钮形态，复用 @qingwu-ui/button');
  if (v.compress === false) lines.push("  compress: false,             // 关闭压缩，按原图上传");
  if (v.quality !== "0.8") lines.push(`  quality: ${v.quality},`);
  if (v.maxSizeMB !== "10")
    lines.push(`  maxSizeMB: ${v.maxSizeMB},        // 单张大小上限（MB）`);
  if (Number(v.maxCount) > 0) lines.push(`  maxCount: ${v.maxCount},       // 数量上限`);
  if (v.previewFit !== "cover")
    lines.push(`  previewFit: "${v.previewFit}",   // 大图适配（默认 cover 铺满）`);
  if (v.persist !== "off")
    lines.push(`  persist: "${v.persist}",  // 未完成项持久化（刷新恢复并自动重传）`);
  lines.push('  url: "/api/upload",        // 内置 XHR 上传（字节级真实进度）');
  lines.push("  onProgress: (item) => console.log(item.progress), // 每项上传进度回调");

  const stmt = `const uploader = new ImageUpload(el, {
${lines.join("\n")}
});`;

  return {
    meta: PKG.upload,
    symbol: "ImageUpload",
    stmt,
    importMap: { [PKG.button.pkg]: PKG.button.cdnJs },
  };
}
