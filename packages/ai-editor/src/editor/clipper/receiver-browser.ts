/** 浏览器实现：经 window.message 接收扩展剪藏，仅接受同源消息，无 node:http 依赖 */
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
    // 仅接受同源消息（插件脚本与页面同源）；兼容 jsdom 等 origin 为空或 "null"
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
