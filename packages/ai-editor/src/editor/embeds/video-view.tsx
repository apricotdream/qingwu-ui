import { NodeViewWrapper } from "@tiptap/react";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type Player from "xgplayer";
import { removeStoredResource } from "../storage/remove-resource";
import { isDeleteConfirmActive, setDeleteConfirmActive } from "../utils/delete-confirm";
import { DeleteConfirmDialog } from "../utils/delete-confirm-dialog";

function detectSource(src: string): "bilibili" | "xiaohongshu" | "direct" | "unknown" {
  if (!src) return "unknown";
  if (/bilibili\.com|BV[a-zA-Z0-9]{10}|av\d+/i.test(src)) return "bilibili";
  if (/xiaohongshu\.com|xhslink\.com/i.test(src)) return "xiaohongshu";
  if (
    /\.(mp4|m3u8|webm|ogg|flv|mkv|mov|avi|wmv|ts|m4v|3gp|f4v|rmvb)(\?|$)/i.test(src) ||
    /\/.*\.(mp4|m3u8|mov|webm|flv|mkv)/i.test(src)
  )
    return "direct";
  return "unknown";
}

function extractBVID(input: string): string {
  const bv = input.match(/BV[a-zA-Z0-9]{10}/);
  if (bv) return bv[0];
  const av = input.match(/av(\d+)/i);
  if (av) return av[0];
  return input;
}

export function VideoEmbedView({ node, deleteNode, editor }: any) {
  const src: string = node.attrs.src || "";
  const storedSource: string = node.attrs.source || "unknown";
  const source = storedSource !== "unknown" ? storedSource : detectSource(src);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  /* 视频编码不受浏览器支持（HEVC/H.265 常见，浏览器缺解码器）：true 时显示友好占位而非黑屏播放器 */
  const [formatError, setFormatError] = useState(false);
  const isEditable = editor?.isEditable ?? true;

  // 删除确认框（复用 delete-confirm 标志，多选时防重复弹框）
  const deleteConfirmDialog = (
    <DeleteConfirmDialog
      open={showDeleteConfirm}
      title="确认删除视频"
      message="此操作将同时删除对象存储中的文件，不可撤销。"
      onCancel={() => {
        setDeleteConfirmActive(false);
        setShowDeleteConfirm(false);
      }}
      onConfirm={async () => {
        try {
          await removeStoredResource(src);
        } catch {
          /* 存储删除失败仍移除节点 */
        }
        setDeleteConfirmActive(false);
        await new Promise((r) => setTimeout(r, 300));
        deleteNode();
      }}
    />
  );

  const [videoUrl, setVideoUrl] = useState("");
  const playerRef = useRef<Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // B 站 iframe 模式专用 ref，避免条件分支内调用 hooks。
  const innerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // 跟踪 xgplayer fallback 产生的 blob URL，cleanup 时释放。
  const blobUrlRef = useRef<string | null>(null);
  const savedScrollYRef = useRef(0);

  const resetBiliFS = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.position = "";
    el.style.inset = "";
    el.style.zIndex = "";
    el.style.borderRadius = "";
    document.body.style.overflow = "";
  }, []);

  const handleBiliWideScreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    resetBiliFS();
  }, [resetBiliFS]);

  const handleBiliPageFS = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    if (el.style.position === "fixed") {
      resetBiliFS();
    } else {
      el.style.position = "fixed";
      el.style.inset = "0";
      el.style.zIndex = "99999";
      el.style.borderRadius = "0";
      document.body.style.overflow = "hidden";
    }
  }, [resetBiliFS]);

  const handleBiliNativeFS = useCallback(() => {
    savedScrollYRef.current = window.scrollY;
    iframeRef.current?.requestFullscreen?.();
  }, []);

  const handleDirectNativeFS = useCallback(() => {
    // 优先全屏外层 .video-embed--direct（已有 :fullscreen 撑满样式），避免内层容器全屏后控件文字被裁
    const el =
      (containerRef.current?.closest(".video-embed--direct") as HTMLElement | null) ||
      containerRef.current;
    if (!el) return;
    savedScrollYRef.current = window.scrollY;
    el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onFSChange = () => {
      if (!document.fullscreenElement) {
        requestAnimationFrame(() => window.scrollTo(0, savedScrollYRef.current));
      }
    };
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  useEffect(() => {
    if (source !== "direct" || !src) {
      setVideoUrl("");
      return;
    }
    let cancelled = false;
    // 签名/转换期间持续显示加载占位，避免用未签名 URL 初始化播放器触发 403 闪现「不支持的音频/视频格式」
    setPlayerLoading(true);
    (async () => {
      try {
        // 已带签名参数、blob、data URI 可直接播放
        if (src.includes("?X-Amz-") || src.startsWith("blob:") || src.startsWith("data:")) {
          setVideoUrl(src);
          return;
        }
        const { signPreviewUrlHeaders: vh } = await import("../storage/signed-fetch");
        const headers = await vh(src);
        if (!headers) {
          // 非对象存储或公开桶，直接用原始 URL
          setVideoUrl(src);
          return;
        }
        const resp = await fetch(src, { headers });
        if (!resp.ok) {
          setVideoUrl(src);
          return;
        }
        const finalUrl = URL.createObjectURL(await resp.blob());
        if (cancelled) {
          URL.revokeObjectURL(finalUrl);
          return;
        }
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = finalUrl;
        setVideoUrl(finalUrl);
      } catch {
        // 签名失败时回退到原始 URL
        if (!cancelled) setVideoUrl(src);
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [source, src]);

  useEffect(() => {
    if (source !== "direct" || !videoUrl) return;
    let cancelled = false;
    setPlayerLoading(true);
    setFormatError(false);
    const el = containerRef.current;
    /* 捕获阶段监听容器内 <video> 的 MEDIA_ERR_SRC_NOT_SUPPORTED（code 4，error 不冒泡）：
       HEVC/H.265 等浏览器无解码器的编码会触发，此时改显友好占位而非黑屏 */
    const onMediaError = (e: Event) => {
      const t = e.target as HTMLMediaElement;
      if (t?.error && t.error.code === 4 && !cancelled) setFormatError(true);
    };
    el?.addEventListener("error", onMediaError, true);
    (async () => {
      if (!el) return;
      try {
        const [{ default: XgPlayer }] = await Promise.all([import("xgplayer")]);
        if (cancelled || !containerRef.current) return;
        playerRef.current?.destroy();
        el.replaceChildren();
        playerRef.current = new XgPlayer({
          el,
          url: videoUrl,
          width: "100%",
          height: 450,
          fluid: true,
          fitVideoSize: "fixWidth",
          autoplay: false,
          controls: true,
          ignores: ["fullscreen"],
          playbackRate: [0.5, 0.75, 1, 1.25, 1.5, 2],
          lang: "zh-cn",
        });
        // 将播放器实例挂载到 DOM 上，供 ProseMirror 插件空格键切换播放
        (el as any).__xgplayer = playerRef.current;
        // 遮罩持续到首帧就绪（loadeddata/canplay），并设兜底超时，避免构造完成后短暂闪现「不支持的音频/视频格式」
        const hideLoading = () => {
          if (!cancelled) setPlayerLoading(false);
        };
        try {
          playerRef.current?.once?.("loadeddata", hideLoading);
          playerRef.current?.once?.("canplay", hideLoading);
        } catch {
          /* 老版本无事件则走兜底超时 */
        }
        window.setTimeout(hideLoading, 2500);
      } catch {
        /* keep empty player shell */
      }
    })();
    return () => {
      cancelled = true;
      el?.removeEventListener("error", onMediaError, true);
      setPlayerLoading(false);
      playerRef.current?.destroy();
      playerRef.current = null;
      if (containerRef.current) (containerRef.current as any).__xgplayer = null;
    };
  }, [source, videoUrl]);

  /* 编码不支持时销毁残留播放器实例（播放器挂载的容器将被占位替换） */
  useEffect(() => {
    if (!formatError) return;
    playerRef.current?.destroy();
    playerRef.current = null;
  }, [formatError]);

  // B站 iframe 播放器
  if (source === "bilibili") {
    const bvid = extractBVID(src);

    return (
      <NodeViewWrapper
        as="div"
        className="video-embed video-embed--bilibili group/video"
        style={{ margin: "1rem 0" }}
        contentEditable={false}
      >
        <div ref={innerRef} style={{ borderRadius: 12, overflow: "hidden" }}>
          <div className="video-fs-controls">
            <button
              type="button"
              className="video-fs-btn"
              title="宽屏"
              onClick={handleBiliWideScreen}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
            <button
              type="button"
              className="video-fs-btn"
              title="网页全屏"
              onClick={handleBiliPageFS}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
                />
              </svg>
            </button>
            <button
              type="button"
              className="video-fs-btn"
              title="全屏"
              onClick={handleBiliNativeFS}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                />
              </svg>
            </button>
            {isEditable && (
              <button
                type="button"
                className="video-fs-btn video-fs-btn--del"
                title="删除"
                onClick={() => {
                  if (isDeleteConfirmActive()) return;
                  setDeleteConfirmActive(true);
                  setShowDeleteConfirm(true);
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
          <div style={{ position: "relative", paddingTop: "56.25%" }}>
            <iframe
              ref={iframeRef}
              src={`https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: "none",
              }}
              allowFullScreen
              scrolling="no"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
        {deleteConfirmDialog}
      </NodeViewWrapper>
    );
  }

  // 小红书 — 静态卡片
  if (source === "xiaohongshu") {
    return (
      <NodeViewWrapper
        as="div"
        className="video-embed video-embed--xiaohongshu"
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: 480,
          margin: "1rem 0",
        }}
        contentEditable={false}
      >
        <div
          style={{
            width: 40,
            height: 40,
            background: "#ff2442",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: "bold",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          红
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>小红书笔记</div>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#ff2442", fontSize: 12, textDecoration: "none" }}
          >
            在小红书中打开 →
          </a>
        </div>
      </NodeViewWrapper>
    );
  }
  // 直链视频
  return (
    <NodeViewWrapper
      as="div"
      className="video-embed video-embed--direct group/video"
      style={{ margin: "1rem 0", borderRadius: 12, overflow: "hidden", background: "#000" }}
      contentEditable={false}
      onKeyDown={(event: KeyboardEvent) => event.stopPropagation()}
    >
      {/* 工具栏 — 仅编辑模式显示 */}
      {isEditable && (
        <div className="video-fs-controls">
          <button
            type="button"
            className="video-fs-btn video-fs-btn--del"
            title="删除"
            onClick={() => {
              if (isDeleteConfirmActive()) return;
              setDeleteConfirmActive(true);
              setShowDeleteConfirm(true);
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
          <button
            type="button"
            className="video-fs-btn"
            title="全屏"
            onClick={handleDirectNativeFS}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
              />
            </svg>
          </button>
        </div>
      )}
      <div style={{ position: "relative", width: "100%", background: "#000" }}>
        {formatError ? (
          <div
            style={{
              minHeight: 260,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "1.25rem",
              textAlign: "center",
              color: "#fff",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              视频编码不受当前浏览器支持（HEVC/H.265 常见）
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
              请安装「HEVC 视频扩展」，或将视频转码为 H.264 后重新上传
            </div>
          </div>
        ) : (
          <>
            <div ref={containerRef} style={{ width: "100%", minHeight: 260 }} />
            {playerLoading && (
              <div className="xg-loading-overlay">
                <span className="xg-loading-spinner" />
              </div>
            )}
          </>
        )}
      </div>
      {deleteConfirmDialog}
    </NodeViewWrapper>
  );
}
