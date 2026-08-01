/* ============================================================
   青梧UI · Toast 轻提示类型定义
   Qingwu Toast — framework-agnostic type contracts
   ============================================================ */

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
  /** 自动消失毫秒数，0 表示常驻，默认 4000 */
  duration?: number;
  /** 是否可点击关闭，默认 true */
  dismissible?: boolean;
  /**
   * 文本最大行数（由 @qingwu/text-layout 精确排版），默认 2；
   * 超过后按字符截断并追加省略号，文本宽度自适应
   */
  maxLines?: number;
  /**
   * 错误类型是否触发设备震动（navigator.vibrate），默认 true；
   * 仅 error 类型震动，桌面端无马达时静默忽略
   */
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
  /** 默认文本最大行数，默认 2 */
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
