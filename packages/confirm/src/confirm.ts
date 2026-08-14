/* ============================================================
   青梧UI · Confirm 确认框组件
   - 纯 DOM 渲染，零第三方依赖
   - 缩放同源转场：从触发控件中心 morph 出现 / 确认取消后缩回
   - 互斥单例：同时仅一个确认框，新调用替换旧框（旧框 resolve 'dismiss'）
   - 异步确认：onConfirm 返回 Promise 时进入 loading 态，成功才缩回
   - role=dialog / aria-modal / 焦点陷阱 / Esc / 关闭后焦点回归触发按钮
   - SSR 安全：无 window 时 resolve 'dismiss'
   ============================================================ */

import type { BackdropAction, ConfirmOptions, ConfirmResult } from "./types";

/* ---------- 运行时常量 ---------- */
/** 运行时检测 prefers-reduced-motion（懒求值，支持运行时切换） */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 与 style.css 的 .qc-exit 过渡时长配套的兜底清理时间 */
const EXIT_FALLBACK_MS = 300;

interface ConfirmDefaults {
  confirmText: string;
  cancelText: string;
  backdrop: BackdropAction;
  closeOnEsc: boolean;
}

const DEFAULT_OPTS: ConfirmDefaults = {
  confirmText: "确认",
  cancelText: "取消",
  backdrop: "dismiss",
  closeOnEsc: true,
};

/** 合并后的完整配置（默认值已注入，读取无需再判空） */
interface ResolvedOptions {
  title?: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  icon?: string;
  onConfirm?: () => void | Promise<void>;
  backdrop: BackdropAction;
  closeOnEsc: boolean;
}

/* ---------- 工具 ---------- */
let _next = 1;
function uid(prefix: string): string {
  return `${prefix}${_next++}${Date.now().toString(36)}`;
}

function el(tag: string, cls?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

/** 渲染正文：解析 **关键词** 为强调色节点。全部走 textContent，无 innerHTML，杜绝 XSS。 */
function renderRich(container: HTMLElement, text: string): void {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (i % 2 === 1) {
      const mark = el("em", "qc-mark");
      mark.textContent = part;
      container.appendChild(mark);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  }
}

/* ---------- 内部会话 ---------- */
interface Session {
  trigger: HTMLElement | null;
  options: ResolvedOptions;
  layer: HTMLElement;
  backdrop: HTMLElement;
  stage: HTMLElement;
  panel: HTMLElement;
  confirmBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  titleId: string;
  msgId: string;
  promise: Promise<ConfirmResult>;
  resolve: (r: ConfirmResult) => void;
  reject: (err: unknown) => void;
  onKey: ((e: KeyboardEvent) => void) | null;
  loading: boolean;
  closed: boolean;
  settled: boolean;
  exitTimer: ReturnType<typeof setTimeout> | null;
}

/* ============================================================ */
export class ConfirmDialog {
  private opts: ConfirmOptions = {};
  private current: Session | null = null;

  constructor(options?: ConfirmOptions) {
    if (options) this.opts = { ...options };
  }

  /* ---- 核心 ---- */

  /**
   * 打开确认框，返回 Promise<ConfirmResult>。
   * - 互斥：已有一个确认框时，旧框瞬关并 resolve('dismiss')，再开新框
   * - 从触发控件中心 morph 出现；测量失败时降级为纯居中淡入
   * - Promise 在关闭动画结束后 settle（reduced-motion 下同步 settle）
   */
  confirm(trigger: HTMLElement | string, options?: ConfirmOptions): Promise<ConfirmResult> {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return Promise.resolve("dismiss");
    }

    const triggerEl = this._resolveTrigger(trigger);
    if (this.current) this._close("dismiss", true);

    const resolved = this._resolveOptions(options);
    const session = this._createSession(triggerEl, resolved);
    this.current = session;
    this._open(session);
    return session.promise;
  }

  /** 程序化关闭当前确认框，resolve('dismiss')；loading 期间忽略 */
  dismiss(): void {
    if (this.current) this._close("dismiss");
  }

  /** 更新全局默认配置 */
  configure(options: ConfirmOptions): void {
    this.opts = { ...this.opts, ...options };
  }

  /** 销毁：移除当前确认框并 resolve('dismiss') */
  destroy(): void {
    if (this.current) this._finishClose(this.current, "dismiss");
  }

  /* ---- 内部 ---- */

  private _resolveTrigger(trigger: HTMLElement | string): HTMLElement | null {
    if (typeof trigger === "string") {
      try {
        return document.querySelector(trigger);
      } catch {
        return null;
      }
    }
    return trigger;
  }

  private _resolveOptions(local?: ConfirmOptions): ResolvedOptions {
    const g = this.opts;
    const o = local ?? {};
    return {
      title: o.title ?? g.title,
      message: o.message ?? g.message,
      confirmText: o.confirmText ?? g.confirmText ?? DEFAULT_OPTS.confirmText,
      cancelText: o.cancelText ?? g.cancelText ?? DEFAULT_OPTS.cancelText,
      danger: o.danger ?? g.danger ?? false,
      icon: o.icon ?? g.icon,
      onConfirm: o.onConfirm ?? g.onConfirm,
      backdrop: o.backdrop ?? g.backdrop ?? DEFAULT_OPTS.backdrop,
      closeOnEsc: o.closeOnEsc ?? g.closeOnEsc ?? DEFAULT_OPTS.closeOnEsc,
    };
  }

  private _createSession(trigger: HTMLElement | null, options: ResolvedOptions): Session {
    const titleId = uid("qc-t-");
    const msgId = uid("qc-m-");

    const layer = el("div", "qc-layer");
    const backdrop = el("div", "qc-backdrop");
    backdrop.setAttribute("aria-hidden", "true");
    const stage = el("div", "qc-stage");
    layer.append(backdrop, stage);

    const s: Session = {
      trigger,
      options,
      layer,
      backdrop,
      stage,
      panel: null as unknown as HTMLElement,
      confirmBtn: null as unknown as HTMLButtonElement,
      cancelBtn: null as unknown as HTMLButtonElement,
      titleId,
      msgId,
      promise: null as unknown as Promise<ConfirmResult>,
      resolve: () => {},
      reject: () => {},
      onKey: null,
      loading: false,
      closed: false,
      settled: false,
      exitTimer: null,
    };

    s.promise = new Promise<ConfirmResult>((resolve, reject) => {
      s.resolve = resolve;
      s.reject = reject;
    });

    /* 遮罩点击：按 backdrop 选项关闭或忽略 */
    backdrop.addEventListener("click", () => {
      if (s.loading || s.closed) return;
      const action = s.options.backdrop;
      if (action === "ignore") return;
      this._close(action);
    });

    s.panel = this._buildPanel(s);
    stage.appendChild(s.panel);
    return s;
  }

  private _buildPanel(s: Session): HTMLElement {
    const o = s.options;
    const panel = el("div", "qc-panel");
    if (o.danger) panel.classList.add("qc-danger");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", s.titleId);
    if (o.message) panel.setAttribute("aria-describedby", s.msgId);

    if (o.icon) {
      const iconWrap = el("div", "qc-icon");
      iconWrap.innerHTML = o.icon;
      panel.appendChild(iconWrap);
    }

    const title = el("h2", "qc-title");
    title.id = s.titleId;
    title.textContent = o.title ?? "确认";
    panel.appendChild(title);

    if (o.message) {
      const msg = el("div", "qc-msg");
      msg.id = s.msgId;
      renderRich(msg, o.message);
      panel.appendChild(msg);
    }

    const actions = el("div", "qc-actions");

    const cancelBtn = el("button", "qc-btn qc-cancel") as HTMLButtonElement;
    cancelBtn.type = "button";
    cancelBtn.textContent = o.cancelText;
    cancelBtn.addEventListener("click", () => {
      if (s.loading || s.closed) return;
      this._close("cancel");
    });

    const confirmBtn = el("button", "qc-btn qc-confirm") as HTMLButtonElement;
    confirmBtn.type = "button";
    confirmBtn.textContent = o.confirmText;
    confirmBtn.addEventListener("click", () => this._onConfirm(s));

    const spinner = el("span", "qc-spinner");
    spinner.setAttribute("aria-hidden", "true");
    confirmBtn.insertBefore(spinner, confirmBtn.firstChild);

    actions.append(cancelBtn, confirmBtn);
    panel.appendChild(actions);

    s.confirmBtn = confirmBtn;
    s.cancelBtn = cancelBtn;
    return panel;
  }

  private _open(s: Session): void {
    document.body.appendChild(s.layer);

    const origin = this._measureOrigin(s.trigger);
    if (origin) {
      s.panel.style.setProperty("--qc-tx", `${origin.tx}px`);
      s.panel.style.setProperty("--qc-ty", `${origin.ty}px`);
    }

    s.onKey = (e: KeyboardEvent) => this._onKey(e, s);
    document.addEventListener("keydown", s.onKey);

    /* 双 rAF：确保初始态（opacity 0 / scale 0.02）已绘制再切换，触发过渡 */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        s.panel.classList.add("qc-open");
        s.backdrop.classList.add("qc-open");
        try {
          s.confirmBtn.focus();
        } catch {
          /* noop */
        }
      });
    });
  }

  /** 测量触发控件中心相对视口中心的偏移；测量失败返回 null（降级纯居中淡入） */
  private _measureOrigin(trigger: HTMLElement | null): { tx: number; ty: number } | null {
    if (!trigger?.isConnected) return null;
    let rect: DOMRect;
    try {
      rect = trigger.getBoundingClientRect();
    } catch {
      return null;
    }
    if (rect.width === 0 && rect.height === 0) return null;
    return {
      tx: rect.left + rect.width / 2 - window.innerWidth / 2,
      ty: rect.top + rect.height / 2 - window.innerHeight / 2,
    };
  }

  private _onKey(e: KeyboardEvent, s: Session): void {
    if (e.key === "Escape") {
      if (s.loading || s.closed) return;
      if (s.options.closeOnEsc) {
        e.preventDefault();
        this._close("dismiss");
      }
      return;
    }
    if (e.key === "Tab") this._trapFocus(e, s);
  }

  private _trapFocus(e: KeyboardEvent, s: Session): void {
    const focusables = Array.from(
      s.panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !s.panel.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private _onConfirm(s: Session): void {
    if (s.loading || s.closed) return;
    const onConfirm = s.options.onConfirm;
    if (!onConfirm) {
      this._close("confirm");
      return;
    }

    s.loading = true;
    s.panel.classList.add("qc-loading");
    s.panel.setAttribute("aria-busy", "true");
    s.confirmBtn.disabled = true;
    s.cancelBtn.disabled = true;

    Promise.resolve()
      .then(() => onConfirm())
      .then(
        () => {
          this._clearLoading(s);
          this._close("confirm");
        },
        (err: unknown) => {
          /* 失败：保持对话框打开，还原 loading，向调用方抛错 */
          this._clearLoading(s);
          if (!s.settled) {
            s.settled = true;
            s.reject(err);
          }
        },
      );
  }

  private _clearLoading(s: Session): void {
    s.loading = false;
    s.panel.classList.remove("qc-loading");
    s.panel.removeAttribute("aria-busy");
    s.confirmBtn.disabled = false;
    s.cancelBtn.disabled = false;
  }

  private _close(result: ConfirmResult, instant = false): void {
    const s = this.current;
    if (!s) return;
    /* loading 期间屏蔽逃逸（Esc / 遮罩 / dismiss）；instant 程序化替换除外 */
    if (s.loading && result !== "confirm" && !instant) return;
    if (s.closed && !instant) return;
    s.closed = true;

    if (instant || prefersReducedMotion()) {
      this._finishClose(s, result);
      return;
    }

    s.panel.classList.remove("qc-open");
    s.panel.classList.add("qc-exit");
    s.backdrop.classList.remove("qc-open");
    s.backdrop.classList.add("qc-exit");

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      this._finishClose(s, result);
    };
    s.panel.addEventListener("transitionend", cleanup, { once: true });
    s.exitTimer = setTimeout(cleanup, EXIT_FALLBACK_MS);
  }

  private _finishClose(s: Session, result: ConfirmResult): void {
    if (this.current === s) this.current = null;
    if (s.onKey) {
      document.removeEventListener("keydown", s.onKey);
      s.onKey = null;
    }
    if (s.exitTimer) {
      clearTimeout(s.exitTimer);
      s.exitTimer = null;
    }
    try {
      s.trigger?.focus?.();
    } catch {
      /* noop */
    }
    s.layer.remove();
    if (!s.settled) {
      s.settled = true;
      s.resolve(result);
    }
  }
}
