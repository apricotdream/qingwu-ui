/** 青梧UI · Confirm 确认框类型定义（framework-agnostic 类型契约） */

/** 关闭结果：确认 / 取消 / 逃逸（Esc / 遮罩 / 程序化 dismiss） */
export type ConfirmResult = "confirm" | "cancel" | "dismiss";

/** 遮罩点击行为 */
export type BackdropAction = "dismiss" | "cancel" | "ignore";

/** 确认框配置 */
export interface ConfirmOptions {
  /** 主标题（同时作为对话框无障碍名称） */
  title?: string;
  /** 正文；纯文本，**关键词** 标记渲染为强调色 */
  message?: string;
  /** 确认按钮文案，默认 "确认" */
  confirmText?: string;
  /** 取消按钮文案，默认 "取消" */
  cancelText?: string;
  /** 破坏性变体：确认按钮红色（删除等危险操作） */
  danger?: boolean;
  /** 标题上方可选图标（内联 SVG 字符串，由调用方提供） */
  icon?: string;
  /** 确认回调；返回 Promise 时进入 loading，成功后缩回 resolve('confirm')，reject 保持打开并抛错 */
  onConfirm?: () => void | Promise<void>;
  /** 遮罩点击行为，默认 "dismiss"（与取消按钮的语义区分：逃逸 ≠ 明确拒绝） */
  backdrop?: BackdropAction;
  /** Esc 是否关闭，默认 true；loading 期间始终忽略 Esc */
  closeOnEsc?: boolean;
}
