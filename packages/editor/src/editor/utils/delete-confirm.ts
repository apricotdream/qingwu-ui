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
