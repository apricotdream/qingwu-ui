/** 输出格式；avif 不可编码时按 webp → png 降级 */
export type OutputFormat = "original" | "webp" | "avif";

/** 压缩管线单份产物 */
export interface CompressedFile {
  format: OutputFormat;
  /** 实际 MIME（avif 降级后为 webp/png） */
  mime: string;
  /** 压缩后文件（扩展名已替换） */
  blob: File;
}

export type UploadStatus = "pending" | "uploading" | "success" | "error";

/** 一个上传项 = 一张图 × 一个输出格式 */
export interface UploadItem {
  id: string;
  /** 上传 blob；initialUrls 回显的远程项无此字段 */
  file?: File;
  name: string;
  mime: string;
  /** 原文件大小（字节） */
  originalSize: number;
  /** 本项实际上传大小（字节） */
  size: number;
  format: OutputFormat;
  status: UploadStatus;
  /** 0-100 */
  progress: number;
  error?: string;
  /** 缩略图 dataURL */
  preview?: string;
  /** 跳过压缩（GIF/SVG 不支持） */
  skipped?: boolean;
  /** 本地 / URL 导入 / 远程回显 */
  source?: "local" | "url" | "remote";
  /** URL 导入原始地址 */
  originalUrl?: string;
  /** initialUrls 回显的远程地址 */
  remoteUrl?: string;
}

/** 自定义上传函数；onProgress 由宿主驱动进度条 */
export type UploadFn = (file: File, onProgress: (percent: number) => void) => Promise<void>;

export type UploadTrigger = "dropzone" | "button";

export interface UploadOptions {
  /** 大拖拽区（默认）或小按钮 */
  trigger?: UploadTrigger;
  /** 接受类型，默认 ["image/*"] */
  accept?: string[];
  /** 格式白名单（无点扩展名）；显式传 accept 时以 accept 为准 */
  supportedFormats?: string[];
  /** 是否允许多选/多拖，默认 true */
  multiple?: boolean;
  /** 最多保留上传项数，0 不限，默认 0 */
  maxCount?: number;
  /** 单文件上限（MB），默认 10 */
  maxSizeMB?: number;

  /** XHR 上传地址；与 uploadFn 二选一，均不传则仅压缩不上传 */
  url?: string;
  /** FormData 字段名，默认 "file" */
  fieldName?: string;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 覆盖内置 XHR 上传 */
  uploadFn?: UploadFn;

  /** URL 导入开关（仅 dropzone），默认 true */
  urlImport?: boolean;
  /** URL 导入超时（ms），默认 10000 */
  urlImportTimeout?: number;

  /** 压缩开关，默认 true；关闭则按原图上传 */
  compress?: boolean;
  /** 输出格式，默认 ["original", "webp", "avif"] */
  formats?: OutputFormat[];
  /** 质量 0-1，默认 0.8 */
  quality?: number;
  /** 缩放上限宽，默认 2048 */
  maxWidth?: number;
  /** 缩放上限高，默认 2048 */
  maxHeight?: number;

  /** 回显已有资源 URL（删除走 remove → onChange 差集） */
  initialUrls?: string[];
  /** "cover" 铺满裁切（默认） / "contain" 完整显示 / "auto" 按比例自适应 */
  previewFit?: "cover" | "contain" | "auto";
  /** 未完成项持久化到 IndexedDB：session/local 跨标签页，成功项不持久化；默认 "off" */
  persist?: "session" | "local" | "off";

  onStart?: (item: UploadItem) => void;
  onProgress?: (item: UploadItem) => void;
  onSuccess?: (item: UploadItem) => void;
  onError?: (item: UploadItem, error: Error) => void;
  /** 列表增删时触发 */
  onChange?: (items: UploadItem[]) => void;
}
