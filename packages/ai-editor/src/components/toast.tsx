/**
 * 共享 Toast 提示通道
 *
 * 模块级事件机制：非 React 上下文（TipTap 扩展、上传流程）也可调用 `toast()`。
 * 渲染优先级（高 → 低）：
 * 1. 实例级：`QingWuAIEditor` 通过 `onToast` 回调订阅，把消息转发给宿主自己的 Toast 组件；
 * 2. 全局级：宿主调用 `setToastProvider()` 设置自定义渲染器，替换内置默认；
 * 3. 内置默认：无任何订阅时回退到 `@qingwu/toast`（随包内置样式），提示不再静默丢弃。
 */
import { toast as qwToast } from "@qingwu/toast";

export type ToastType = "success" | "error" | "info";

/** 透传给内置 @qingwu/toast 的展示选项；宿主自定义渲染器可自行决定是否采纳 */
export interface ToastOptions {
  /** 文本最大行数，超过后截断追加省略号 */
  maxLines?: number;
  /** 自动消失毫秒数，0 表示常驻 */
  duration?: number;
}

export type ToastListener = (
  message: string,
  type: ToastType,
  options?: ToastOptions,
) => void;

const listeners = new Set<ToastListener>();

/** 全局自定义渲染器：setToastProvider 设置，优先级高于内置 @qingwu/toast */
let customProvider: ToastListener | null = null;

/**
 * 设置全局 Toast 渲染器（对外开放，与 setStorageProvider / setAIProvider 同款模式）。
 * 传入 null/undefined 时恢复内置默认（@qingwu/toast）。
 * 实例级 onToast 优先级更高，同时存在时以 onToast 为准。
 */
export function setToastProvider(provider: ToastListener | null): void {
  customProvider = provider;
}

/** 触发全局 toast（任意上下文可调用） */
export function toast(
  message: string,
  type: ToastType = "error",
  options?: ToastOptions,
): void {
  if (listeners.size > 0) {
    for (const listener of listeners) listener(message, type, options);
    return;
  }
  if (customProvider) {
    customProvider(message, type, options);
    return;
  }
  // 内置默认：@qingwu/toast（随包内置，开箱即用）
  if (type === "success") qwToast.success(message, options);
  else if (type === "info") qwToast.info(message, options);
  else qwToast.error(message, options);
}

/** 订阅 toast 事件；返回取消订阅函数 */
export function subscribeToast(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
