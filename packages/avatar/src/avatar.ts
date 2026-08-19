/* ============================================================
   青梧UI · 头像编辑组件（AvatarEditor）
   - 点击头像打开编辑层：选择 / 拖拽图片
   - 拖动定位、缩放、左右 90° 旋转、圆角率实时调节
   - Canvas 本地导出，回调同时给出 Blob 与 dataURL
   - 零框架依赖，纯 DOM + CSS
   ============================================================ */

import { ICON_CLOSE, ICON_EDIT, ICON_REFRESH, ICON_RETRY } from "../../../icon/icons";
import type { AvatarEditorOptions, AvatarEditorResult } from "./types";

const DEG = Math.PI / 180;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

/**
 * 在 size×size 正方形上绘制圆角路径。
 * 优先使用原生 roundRect（真实圆弧：半径达到 size/2 时四段角弧圆心重合于正方形中心，
 * 得到正圆）；老环境回退到二次贝塞尔近似（抛物线角弧，最圆时仍轻微外凸）。
 */
function roundRect(ctx: CanvasRenderingContext2D, size: number, radius: number): void {
  const r = Math.max(0, Math.min(size / 2, radius));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(0, 0, size, size, r);
    return;
  }
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
}

export class AvatarEditor {
  readonly el: HTMLElement;

  private readonly trigger: HTMLButtonElement;
  private readonly preview: HTMLImageElement;
  private readonly fallback: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private readonly dialog: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly empty: HTMLElement;
  private readonly editor: HTMLElement;
  private readonly zoomInput: HTMLInputElement;
  private readonly radiusInput: HTMLInputElement;
  private readonly rotateLeft: HTMLButtonElement;
  private readonly rotateRight: HTMLButtonElement;
  private readonly replace: HTMLButtonElement;
  private readonly reset: HTMLButtonElement;
  private readonly cancel: HTMLButtonElement;
  private readonly confirm: HTMLButtonElement;

  private readonly outputSize: number;
  private readonly maxZoom: number;
  private readonly outputFormat: "png" | "jpeg";
  private readonly quality: number;
  private readonly backgroundColor: string | undefined;
  private defaultRadius: number;
  private image: HTMLImageElement | null = null;
  private objectUrl: string | null = null;
  private angle = 0;
  private zoom = 1;
  private radius: number;
  private offset = { x: 0, y: 0 };
  private isOpen = false;
  private lastFocus: HTMLElement | null = null;
  private readonly onConfirm?: (result: AvatarEditorResult) => void;
  private readonly onOpenChange?: (open: boolean) => void;

  constructor(root: HTMLElement, opts: AvatarEditorOptions = {}) {
    this.outputSize = Math.max(32, Math.round(opts.outputSize ?? 256));
    this.maxZoom = Math.max(1, opts.maxZoom ?? 3);
    this.defaultRadius = Math.min(50, Math.max(0, opts.radius ?? 50));
    this.radius = this.defaultRadius;
    this.outputFormat = opts.outputFormat ?? "png";
    this.quality = Math.max(0, Math.min(1, opts.quality ?? 0.92));
    // jpeg 无透明通道：圆角外区域必须铺底，否则透明像素编码成黑色
    this.backgroundColor = opts.backgroundColor ?? (this.outputFormat === "jpeg" ? "#ffffff" : undefined);
    this.onConfirm = opts.onConfirm;
    this.onOpenChange = opts.onOpenChange;

    this.el = el("div", "qav-root");
    if (opts.className) this.el.classList.add(opts.className);
    this.el.style.setProperty("--qav-size", `${Math.max(24, opts.size ?? 96)}px`);

    this.trigger = el("button", "qav-trigger");
    this.trigger.type = "button";
    this.trigger.setAttribute("aria-label", opts.ariaLabel ?? "编辑头像");
    this.preview = el("img", "qav-preview");
    this.preview.alt = "";
    this.preview.hidden = true;
    this.fallback = el("span", "qav-fallback", ICON_EDIT);
    this.fallback.setAttribute("aria-hidden", "true");
    const badge = el("span", "qav-badge", ICON_EDIT);
    badge.setAttribute("aria-hidden", "true");
    this.trigger.append(this.preview, this.fallback, badge);

    this.fileInput = el("input", "qav-file");
    this.fileInput.type = "file";
    this.fileInput.accept = opts.accept ?? "image/*";
    this.fileInput.hidden = true;
    this.el.append(this.trigger, this.fileInput);

    this.dialog = el("div", "qav-dialog");
    this.dialog.hidden = true;
    this.dialog.setAttribute("role", "dialog");
    this.dialog.setAttribute("aria-modal", "true");
    this.dialog.setAttribute("aria-label", "编辑头像");
    // 宿主 Lenis 劫持滚轮防护：编辑层滚动需自管（与 slash-command 弹窗同款）
    this.dialog.setAttribute("data-lenis-prevent", "");

    const panel = el("div", "qav-panel");
    const header = el("header", "qav-header");
    header.append(el("h3", "qav-title", "编辑头像"), this.createCloseButton());

    this.canvas = el("canvas", "qav-canvas");
    this.canvas.width = this.outputSize;
    this.canvas.height = this.outputSize;
    this.editor = el("div", "qav-editor");
    this.editor.append(this.canvas);
    this.empty = el(
      "div",
      "qav-empty",
      "<span>点击或拖入图片</span><small>PNG / JPG / WebP</small>",
    );
    this.editor.append(this.empty);

    const controls = el("div", "qav-controls");
    this.rotateLeft = this.iconButton("向左旋转", ICON_RETRY);
    this.rotateRight = this.iconButton("向右旋转", ICON_REFRESH);
    this.zoomInput = this.range("缩放", 1, this.maxZoom, 0.01, 1);
    this.radiusInput = this.range("圆角率", 0, 50, 1, this.radius);
    const rotateBox = el("div", "qav-rotate");
    rotateBox.append(this.rotateLeft, this.rotateRight);
    controls.append(
      this.row("旋转", rotateBox),
      this.row("缩放", this.zoomInput),
      this.row("圆角", this.radiusInput),
    );

    this.replace = el("button", "qav-secondary");
    this.replace.type = "button";
    this.replace.textContent = "更换图片";
    this.reset = el("button", "qav-secondary");
    this.reset.type = "button";
    this.reset.textContent = "重置";
    this.cancel = el("button", "qav-secondary");
    this.cancel.type = "button";
    this.cancel.textContent = "取消";
    this.confirm = el("button", "qav-primary");
    this.confirm.type = "button";
    this.confirm.textContent = "确认";

    const actions = el("footer", "qav-actions");
    actions.append(this.replace, this.reset, this.cancel, this.confirm);
    panel.append(header, this.editor, controls, actions);
    this.dialog.append(panel);
    document.body.append(this.dialog);

    root.append(this.el);
    this.bind();
    if (opts.initialUrl) this.setImageUrl(opts.initialUrl, false);
    this.syncEditorState();
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog.hidden = false;
    this.onOpenChange?.(true);
    this.replace.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.dialog.hidden = true;
    this.onOpenChange?.(false);
    this.lastFocus?.focus();
  }

  setImageUrl(url: string, updateTrigger = true): void {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      this.image = img;
      this.resetEditing();
      if (updateTrigger) {
        this.preview.src = url;
        this.preview.hidden = false;
        this.fallback.hidden = true;
      }
    };
    img.src = url;
  }

  destroy(): void {
    this.close();
    document.removeEventListener("keydown", this.onKeyDown);
    this.dialog.remove();
    this.el.remove();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  private createCloseButton(): HTMLButtonElement {
    const btn = el("button", "qav-close");
    btn.type = "button";
    btn.setAttribute("aria-label", "关闭");
    btn.innerHTML = ICON_CLOSE;
    btn.addEventListener("click", () => this.close());
    return btn;
  }

  private iconButton(label: string, icon: string): HTMLButtonElement {
    const btn = el("button", "qav-icon-btn", icon);
    btn.type = "button";
    btn.setAttribute("aria-label", label);
    return btn;
  }

  private range(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
  ): HTMLInputElement {
    const input = el("input", "qav-range");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute("aria-label", label);
    return input;
  }

  private row(label: string, control: HTMLElement): HTMLElement {
    const row = el("div", "qav-control");
    row.append(el("span", "qav-control-label", label), control);
    return row;
  }

  private bind(): void {
    this.trigger.addEventListener("click", () => this.open());
    this.editor.addEventListener("click", () => {
      if (!this.image) this.fileInput.click();
    });
    this.editor.addEventListener("dragover", (event) => {
      event.preventDefault();
      this.editor.classList.add("is-dragover");
    });
    this.editor.addEventListener("dragleave", () => this.editor.classList.remove("is-dragover"));
    this.editor.addEventListener("drop", (event) => {
      event.preventDefault();
      this.editor.classList.remove("is-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (file) void this.loadFile(file);
    });
    this.fileInput.addEventListener("change", () => {
      const file = this.fileInput.files?.[0];
      if (file) void this.loadFile(file);
      this.fileInput.value = "";
    });
    this.replace.addEventListener("click", () => this.fileInput.click());
    this.reset.addEventListener("click", () => this.resetEditing());
    this.cancel.addEventListener("click", () => this.close());
    this.confirm.addEventListener("click", () => void this.confirmEditing());
    this.rotateLeft.addEventListener("click", () => this.rotate(-90));
    this.rotateRight.addEventListener("click", () => this.rotate(90));
    this.zoomInput.addEventListener("input", () => {
      this.zoom = Number(this.zoomInput.value);
      this.clampOffset();
      this.render();
    });
    this.radiusInput.addEventListener("input", () => {
      this.radius = Number(this.radiusInput.value);
      this.render();
    });
    this.dialog.addEventListener("pointerdown", (event) => {
      if (event.target === this.dialog) this.close();
    });
    document.addEventListener("keydown", this.onKeyDown);
    this.editor.addEventListener("pointerdown", this.onEditorPointerDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen) return;

    if (event.key === "Escape") {
      event.stopPropagation();
      this.close();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = [...this.dialog.querySelectorAll<HTMLElement>("button, input")].filter(
      (node) => !node.hasAttribute("disabled"),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    const active = document.activeElement;
    if (event.shiftKey && (active === first || !this.dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !this.dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  private readonly onEditorPointerDown = (event: PointerEvent): void => {
    if (!this.image || event.button !== 0) return;
    event.preventDefault();
    this.editor.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY, ox: this.offset.x, oy: this.offset.y };

    const move = (e: PointerEvent): void => {
      const scale = this.outputSize / (this.canvas.clientWidth || this.outputSize);
      this.offset = {
        x: start.ox + (e.clientX - start.x) * scale,
        y: start.oy + (e.clientY - start.y) * scale,
      };
      this.clampOffset();
      this.render();
    };
    const up = (): void => {
      this.editor.removeEventListener("pointermove", move);
      this.editor.removeEventListener("pointerup", up);
      this.editor.removeEventListener("pointercancel", up);
    };
    this.editor.addEventListener("pointermove", move);
    this.editor.addEventListener("pointerup", up);
    this.editor.addEventListener("pointercancel", up);
  };

  private async loadFile(file: File): Promise<void> {
    if (!file.type.startsWith("image/")) return;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.setImageUrl(this.objectUrl);
  }

  private minScale(width: number, height: number, angle: number): number {
    const rad = angle * DEG;
    const c = Math.abs(Math.cos(rad));
    const s = Math.abs(Math.sin(rad));
    const projectedWidth = width * c + height * s;
    const projectedHeight = width * s + height * c;
    return Math.max(this.outputSize / projectedWidth, this.outputSize / projectedHeight);
  }

  private rotate(delta: number): void {
    this.angle = (this.angle + delta + 360) % 360;
    this.offset = { x: 0, y: 0 };
    this.clampOffset();
    this.render();
  }

  private resetEditing(): void {
    this.angle = 0;
    this.zoom = 1;
    this.radius = this.defaultRadius;
    this.zoomInput.value = "1";
    this.radiusInput.value = String(this.radius);
    this.offset = { x: 0, y: 0 };
    this.render();
    this.syncEditorState();
  }

  private clampOffset(): void {
    let maxX = this.outputSize / 2;
    let maxY = this.outputSize / 2;
    if (this.image) {
      const rad = this.angle * DEG;
      const c = Math.abs(Math.cos(rad));
      const s = Math.abs(Math.sin(rad));
      const width = this.image.naturalWidth * c + this.image.naturalHeight * s;
      const height = this.image.naturalWidth * s + this.image.naturalHeight * c;
      const scale =
        this.minScale(this.image.naturalWidth, this.image.naturalHeight, this.angle) * this.zoom;
      maxX = Math.max(0, (width * scale - this.outputSize) / 2);
      maxY = Math.max(0, (height * scale - this.outputSize) / 2);
    }
    this.offset.x = Math.max(-maxX, Math.min(maxX, this.offset.x));
    this.offset.y = Math.max(-maxY, Math.min(maxY, this.offset.y));
  }

  private draw(ctx: CanvasRenderingContext2D, guide = true): void {
    ctx.clearRect(0, 0, this.outputSize, this.outputSize);
    // 圆角外区域底色：jpeg 必须铺底（否则透明变黑）；png 显式传底色时同样生效
    if (this.backgroundColor) {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, this.outputSize, this.outputSize);
    }
    const r = (this.radius / 100) * this.outputSize;
    ctx.save();
    roundRect(ctx, this.outputSize, r);
    ctx.clip();
    if (this.image) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(this.outputSize / 2 + this.offset.x, this.outputSize / 2 + this.offset.y);
      ctx.rotate(this.angle * DEG);
      const scale =
        this.minScale(this.image.naturalWidth, this.image.naturalHeight, this.angle) * this.zoom;
      ctx.scale(scale, scale);
      ctx.drawImage(this.image, -this.image.naturalWidth / 2, -this.image.naturalHeight / 2);
    }
    ctx.restore();

    // 编辑辅助边框只显示在画布上，不进入导出结果。
    if (!guide) return;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(30,96,90,.35)";
    roundRect(ctx, this.outputSize, r);
    ctx.stroke();
  }

  private render(): void {
    const ctx = this.canvas.getContext("2d");
    if (ctx) this.draw(ctx);
    this.syncEditorState();
  }

  private syncEditorState(): void {
    this.empty.hidden = this.image != null;
    for (const control of [
      this.zoomInput,
      this.radiusInput,
      this.rotateLeft,
      this.rotateRight,
      this.reset,
    ]) {
      (control as HTMLButtonElement | HTMLInputElement).disabled = this.image == null;
    }
    this.confirm.disabled = this.image == null;
  }

  private async confirmEditing(): Promise<void> {
    if (!this.image) return;
    const canvas = document.createElement("canvas");
    canvas.width = this.outputSize;
    canvas.height = this.outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.draw(ctx);

    const mime = this.outputFormat === "jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, this.quality));
    if (!blob) return;
    const dataUrl = canvas.toDataURL(mime, this.quality);

    this.preview.src = dataUrl;
    this.preview.hidden = false;
    this.fallback.hidden = true;
    this.onConfirm?.({
      blob,
      dataUrl,
      width: this.outputSize,
      height: this.outputSize,
      radius: (this.radius / 100) * this.outputSize,
    });
    this.close();
  }
}
