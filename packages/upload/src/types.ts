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
  /** 用于上传的 blob（压缩后或原图） */
  file: File;
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
}

/** 自定义上传函数；onProgress 由宿主驱动进度条 */
export type UploadFn = (file: File, onProgress: (percent: number) => void) => Promise<void>;

export type UploadTrigger = "dropzone" | "button";

export interface UploadOptions {
  /** 触发形态：大拖拽区（默认）或小按钮（复用 @qingwu/button 样式） */
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

  onStart?: (item: UploadItem) => void;
  onProgress?: (item: UploadItem) => void;
  onSuccess?: (item: UploadItem) => void;
  onError?: (item: UploadItem, error: Error) => void;
  /** 列表增删时触发（细粒度状态变化请用 onStart/onProgress/onSuccess/onError） */
  onChange?: (items: UploadItem[]) => void;
}
