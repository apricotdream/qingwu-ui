/** Toast 轻提示类型定义（framework-agnostic type contracts） */

/** 语义类型 */
export type ToastType = "info" | "success" | "warning" | "error";

/** 容器定位 */
export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** 单条 toast 配置 */
export interface ToastOptions {
  /** 语义类型，默认 "info" */
  type?: ToastType;
  /** 容器定位，默认 "top-center" */
  position?: ToastPosition;
  /** 自动消失毫秒数，0 表示常驻，默认 4000；persist: true 时强制为 0 */
  duration?: number;
  /** 是否可点击关闭，默认 true */
  dismissible?: boolean;
  /** 常驻不自动消失（等价 duration: 0），受 persistMaxVisible 上限约束（按位置独立计算），默认 false */
  persist?: boolean;
  /** 文本最大行数（text-layout 精确排版），超出按字符截断加省略号；默认不限→完整显示；仅作用于主消息 */
  maxLines?: number;
  /** 次级说明行：纯文本，不解析 **标记**，不参与 maxLines 截断，完整换行显示 */
  description?: string;
  /** 单个操作按钮（如「重试」）：点击先关闭再执行 onClick，不参与整条点击关闭 */
  action?: { label: string; onClick: () => void };
  /** 错误类型触发设备震动（navigator.vibrate），默认 true；桌面无马达时静默忽略 */
  vibrate?: boolean;
}

/** 全局/工厂级配置 */
export interface ToasterOptions {
  /** 默认语义类型 */
  type?: ToastType;
  /** 默认容器定位 */
  position?: ToastPosition;
  /** 默认自动消失毫秒数 */
  duration?: number;
  /** 同时最多显示条数，超出排队，默认 5 */
  maxVisible?: number;
  /** 默认是否常驻不自动消失，默认 false */
  persist?: boolean;
  /** 单容器位置最多同时显示的常驻条数，超出后挤掉最老的常驻，默认 3 */
  persistMaxVisible?: number;
  /** 默认文本最大行数，默认不限（完整显示） */
  maxLines?: number;
  /** 错误类型默认是否震动，默认 true */
  vibrate?: boolean;
}

/** Promise 链三态消息 */
export interface PromiseMessages<T> {
  /** pending 态消息 */
  loading: string;
  /** resolved 态消息（可为函数，接收 resolve 值） */
  success: string | ((data: T) => string);
  /** rejected 态消息（可为函数，接收 reject 原因） */
  error: string | ((err: unknown) => string);
}
