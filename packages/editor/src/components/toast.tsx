/**
 * 共享 Toast 提示
 *
 * 模块级事件机制：非 React 上下文（TipTap 扩展、上传流程）也可调用 `toast()`；
 * `ToastHost` 组件挂载在 QingWuEditor 内负责渲染，未挂载时调用静默丢弃。
 * 样式沿用项目内联 toast 模式（ai-settings-dialog / storage-settings-dialog 的
 * fixed 右上角 + 4s 自动消失）。
 */
import { type FC, useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

type ToastListener = (item: ToastItem) => void;

const listeners = new Set<ToastListener>();
let toastSeq = 0;

/** 触发全局 toast（任意上下文可调用） */
export function toast(message: string, type: ToastType = "error"): void {
  const item: ToastItem = { id: ++toastSeq, type, message };
  for (const listener of listeners) listener(item);
}

function subscribeToast(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const TYPE_CLASS: Record<ToastType, string> = {
  success: "border-green-200 bg-green-50/95 text-green-700",
  error: "border-danger-200 bg-danger-50/95 text-danger",
  info: "border-default-200 bg-background/95 text-default-700",
};

const TYPE_ICON: Record<ToastType, string> = {
  success: "✓",
  error: "!",
  info: "ℹ",
};

/** Toast 渲染宿主：挂载于 QingWuEditor 内，展示全局 toast 消息 */
export const ToastHost: FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToast((item) => {
      setToasts((prev) => [...prev.slice(-2), item]);
      // 4s 自动消失（与项目内联 toast 行为一致）
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 4000);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[10001] flex w-[calc(100vw-32px)] max-w-sm flex-col gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-sm ${TYPE_CLASS[item.type]}`}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">{TYPE_ICON[item.type]}</span>
            <span className="min-w-0 break-words">{item.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
