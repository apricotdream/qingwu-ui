/** Toast 全局单例：懒初始化（SSR 安全），可调用 toast("msg") 或 toast.success("msg") */

import { Toaster } from "./toast";
import type { PromiseMessages, ToasterOptions, ToastOptions } from "./types";

let _inst: Toaster | null = null;

function get(): Toaster {
  if (!_inst) _inst = new Toaster();
  return _inst;
}

export type ToastFn = {
  (message: string, options?: ToastOptions): string;
  info(message: string, options?: ToastOptions): string;
  success(message: string, options?: ToastOptions): string;
  warn(message: string, options?: ToastOptions): string;
  error(message: string, options?: ToastOptions): string;
  promise<T>(promise: Promise<T>, messages: PromiseMessages<T>, options?: ToastOptions): string;
  dismiss(id?: string): void;
  dismissAll(): void;
  configure(options: Partial<ToasterOptions>): void;
};

const fn = (message: string, options?: ToastOptions): string => get().show(message, options);

export const toast: ToastFn = Object.assign(fn, {
  info: (message: string, options?: ToastOptions) => get().info(message, options),
  success: (message: string, options?: ToastOptions) => get().success(message, options),
  warn: (message: string, options?: ToastOptions) => get().warn(message, options),
  error: (message: string, options?: ToastOptions) => get().error(message, options),
  promise: <T>(promise: Promise<T>, messages: PromiseMessages<T>, options?: ToastOptions) =>
    get().promise(promise, messages, options),
  dismiss: (id?: string) => get().dismiss(id),
  dismissAll: () => get().dismissAll(),
  configure: (options: Partial<ToasterOptions>) => get().configure(options),
});
