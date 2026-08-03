import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getConfirmProvider } from "./delete-confirm";

const MIN_DELETE_PROGRESS_MS = 300;

export interface DeleteConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** 确认删除（异步），返回前可展示「删除中」动画 */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * 共享删除确认弹窗。
 * - 通过 createPortal 渲染到 document.body，脱离编辑器 contenteditable，
 *   避免 Ctrl+A 全选时把弹窗文字也选中（ProseMirror 重同步选区也无法高亮外部 DOM）。
 * - 内置「删除中」动画：onConfirm 为异步时自动展示遮罩，直至 resolve。
 */
export function DeleteConfirmDialog({
  open,
  title,
  message,
  confirmText = "删除",
  cancelText = "取消",
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const delegatedRef = useRef(false);
  // 宿主经 setConfirmProvider 设置自定义确认渲染器时，交由宿主接管，默认仍用本项目弹窗
  const provider = getConfirmProvider();

  useEffect(() => {
    if (!open) {
      delegatedRef.current = false;
      return;
    }
    if (!provider || delegatedRef.current) return;
    delegatedRef.current = true;
    provider({ open, title, message, confirmText, cancelText, onConfirm, onCancel });
  }, [open, provider, title, message, confirmText, cancelText, onConfirm, onCancel]);

  // 关闭时复位 deleting，避免下次打开残留
  useEffect(() => {
    if (!open) setDeleting(false);
  }, [open]);

  if (provider) return null;
  if (!open) return null;

  const handleConfirm = async () => {
    if (deleting) return;
    setDeleting(true);
    const startedAt = Date.now();
    try {
      await onConfirm();
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_DELETE_PROGRESS_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_DELETE_PROGRESS_MS - elapsed));
      }
      setDeleting(false);
      onCancel();
    }
  };

  const handleMaskClick = () => {
    if (deleting) return;
    onCancel();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm select-none"
      onClick={handleMaskClick}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-xl max-w-sm w-full mx-4 border border-default-200 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {deleting && (
          <div className="delete-progress">
            <div className="delete-progress-spinner" />
            <div className="delete-progress-text">删除中…</div>
          </div>
        )}
        <div className="text-sm font-medium text-default-800 dark:text-zinc-100 mb-2">{title}</div>
        {message && (
          <div className="text-xs text-default-500 dark:text-zinc-400 mb-4 whitespace-pre-line">
            {message}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-lg border border-default-200 hover:bg-default-100 transition-colors"
            onClick={onCancel}
            disabled={deleting}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-60"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
