/** 青梧UI · Confirm 全局单例：懒初始化（SSR 安全），confirm(trigger, opts) 可调用 */

import { ConfirmDialog } from "./confirm";
import type { ConfirmOptions, ConfirmResult } from "./types";

let _inst: ConfirmDialog | null = null;

function get(): ConfirmDialog {
  if (!_inst) _inst = new ConfirmDialog();
  return _inst;
}

export type ConfirmFn = {
  (trigger: HTMLElement | string, options?: ConfirmOptions): Promise<ConfirmResult>;
  dismiss(): void;
  configure(options: ConfirmOptions): void;
};

const fn = (trigger: HTMLElement | string, options?: ConfirmOptions): Promise<ConfirmResult> =>
  get().confirm(trigger, options);

export const confirm: ConfirmFn = Object.assign(fn, {
  dismiss: () => get().dismiss(),
  configure: (options: ConfirmOptions) => get().configure(options),
});
