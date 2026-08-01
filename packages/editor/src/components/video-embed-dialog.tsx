import { type FC, useCallback, useEffect, useRef, useState } from "react";
import type Player from "xgplayer";

function detectType(url: string): "bilibili" | "xiaohongshu" | "direct" | "unknown" {
  if (!url.trim()) return "unknown";
  if (/bilibili\.com|BV[a-zA-Z0-9]{10}|av\d+/i.test(url)) return "bilibili";
  if (/xiaohongshu\.com|xhslink\.com/i.test(url)) return "xiaohongshu";
  if (
    /\.(mp4|m3u8|webm|ogg|flv|mkv|mov|avi|wmv|ts|m4v|3gp|f4v|rmvb)(\?|$)/i.test(url) ||
    /\/.*\.(mp4|m3u8|mov|webm|flv|mkv)/i.test(url)
  )
    return "direct";
  return "unknown";
}

function extractBVID(input: string): string {
  const bv = input.match(/BV[a-zA-Z0-9]{10}/);
  if (bv) return bv[0];
  const av = input.match(/av(\d+)/i);
  if (av) return av[0];
  return input.trim();
}

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string) => void;
}

export const VideoEmbedDialog: FC<Props> = ({ open, onClose, onInsert }) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<Player | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previewId = "video-preview-player";

  const type = detectType(url.trim());
  const isValid = type !== "unknown";
  const isPlatform = type === "bilibili" || type === "xiaohongshu";

  // xgplayer preview (direct only) — 动态懒加载
  useEffect(() => {
    if (type !== "direct" || !open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const el = document.getElementById(previewId);
      if (!el || playerRef.current) return;
      try {
        const { default: XgPlayer } = await import("xgplayer");
        if (cancelled || !document.getElementById(previewId)) return;
        playerRef.current = new XgPlayer({
          id: previewId,
          url: url.trim(),
          width: "100%",
          fluid: true,
          fitVideoSize: "fixWidth",
          autoplay: false,
          controls: true,
          ignores: ["fullscreen"],
          lang: "zh-cn",
        });
      } catch {
        /* xgplayer 加载失败静默处理 */
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [type, url, open]);

  const handleInsert = useCallback(() => {
    if (!isValid) {
      setError("请输入有效的视频链接");
      return;
    }
    onInsert(url.trim());
    setUrl("");
    setError(null);
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    onClose();
  }, [url, isValid, onInsert, onClose]);

  const handleClose = useCallback(() => {
    setUrl("");
    setError(null);
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    onClose();
  }, [onClose]);

  // Paste handler inside dialog
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const handler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && detectType(text) !== "unknown") {
        e.preventDefault();
        setUrl(text);
      }
    };
    el.addEventListener("paste", handler);
    return () => el.removeEventListener("paste", handler);
  }, [open]);

  // 空格键切换预览播放/暂停（仅在直链预览时，且焦点不在输入框）
  useEffect(() => {
    if (!open || type !== "direct") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const xg = playerRef.current;
      if (!xg) return;
      e.preventDefault();
      if (xg.paused) xg.play();
      else xg.pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, type]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div
        ref={dialogRef}
        className="relative w-[calc(100vw-32px)] max-w-[520px] max-h-[90vh] bg-background rounded-2xl shadow-2xl border border-default-200 overflow-hidden animate-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-default-100">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <h2 className="text-base font-semibold">导入视频</h2>
          </div>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-default-400 hover:text-default-600 hover:bg-default-100 transition-colors"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* URL Input - single input, no tabs */}
          <div>
            <label className="block text-xs font-medium text-default-600 mb-1.5">
              粘贴视频链接
            </label>
            <input
              type="text"
              className="w-full px-3 py-2.5 rounded-xl border border-default-200 bg-background text-sm focus:outline-none focus:border-primary transition-colors"
              placeholder="粘贴视频直链、B站链接 或 小红书链接..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleInsert();
              }}
            />
            <p className="mt-1.5 text-[11px] text-default-400">
              支持直链 (mp4/m3u8/webm…) · B站链接 · 小红书链接 — 粘贴后自动识别
            </p>
          </div>

          {/* Type indicator */}
          {url.trim() && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-default-400">识别为：</span>
              <span
                className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  type === "bilibili"
                    ? "bg-[#fb7299]/10 text-[#fb7299]"
                    : type === "direct"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : type === "xiaohongshu"
                        ? "bg-[#ff2442]/10 text-[#ff2442]"
                        : "bg-default-100 text-default-500"
                }`}
              >
                {type === "bilibili"
                  ? "B站视频"
                  : type === "xiaohongshu"
                    ? "小红书"
                    : type === "direct"
                      ? "直链视频"
                      : "未知类型"}
              </span>
            </div>
          )}

          {/* Copyright notice for platform videos */}
          {isPlatform && url.trim() && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs">
              <svg
                className="w-4 h-4 shrink-0 mt-px text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  版权提示：{type === "bilibili" ? "B站" : "小红书"}
                  视频将以官方播放器嵌入，版权归原作者所有。
                </p>
                <p className="mt-0.5 text-amber-600 dark:text-amber-500">
                  请确保您有权限分享该内容。支持通过官方分享链接导入。
                </p>
              </div>
            </div>
          )}

          {/* Preview */}
          {type === "direct" && isValid ? (
            <div
              id={previewId}
              style={{
                width: "100%",
                aspectRatio: "16/9",
                borderRadius: 12,
                overflow: "hidden",
                background: "#000",
              }}
            />
          ) : type === "bilibili" && isValid ? (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <iframe
                src={`https://player.bilibili.com/player.html?bvid=${extractBVID(url.trim())}&page=1&high_quality=1&autoplay=0`}
                className="w-full h-full"
                allowFullScreen
                style={{ border: "none" }}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : type === "xiaohongshu" && isValid ? (
            <div className="flex items-center gap-3 px-4 py-6 rounded-xl border border-dashed border-default-200 bg-default-50 dark:bg-default-100/10">
              <div className="w-10 h-10 rounded-xl bg-[#ff2442]/10 flex items-center justify-center text-lg">
                📌
              </div>
              <div>
                <p className="text-sm font-medium">小红书笔记</p>
                <p className="text-xs text-default-400">
                  导入后将显示为卡片样式，点击跳转至小红书查看
                </p>
              </div>
            </div>
          ) : url.trim() && !isValid ? (
            <div className="flex items-center justify-center py-10 rounded-xl border border-dashed border-default-200 text-sm text-default-400">
              无法识别该链接类型，请检查后重试
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed border-default-200 bg-default-50 dark:bg-default-100/10 text-default-400">
              <svg
                className="w-10 h-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <div className="text-center">
                <p className="text-sm">粘贴链接后自动识别并预览</p>
                <p className="text-xs mt-1">支持直链 mp4/m3u8 · B站 · 小红书</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-sm text-danger">
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              disabled={!isValid}
              onClick={handleInsert}
            >
              导入视频
            </button>
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-default-200 text-sm hover:bg-default-50 dark:hover:bg-default-100/10 transition-colors"
              onClick={handleClose}
            >
              取消
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 border-t border-default-100 text-[11px] text-default-300 text-center">
          直链使用 xgplayer 播放 · B站/小红书使用官方播放器
        </div>
      </div>
    </div>
  );
};
