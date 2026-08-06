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
  /** 自动消失毫秒数，0 表示常驻，默认 4000；persist: true 时强制为 0 */
  duration?: number;
  /** 是否可点击关闭，默认 true */
  dismissible?: boolean;
  /**
   * 常驻不自动消失（等价 duration: 0），默认 false。
   * 常驻 toast 受 ToasterOptions.persistMaxVisible 数量上限约束（按容器位置独立计算）。
   */
  persist?: boolean;
  /**
   * 文本最大行数（由 @qingwu/text-layout 精确排版），超过后按字符截断并追加省略号；
   * 默认不限制 → 长文本完整显示（内容自适应），文本宽度自适应。
   * 仅作用于主消息 message，description 不参与截断
   */
  maxLines?: number;
  /**
   * 次级说明行：显示在主消息下方，弱化色小字号。
   * 纯文本（不解析 **关键词** 标记），不参与 maxLines 截断，允许换行完整显示
   */
  description?: string;
  /**
   * 单个操作按钮（如「重试」）：点击后先关闭 toast 再执行 onClick。
   * 按钮位于主消息右侧，不参与整条点击关闭
   */
  action?: { label: string; onClick: () => void };
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
