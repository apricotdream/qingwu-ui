/* ============================================================
   青梧UI · Toast 轻提示组件
   - 纯 DOM 渲染，零第三方依赖
   - ARIA live region 内建 / prefers-reduced-motion 自动克制
   - 6 种定位 / 4 种语义类型 / Promise 链 / 队列管理
   - 文本自适应行数：@qingwu/text-layout 精确排版
   ============================================================ */

import { layout } from "@qingwu/text-layout";
import type {
  PromiseMessages,
  ToasterOptions,
  ToastOptions,
  ToastPosition,
  ToastType,
} from "./types";

/* ---------- 运行时常量 ---------- */
const PREFERS_REDUCED =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

/* 与 style.css 保持一致的字体串（text-layout Canvas 测量用） */
const MSG_FONT =
  '13.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

/**
 * 内容区可用宽度估算：
 * 容器 380 - padding 32 - icon 28 - gap 10 - close 20 ≈ 290px
 * 移动端：视口 - 容器边距 20 - padding 24 - icon 26 - gap 8 - close 20
 */
function msgMaxWidth(): number {
  if (typeof window === "undefined") return 290;
  const vw = window.innerWidth;
  return vw <= 480 ? Math.max(140, vw - 98) : 290;
}

/* ---------- SVG 图标 ---------- */
const ICONS: Record<ToastType, string> = {
  info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
};

/* ---------- 工具 ---------- */
let _next = 1;
function uid(): string {
  return `qt${_next++}${Date.now().toString(36)}`;
}

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/**
 * 渲染一行文本：解析 **关键词** 标记为语义色强调节点。
 * 全部走 textContent，无 innerHTML，杜绝 XSS。
 */
function renderLine(container: HTMLElement, text: string): void {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (i % 2 === 1) {
      const mark = el("em", "qt-mark");
      mark.textContent = part;
      container.appendChild(mark);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  }
}

/* ---------- 内部条目 ---------- */
interface ToastEntry {
  id: string;
  type: ToastType;
  dismissible: boolean;
  /** 创建时的定位（出队/挂载时保持，不被全局默认覆盖） */
  position: ToastPosition;
  element: HTMLElement;
  /** auto-dismiss 定时器 */
  timer: ReturnType<typeof setTimeout> | null;
}

const DEFAULT_OPTS: Required<ToasterOptions> = {
  type: "info",
  position: "top-center" /* 默认顶部居中（EP/AntD 惯例） */,
  duration: 4000,
  maxVisible: 5,
  maxLines: 2,
  vibrate: true,
};

/* 错误震动模式：三次短脉冲（警示感） */
const ERROR_VIBRATION = [80, 40, 80] as const;

/** 触发设备震动（不支持时静默忽略） */
function vibrateError(): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(ERROR_VIBRATION);
  } catch {
    /* 某些环境（无马达/权限受限）抛错，忽略 */
  }
}

/* ============================================================ */
export class Toaster {
  /** 每个定位一个容器，互不干扰（参照 sonner / react-toastify） */
  private containers = new Map<ToastPosition, HTMLElement>();
  private opts = { ...DEFAULT_OPTS };
  private toasts = new Map<string, ToastEntry>();
  private queue: ToastEntry[] = [];

  constructor(opts?: ToasterOptions) {
    if (opts) Object.assign(this.opts, opts);
  }

  /** 按定位获取（惰性创建）容器 */
  private ensureContainer(position: ToastPosition): HTMLElement {
    let c = this.containers.get(position);
    if (!c) {
      c = el("div", "qt-container");
      c.setAttribute("data-qt-pos", position);
      c.setAttribute("role", "status");
      c.setAttribute("aria-live", "polite");
      c.setAttribute("aria-atomic", "false");
      document.body.appendChild(c);
      this.containers.set(position, c);
    }
    return c;
  }

  /* ---- 核心 ---- */

  /** 显示一条轻提示，返回唯一 id */
  show(message: string, options?: ToastOptions): string {
    const type = options?.type ?? this.opts.type;
    const position = options?.position ?? this.opts.position;
    const duration = options?.duration ?? this.opts.duration;
    const dismissible = options?.dismissible ?? true;
    const maxLines = options?.maxLines ?? this.opts.maxLines;

    const id = uid();
    const entry: ToastEntry = {
      id,
      type,
      dismissible,
      position,
      element: this.buildElement(id, message, type, dismissible, maxLines),
      timer: null,
    };

    /* 队列检查 */
    if (this.toasts.size >= this.opts.maxVisible) {
      this.queue.push(entry);
      return id;
    }

    this.mount(entry, duration);
    return id;
  }

  /** 快捷：info */
  info(message: string, options?: ToastOptions): string {
    return this.show(message, { ...options, type: "info" });
  }
  /** 快捷：success */
  success(message: string, options?: ToastOptions): string {
    return this.show(message, { ...options, type: "success" });
  }
  /** 快捷：warning */
  warn(message: string, options?: ToastOptions): string {
    return this.show(message, { ...options, type: "warning" });
  }
  /** 快捷：error */
  error(message: string, options?: ToastOptions): string {
    return this.show(message, { ...options, type: "error" });
  }

  /* ---- Promise 链 ---- */

  /** 跟随 Promise 三态：loading → success | error */
  promise<T>(promise: Promise<T>, messages: PromiseMessages<T>, options?: ToastOptions): string {
    const id = this.show(messages.loading, {
      ...options,
      type: "info",
      duration: 0,
      dismissible: false,
    });

    promise.then(
      (data) => {
        this.dismiss(id);
        const msg =
          typeof messages.success === "function" ? messages.success(data) : messages.success;
        // 确保 loading toast 已完全移除后再显示 success
        requestAnimationFrame(() => {
          this.success(msg, options);
        });
      },
      (err) => {
        this.dismiss(id);
        const msg = typeof messages.error === "function" ? messages.error(err) : messages.error;
        requestAnimationFrame(() => {
          this.error(msg, options);
        });
      },
    );

    return id;
  }

  /* ---- 关闭 ---- */

  /** 关闭指定 id 的 toast；不传 id 则关闭全部 */
  dismiss(id?: string): void {
    if (id) {
      const entry = this.toasts.get(id);
      if (entry) this._exit(entry);
    } else {
      this.dismissAll();
    }
  }

  /** 关闭全部 */
  dismissAll(): void {
    for (const entry of this.toasts.values()) this._exit(entry);
    this.queue.length = 0;
  }

  /* ---- 配置 ---- */

  /** 更新全局默认配置 */
  configure(options: Partial<ToasterOptions>): void {
    Object.assign(this.opts, options);
  }

  /** 销毁实例，移除全部 DOM 容器 */
  destroy(): void {
    for (const entry of this.toasts.values()) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    this.toasts.clear();
    this.queue.length = 0;
    for (const c of this.containers.values()) c.remove();
    this.containers.clear();
  }

  /* ============================================================
     内部方法
     ============================================================ */

  private buildElement(
    id: string,
    message: string,
    type: ToastType,
    dismissible: boolean,
    maxLines: number,
  ): HTMLElement {
    const toastEl = el("div", `qt-toast qt-${type}`);
    toastEl.setAttribute("data-qt-id", id);

    /* 图标 */
    const iconEl = el("span", "qt-icon");
    iconEl.innerHTML = ICONS[type];
    toastEl.appendChild(iconEl);

    /* 文本：text-layout 精确排版，自适应行数与宽度 */
    const msgEl = el("span", "qt-msg");
    const result = layout(message, { maxWidth: msgMaxWidth(), lineHeight: 1, maxLines }, MSG_FONT);

    if (result.lineCount <= 1) {
      /* 单行：直接填充，CSS 单行省略作兜底 */
      renderLine(msgEl, message);
    } else {
      /* 多行：每行独立 span，末行若被截断追加省略号 */
      result.lines.forEach((line, i) => {
        const span = el("span", "qt-line");
        let text = line.text;
        if (i === result.lines.length - 1 && result.truncated && !text.endsWith("…")) {
          text += "…";
        }
        renderLine(span, text);
        msgEl.appendChild(span);
      });
    }
    toastEl.appendChild(msgEl);

    /* 关闭按钮（SF Symbol xmark） */
    if (dismissible) {
      const btn = el(
        "button",
        "qt-close",
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      ) as HTMLButtonElement;
      btn.type = "button";
      btn.setAttribute("aria-label", "关闭通知");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.dismiss(id);
      });
      toastEl.appendChild(btn);
    }

    /* 点击整条关闭 */
    if (dismissible) {
      toastEl.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".qt-close")) return;
        this.dismiss(id);
      });
    }

    return toastEl;
  }

  private mount(entry: ToastEntry, duration: number): void {
    const container = this.ensureContainer(entry.position);
    this.toasts.set(entry.id, entry);
    container.appendChild(entry.element);

    /* 错误类型触发设备震动（含队列出队场景） */
    if (entry.type === "error" && this.opts.vibrate) {
      vibrateError();
    }

    /* 入场动画 */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        entry.element.classList.add("qt-enter");
      });
    });

    /* 自动消失 */
    if (duration > 0) {
      entry.timer = setTimeout(() => this.dismiss(entry.id), duration);
    }
  }

  private _exit(entry: ToastEntry): void {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }

    entry.element.classList.remove("qt-enter");
    entry.element.classList.add("qt-exit");

    const cleanup = () => {
      entry.element.remove();
      this.toasts.delete(entry.id);
      this._dequeue();
    };

    if (PREFERS_REDUCED) {
      cleanup();
    } else {
      // transitionend + fallback
      let done = false;
      const onEnd = () => {
        if (done) return;
        done = true;
        cleanup();
      };
      entry.element.addEventListener("transitionend", onEnd, { once: true });
      setTimeout(onEnd, 400);
    }
  }

  private _dequeue(): void {
    if (!this.queue.length) return;
    if (this.toasts.size >= this.opts.maxVisible) return;

    /* 出队 toast 保持创建时的定位与时长 */
    const next = this.queue.shift()!;
    const duration = this.opts.duration;
    this.mount(next, duration);
  }
}
