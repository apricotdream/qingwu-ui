/**
 * 青梧编辑器 · Web Clipper 接收器 —— 浏览器实现
 *
 * 纯浏览器场景（dev 模式 / 无 Node 运行时）通过 window.message 事件接收
 * 来自浏览器扩展的剪藏内容。不依赖 node:http，故可安全保留在浏览器主入口。
 *
 * 扩展侧用 chrome.tabs.create 打开编辑器页面后，注入脚本调用 window.postMessage
 * 把 { kind: "qingwu-clip", clip } 发给编辑器页面。
 *
 * 安全：校验 event.origin === 当前页面 origin 且 payload.kind === "qingwu-clip"，
 * 避免其他跨源页面伪造消息。插件注入的脚本与编辑器页面同源运行，
 * postMessage 的 origin 与页面一致。
 */
import {
  type BrowserClipperReceiver,
  CLIP_MESSAGE_KIND,
  type ClipperReceiverOptions,
  type IncomingClip,
} from "./types";

export function startBrowserClipperReceiver(
  opts: Pick<ClipperReceiverOptions, "onClip">,
): BrowserClipperReceiver {
  const handler = async (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.kind !== CLIP_MESSAGE_KIND) return;
    // 仅接受同源消息：插件注入脚本与编辑器页面同源运行，postMessage 的 origin
    // 等于当前页面 origin。忽略跨源伪造。
    // （兼容 jsdom / 某些浏览器 postMessage origin 为空字符串或 "null" 的情况）
    const origin = event.origin;
    if (origin && origin !== "null" && origin !== window.location.origin) return;
    const clip = data.clip as IncomingClip | undefined;
    if (!clip?.markdown) return;
    try {
      await opts.onClip(clip, event as unknown as Request);
    } catch (e) {
      console.warn("[qingwu-clipper] 处理剪藏失败:", e);
    }
  };
  window.addEventListener("message", handler);
  return {
    close: () => window.removeEventListener("message", handler),
  };
}
