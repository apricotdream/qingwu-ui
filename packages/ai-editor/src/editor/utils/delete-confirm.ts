import type { DeleteConfirmDialogProps } from "./delete-confirm-dialog";

/**
 * 共享删除确认标志
 * 多选删除（选中多个附件/代码块按 Delete）时，只有一个节点弹确认框，
 * 其余节点跳过。确认后 TipTap 的 deleteNode 会删除所有选中节点。
 *
 * 安全网：5s 自动复位，避免弹窗因异常路径未关闭导致标志位卡死为 true，
 * 进而使后续所有删除操作被静默跳过。
 */
let active = false;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_RESET_MS = 5000;

export function isDeleteConfirmActive(): boolean {
  return active;
}

export function setDeleteConfirmActive(value: boolean): void {
  active = value;
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  if (value) {
    resetTimer = setTimeout(() => {
      active = false;
      resetTimer = null;
    }, AUTO_RESET_MS);
  }
}

/* ---- 全局删除确认渲染器（对外开放，与 setToastProvider 同款模式）---- */

/** 宿主自定义确认渲染器：接收完整确认参数，自行渲染 UI 并调用 onConfirm/onCancel */
export type ConfirmProvider = (props: DeleteConfirmDialogProps) => void;

let confirmProvider: ConfirmProvider | null = null;

/**
 * 设置全局删除确认渲染器（默认使用内置项目 DeleteConfirmDialog）。
 * 传入 null/undefined 恢复内置默认。
 */
export function setConfirmProvider(provider: ConfirmProvider | null): void {
  confirmProvider = provider;
}

/** 读取全局确认渲染器（内置实现内部使用） */
export function getConfirmProvider(): ConfirmProvider | null {
  return confirmProvider;
}
