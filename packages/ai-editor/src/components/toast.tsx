/**
 * 共享 Toast 提示通道
 *
 * 模块级事件机制：非 React 上下文（TipTap 扩展、上传流程）也可调用 `toast()`。
 * 渲染责任交给宿主：`QingWuAIEditor` 通过 `onToast` 回调把消息转发给
 * 宿主自己的 Toast 组件（如 @qingwu/toast）；未传 `onToast` 时消息静默丢弃，
 * 即 Toast 功能不可用（本包不再内置渲染宿主）。
 */
export type ToastType = "success" | "error" | "info";

export type ToastListener = (message: string, type: ToastType) => void;

const listeners = new Set<ToastListener>();

/** 触发全局 toast（任意上下文可调用） */
export function toast(message: string, type: ToastType = "error"): void {
  for (const listener of listeners) listener(message, type);
}

/** 订阅 toast 事件；返回取消订阅函数 */
export function subscribeToast(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
