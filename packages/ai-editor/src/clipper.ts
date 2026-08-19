/**
 * 青梧编辑器 Web Clipper 接收器（Node 子入口）：隔离 node:http，避免打进浏览器产物。
 * 纯浏览器场景请用主入口 startBrowserClipperReceiver。
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
