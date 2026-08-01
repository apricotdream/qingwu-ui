/**
 * 青梧编辑器 · Web Clipper 接收器 —— 浏览器侧导出桶
 *
 * 仅转导「共享类型」与「浏览器实现」，**绝不**转导 receiver-node，
 * 以保证 Node 依赖（node:http）不会经浏览器主入口进入产物。
 * Node 实现经独立子入口 `@qingwu/editor/clipper` 暴露。
 */

export { startBrowserClipperReceiver } from "./receiver-browser";
export * from "./types";
