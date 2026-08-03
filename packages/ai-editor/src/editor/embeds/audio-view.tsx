import { NodeViewWrapper } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { removeStoredResource } from "../storage/remove-resource";
import { signPreviewUrlHeaders } from "../storage/signed-fetch";
import { isDeleteConfirmActive, setDeleteConfirmActive } from "../utils/delete-confirm";
import { DeleteConfirmDialog } from "../utils/delete-confirm-dialog";

export function AudioEmbedView({ node, deleteNode, editor }: any) {
  const src: string = node.attrs.src || "";
  const filename: string = node.attrs.name || src.split("/").pop()?.split("?")[0] || "audio";
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEditable = editor?.isEditable ?? true;

  // 组件卸载时释放 blob URL（音频 / 附件可能使用 placeholder blob）
  useEffect(() => {
    return () => {
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
    };
  }, [src]);

  // 主动签名预加载，避免 <audio> 先用原始 URL 加载失败再 onError 重试的闪烁
  // 远程音频先签名预加载完成再渲染 <audio>，避免 src 由原始 URL 切到签名 blob 时重载闪烁
  const isLocalAudio = !!src && (src.startsWith("blob:") || src.startsWith("data:"));
  const [audioUrl, setAudioUrl] = useState<string | null>(isLocalAudio ? src : null);
  const [audioReady, setAudioReady] = useState<boolean>(isLocalAudio);
  const audioBlobRef = useRef<string | null>(null);
  useEffect(() => {
    if (!src) {
      setAudioUrl(null);
      setAudioReady(false);
      return;
    }
    if (src.startsWith("blob:") || src.startsWith("data:")) {
      setAudioUrl(src);
      setAudioReady(true);
      return;
    }
    let cancelled = false;
    setAudioReady(false);
    (async () => {
      let finalUrl = src;
      try {
        const headers = await signPreviewUrlHeaders(src);
        if (headers) {
          const resp = await fetch(src, { headers });
          if (resp.ok) {
            const url = URL.createObjectURL(await resp.blob());
            if (audioBlobRef.current) URL.revokeObjectURL(audioBlobRef.current);
            audioBlobRef.current = url;
            finalUrl = url;
          }
        }
      } catch {
        /* 退回原始 src */
      }
      if (cancelled) return;
      setAudioUrl(finalUrl);
      setAudioReady(true);
    })();
    return () => {
      cancelled = true;
      if (audioBlobRef.current) {
        URL.revokeObjectURL(audioBlobRef.current);
        audioBlobRef.current = null;
      }
    };
  }, [src]);

  return (
    <NodeViewWrapper
      as="div"
      className="audio-embed group/audio"
      style={{ margin: "1rem 0" }}
      contentEditable={false}
    >
      <div className="audio-embed-inner">
        {/* Header bar */}
        <div className="audio-embed-header">
          <div className="audio-embed-title">
            <svg
              className="audio-embed-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <span className="audio-embed-filename">{filename}</span>
          </div>
          <div className="audio-embed-actions">
            {isEditable && (
              <button
                type="button"
                className="audio-embed-btn audio-embed-btn--del"
                onClick={() => {
                  if (isDeleteConfirmActive()) return;
                  setDeleteConfirmActive(true);
                  setShowDeleteConfirm(true);
                }}
                title="删除"
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
        </div>

        {/* Audio player */}
        <div className="audio-embed-player">
          {!src ? (
            // 无 src：历史坏节点（上传中断/round-trip 丢 src）或对象被删，渲染缺失态而非永久转圈
            <div className="audio-embed-loading audio-embed-missing">
              <span className="audio-embed-missing-icon" aria-hidden="true">!</span>
              音频文件缺失
            </div>
          ) : audioReady && audioUrl ? (
            <audio
              src={audioUrl}
              controls
              style={{ width: "100%" }}
              onError={async (e: React.SyntheticEvent<HTMLAudioElement>) => {
                const el = e.currentTarget;
                try {
                  const headers = await signPreviewUrlHeaders(src);
                  const init = headers ? { headers } : {};
                  const resp = await fetch(src, init);
                  if (resp.ok) {
                    const blob = await resp.blob();
                    if (el.src.startsWith("blob:")) URL.revokeObjectURL(el.src);
                    el.src = URL.createObjectURL(blob);
                  }
                } catch {
                  /* ignore */
                }
              }}
            />
          ) : (
            <div className="audio-embed-loading">
              <span className="audio-embed-spinner" />
              音频加载中…
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title="确认删除音频"
        message={`此操作将同时删除对象存储中的文件（${filename}），不可撤销。`}
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
    </NodeViewWrapper>
  );
}
