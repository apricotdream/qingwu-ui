/**
 * 青梧编辑器 · Web Clipper 接收器 —— Node 子入口
 *
 * 通过 `@qingwu/ai-editor/clipper` 访问，供 Node / Electron / Tauri 等
 * 带 Node 运行时的消费者使用。把 HTTP 接收器与浏览器主入口隔离，
 * 避免 `node:http` 被打包进浏览器/SSR 客户端产物。
 *
 * 纯浏览器场景请改从主入口 `@qingwu/ai-editor` 使用 startBrowserClipperReceiver。
 */
export { startClipperReceiver, stopClipperReceiver } from "./editor/clipper/receiver-node";
export type {
  ClipperErrorBody,
  ClipperErrorCode,
  ClipperErrResponse,
  ClipperOkResponse,
  ClipperReceiver,
  ClipperReceiverOptions,
  ClipperResponse,
  IncomingClip,
} from "./editor/clipper/types";
