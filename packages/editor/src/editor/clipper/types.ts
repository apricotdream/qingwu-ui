/**
 * 青梧编辑器 · Web Clipper 接收器 —— 共享类型与常量
 *
 * 该文件仅含类型与一个字符串常量，无任何运行时副作用，
 * 可被「浏览器主入口」与「Node 子入口」共同引用而不会把
 * node:http 等 Node 依赖带入浏览器产物。
 */

/** 稳定错误码：大写下划线，扩展侧可据此精确处理 */
export type ClipperErrorCode =
  | "UNAUTHORIZED" // 401 token 校验失败
  | "INVALID_JSON" // 400 请求体不是合法 JSON
  | "MARKDOWN_REQUIRED" // 422 缺少 markdown 字段
  | "NOT_FOUND" // 404 路由不存在
  | "INTERNAL"; // 500 内部错误

export interface ClipperErrorBody {
  code: ClipperErrorCode;
  message: string;
}

export interface ClipperOkResponse<T = unknown> {
  ok: true;
  data?: T;
}

export interface ClipperErrResponse {
  ok: false;
  error: ClipperErrorBody;
}

export type ClipperResponse<T = unknown> = ClipperOkResponse<T> | ClipperErrResponse;

export interface IncomingClip {
  title: string;
  path?: string;
  tags?: string[];
  markdown: string;
  sourceUrl?: string;
  capturedAt?: string;
}

export interface ClipperReceiverOptions {
  port?: number;
  host?: string;
  token?: string;
  onClip: (clip: IncomingClip, req: Request) => Promise<unknown> | unknown;
  onHealth?: () => Promise<unknown> | unknown;
}

export interface ClipperReceiver {
  url: string;
  close: () => Promise<void>;
}

export interface BrowserClipperReceiver {
  close: () => void;
}

/** 浏览器 postMessage 通道约定的消息 kind */
export const CLIP_MESSAGE_KIND = "qingwu-clip";
