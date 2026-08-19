import type { DeleteConfirmDialogProps } from "./delete-confirm-dialog";

/**
 * 共享删除确认标志：多选删除只弹一次确认；5s 自动复位，避免标志位卡死导致后续删除被静默跳过。
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

// 全局删除确认渲染器（对外开放，与 setToastProvider 同款模式）

/** 宿主自定义确认渲染器：接收确认参数自行渲染 UI */
export type ConfirmProvider = (props: DeleteConfirmDialogProps) => void;

let confirmProvider: ConfirmProvider | null = null;

/** 设置全局删除确认渲染器；传 null 恢复内置默认 */
export function setConfirmProvider(provider: ConfirmProvider | null): void {
  confirmProvider = provider;
}

/** 读取全局确认渲染器（内置实现内部使用） */
export function getConfirmProvider(): ConfirmProvider | null {
  return confirmProvider;
}
