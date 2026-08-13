/**
 * Upload 组件类型定义
 */

/** 请求输出的格式；avif 在当前浏览器不可编码时按 webp → png 降级 */
export type OutputFormat = "original" | "webp" | "avif";

/** 压缩管线单份产物（降级后实际格式可能不同于请求格式） */
export interface CompressedFile {
  /** 请求的格式 */
  format: OutputFormat;
  /** 实际产物 MIME（如 avif 降级为 webp/png） */
  mime: string;
  /** 压缩后的文件（文件名已替换扩展名） */
  blob: File;
}

export type UploadStatus = "pending" | "uploading" | "success" | "error";

/** 一个上传项 = 一张图 × 一个输出格式，拥有独立进度条 */
export interface UploadItem {
  id: string;
  /** 用于上传的 blob（压缩后或原图）；initialUrls 回显的远程项无文件 */
  file?: File;
  name: string;
  mime: string;
  /** 原始文件大小（字节） */
  originalSize: number;
  /** 本项上传文件大小（字节） */
  size: number;
  /** 请求的输出格式 */
  format: OutputFormat;
  status: UploadStatus;
  /** 0-100 */
  progress: number;
  error?: string;
  /** 缩略图 dataURL */
  preview?: string;
  /** 压缩是否跳过（GIF/SVG 不支持压缩） */
  skipped?: boolean;
  /** 来源：本地选择（默认）、URL 导入或 initialUrls 回显 */
  source?: "local" | "url" | "remote";
  /** URL 导入时的原始地址 */
  originalUrl?: string;
  /** initialUrls 回显的远程资源地址 */
  remoteUrl?: string;
}

/** 自定义上传函数；onProgress 由宿主驱动进度条 */
export type UploadFn = (file: File, onProgress: (percent: number) => void) => Promise<void>;

export type UploadTrigger = "dropzone" | "button";

export interface UploadOptions {
  /** 触发形态：大拖拽区（默认）或小按钮（复用 @apricotdream/button 样式） */
  trigger?: UploadTrigger;
  /** 接受的类型，默认 ["image/*"] */
  accept?: string[];
  /** 支持的图片格式白名单（无点扩展名，如 "jpg"、"png"、"webp"、"gif"、"avif"）；不传默认全支持。指定后映射为 input accept 并驱动提示文案；显式传入 accept 时以 accept 为准 */
  supportedFormats?: string[];
  /** 是否允许多选/多拖，默认 true */
  multiple?: boolean;
  /** 最多保留的上传项总数，0 表示不限，默认 0 */
  maxCount?: number;
  /** 单文件大小上限（MB），默认 10 */
  maxSizeMB?: number;

  /** 内置 XHR 上传地址（与 uploadFn 二选一，均不传则仅压缩不上传） */
  url?: string;
  /** FormData 字段名，默认 "file" */
  fieldName?: string;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 覆盖内置 XHR 上传 */
  uploadFn?: UploadFn;

  /** URL 导入入口开关（仅 dropzone 形态），默认 true */
  urlImport?: boolean;
  /** URL 导入单次请求超时（ms），默认 10000 */
  urlImportTimeout?: number;

  /** 压缩总开关，默认 true；关闭时仅按原图上传 */
  compress?: boolean;
  /** 输出格式（按配置三选一/都要），默认 ["original", "webp", "avif"] */
  formats?: OutputFormat[];
  /** 压缩质量 0-1，默认 0.8 */
  quality?: number;
  /** 缩放上限宽度，默认 2048 */
  maxWidth?: number;
  /** 缩放上限高度，默认 2048 */
  maxHeight?: number;

  /** 编辑态回显：已存在的资源 URL 列表（渲染为成功项，删除走 remove → onChange 差集） */
  initialUrls?: string[];
  /**
   * 单文件模式容器大图的适配策略：
   * "cover" 铺满容器（裁切边缘，默认） / "contain" 等比例缩小完整显示（自适应留白）
   * "auto" 按比例自适应：图片与容器比例接近 → 铺满；差异大（横图进竖容器等）→ 完整显示，避免裁切主体
   */
  previewFit?: "cover" | "contain" | "auto";
  /**
   * 持久化策略：未完成的上传项（File + 元数据）存入 IndexedDB，刷新后恢复列表并自动重新上传。
   * "session" 标签页级 / "local" 跨会话；成功项不持久化（上传结果 URL 由宿主经 initialUrls 回显）。
   * 默认 "off"
   */
  persist?: "session" | "local" | "off";

  onStart?: (item: UploadItem) => void;
  onProgress?: (item: UploadItem) => void;
  onSuccess?: (item: UploadItem) => void;
  onError?: (item: UploadItem, error: Error) => void;
  /** 列表增删时触发（细粒度状态变化请用 onStart/onProgress/onSuccess/onError） */
  onChange?: (items: UploadItem[]) => void;
}
