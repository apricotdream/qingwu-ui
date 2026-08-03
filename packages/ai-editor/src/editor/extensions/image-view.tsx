import { NodeViewWrapper } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { removeStoredResource } from "../storage/remove-resource";
import { signPreviewUrlHeaders } from "../storage/signed-fetch";
import { isDeleteConfirmActive, setDeleteConfirmActive } from "../utils/delete-confirm";
import { DeleteConfirmDialog } from "../utils/delete-confirm-dialog";

function isLocalPath(src: string): boolean {
  // 匹配 ./ ../ C:\ file:// 以及裸相对路径（无协议、非 / 开头、非 data:/blob:）
  if (/^(\.\.?\/|[a-zA-Z]:\\|file:\/\/)/.test(src)) return true;
  if (/^[a-z]+:\/\//i.test(src)) return false; // http:// https:// 等
  if (src.startsWith("/")) return false; // 绝对路径
  if (src.startsWith("data:") || src.startsWith("blob:")) return false;
  return true; // 裸相对路径如 image.png、folder/img.png
}

export function ImageView({ node, deleteNode, editor }: any) {
  const [zoomed, setZoomed] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [nativeFs, setNativeFs] = useState(false);
  const nativeFsExitingRef = useRef(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const src: string = node.attrs.src || "";
  const alt: string = node.attrs.alt || "";
  const width: string | null = node.attrs.width || null;
  const height: string | null = node.attrs.height || null;
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const lightboxImgRef = useRef<HTMLImageElement>(null);
  const imgMainRef = useRef<HTMLImageElement>(null);
  // 跟踪私有桶 fallback 产生的 blob URL，src 切换/卸载时释放，避免内存泄漏
  const mainBlobUrlRef = useRef<string | null>(null);
  const lightboxBlobUrlRef = useRef<string | null>(null);
  // 防止 onError 死循环：标记是否已尝试过 fallback
  const mainFallbackTriedRef = useRef<boolean>(false);
  const lightboxFallbackTriedRef = useRef<boolean>(false);
  const savedScrollYRef = useRef(0);
  // 私有桶主动签名后的可用 URL
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const isEditable = editor?.isEditable ?? true;

  // 网页全屏 = 灯箱
  const openWebFS = useCallback(() => {
    if (imgError) return;
    savedScrollYRef.current = window.scrollY;
    setZoomed(true);
  }, [imgError]);

  const closeZoom = useCallback(() => {
    setZoomed(false);
    requestAnimationFrame(() => window.scrollTo(0, savedScrollYRef.current));
  }, []);

  // 原生全屏
  const openNativeFS = useCallback(() => {
    const el = imgWrapRef.current;
    if (!el) return;
    savedScrollYRef.current = window.scrollY;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    }
  }, []);

  const lightboxNativeFS = useCallback(() => {
    const el = lightboxImgRef.current;
    if (!el) return;
    savedScrollYRef.current = window.scrollY;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    }
  }, []);

  // src 切换时重置状态并释放旧 blob URL
  useEffect(() => {
    setImgError(false);
    setResolvedSrc(src);
    mainFallbackTriedRef.current = false;
    lightboxFallbackTriedRef.current = false;
    if (mainBlobUrlRef.current) {
      URL.revokeObjectURL(mainBlobUrlRef.current);
      mainBlobUrlRef.current = null;
    }
    if (lightboxBlobUrlRef.current) {
      URL.revokeObjectURL(lightboxBlobUrlRef.current);
      lightboxBlobUrlRef.current = null;
    }
  }, [src]);

  // 私有桶主动签名：对属于已配置 S3 的图片 URL 预先签名获取 blob URL
  useEffect(() => {
    if (!src || src.startsWith("blob:") || src.startsWith("data:") || src.includes("?X-Amz-"))
      return;
    let cancelled = false;
    (async () => {
      try {
        const { signPreviewUrlHeaders } = await import("../storage/signed-fetch");
        const headers = await signPreviewUrlHeaders(src);
        if (!headers) return;
        const resp = await fetch(src, { headers });
        if (!resp.ok) return;
        const blobUrl = URL.createObjectURL(await resp.blob());
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        if (mainBlobUrlRef.current) URL.revokeObjectURL(mainBlobUrlRef.current);
        mainBlobUrlRef.current = blobUrl;
        mainFallbackTriedRef.current = true;
        setResolvedSrc(blobUrl);
      } catch {
        /* keep original src */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // 组件卸载时释放所有 blob URL
  useEffect(() => {
    return () => {
      if (mainBlobUrlRef.current) URL.revokeObjectURL(mainBlobUrlRef.current);
      if (lightboxBlobUrlRef.current) URL.revokeObjectURL(lightboxBlobUrlRef.current);
    };
  }, []);

  // ESC 关闭灯箱
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement || nativeFsExitingRef.current) return;
        setZoomed(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  // 监听原生全屏状态变化，用于显示/隐藏关闭按钮
  useEffect(() => {
    const onFS = () => {
      const fs = !!document.fullscreenElement;
      setNativeFs(fs);
      if (!fs) {
        nativeFsExitingRef.current = true;
        requestAnimationFrame(() => window.scrollTo(0, savedScrollYRef.current));
        window.setTimeout(() => {
          nativeFsExitingRef.current = false;
        }, 300);
      }
    };
    document.addEventListener("fullscreenchange", onFS);
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

  const showPlaceholder = imgError || isLocalPath(src);

  return (
    <NodeViewWrapper as="div" className="image-node-view group/img" contentEditable={false}>
      {showPlaceholder ? (
        <div className="image-placeholder">
          {isEditable && (
            <button
              type="button"
              className="img-ctrl-btn img-ctrl-btn--del image-placeholder-del"
              onClick={() => {
                if (isDeleteConfirmActive()) return;
                setDeleteConfirmActive(true);
                setShowDeleteConfirm(true);
              }}
              title="删除"
            >
              <svg
                width="14"
                height="14"
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
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
          <span className="image-placeholder-text">
            {isLocalPath(src) ? "本地图片无法加载" : "图片加载失败"}
          </span>
          <span className="image-placeholder-path">{alt || src}</span>
        </div>
      ) : (
        <div ref={imgWrapRef} className="img-wrap">
          <img
            ref={imgMainRef}
            src={resolvedSrc}
            alt={alt}
            width={width || undefined}
            height={height || undefined}
            onClick={openWebFS}
            onError={() => {
              // 私有桶 fallback：fetch + 签名头 -> blob URL
              // 用 ref 标志位防止死循环（blob URL 也失败时不再重试）
              if (mainFallbackTriedRef.current || imgError) return;
              mainFallbackTriedRef.current = true;
              (async () => {
                try {
                  const headers = await signPreviewUrlHeaders(src);
                  const init = headers ? { headers } : {};
                  const resp = await fetch(src, init);
                  if (resp.ok) {
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    // 释放上一次 fallback 产生的 blob URL（若有）
                    if (mainBlobUrlRef.current) URL.revokeObjectURL(mainBlobUrlRef.current);
                    mainBlobUrlRef.current = blobUrl;
                    // 只替换当前实例的 img，避免影响其他图片节点
                    if (imgMainRef.current) imgMainRef.current.src = blobUrl;
                    return;
                  }
                } catch {
                  /* fallback failed */
                }
                setImgError(true);
              })();
            }}
            className="img-main"
            draggable="false"
          />

          {/* 悬浮控件 — 网页全屏 / 全屏 / 删除 */}
          <div
            className="img-controls"
            style={nativeFs ? { opacity: 1, pointerEvents: "auto" } : undefined}
          >
            <button type="button" className="img-ctrl-btn" onClick={openWebFS} title="网页全屏">
              <svg
                width="14"
                height="14"
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
            <button type="button" className="img-ctrl-btn" onClick={openNativeFS} title="全屏">
              <svg
                width="14"
                height="14"
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
                className="img-ctrl-btn img-ctrl-btn--del"
                onClick={() => {
                  if (isDeleteConfirmActive()) return;
                  setDeleteConfirmActive(true);
                  setShowDeleteConfirm(true);
                }}
                title="删除"
              >
                <svg
                  width="14"
                  height="14"
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
        </div>
      )}

      {/* 灯箱 = 网页全屏 */}
      {zoomed && !showPlaceholder && (
        <div className="image-lightbox" onClick={closeZoom}>
          {/* 灯箱控件栏 */}
          <div className="image-lightbox-bar">
            <button
              type="button"
              className="image-lightbox-bar-btn"
              onClick={lightboxNativeFS}
              title="全屏"
            >
              <svg
                width="18"
                height="18"
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
            <button
              type="button"
              className="image-lightbox-bar-btn"
              onClick={closeZoom}
              title="关闭"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <img
            ref={lightboxImgRef}
            src={resolvedSrc}
            alt={alt}
            className="image-lightbox-img"
            onClick={(e) => e.stopPropagation()}
            onError={() => {
              // 同主图 fallback 逻辑，但作用于灯箱 img
              if (lightboxFallbackTriedRef.current) return;
              lightboxFallbackTriedRef.current = true;
              // 复用主图已下载的 blob URL，避免重复 fetch 同一资源
              if (mainBlobUrlRef.current && lightboxImgRef.current) {
                lightboxImgRef.current.src = mainBlobUrlRef.current;
                return;
              }
              (async () => {
                try {
                  const headers = await signPreviewUrlHeaders(src);
                  const init = headers ? { headers } : {};
                  const resp = await fetch(src, init);
                  if (resp.ok) {
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    if (lightboxBlobUrlRef.current) URL.revokeObjectURL(lightboxBlobUrlRef.current);
                    lightboxBlobUrlRef.current = blobUrl;
                    if (lightboxImgRef.current) lightboxImgRef.current.src = blobUrl;
                  }
                } catch {
                  /* ignore */
                }
              })();
            }}
          />
        </div>
      )}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title="确认删除图片"
        message={
          showPlaceholder
            ? "该图片无法在当前环境加载，仅从编辑器中移除该图片节点，不影响存储文件。"
            : "此操作将同时删除对象存储中的文件，不可撤销。"
        }
        onCancel={() => {
          setDeleteConfirmActive(false);
          setShowDeleteConfirm(false);
        }}
        onConfirm={async () => {
          // 无法加载的图片（本地路径/加载失败）不在对象存储中，跳过存储删除
          if (!showPlaceholder) {
            try {
              await removeStoredResource(src);
            } catch {
              /* 存储删除失败仍移除节点 */
            }
          }
          setDeleteConfirmActive(false);
          await new Promise((r) => setTimeout(r, 300));
          deleteNode();
        }}
      />
    </NodeViewWrapper>
  );
}
