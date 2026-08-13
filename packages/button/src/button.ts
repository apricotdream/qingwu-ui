/**
 * Button 组件 —— 青梧UI 通用按钮
 * 零框架依赖，纯 DOM + CSS
 *
 * 使用方式：
 * ```ts
 * import { Button } from "@apricotdream/button";
 * import "@apricotdream/button/style.css";
 *
 * const btn = new Button({ text: "确认", variant: "primary" });
 * container.append(btn.el);
 * ```
 */

export type ButtonVariant = "default" | "primary" | "amber" | "icon";

export interface ButtonOptions {
  text?: string;
  variant?: ButtonVariant;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export class Button {
  readonly el: HTMLButtonElement;
  private _text: string;
  private _variant: ButtonVariant;
  private _onClick?: () => void;

  constructor(opts: ButtonOptions = {}) {
    this._text = opts.text ?? "";
    this._variant = opts.variant ?? "default";
    this._onClick = opts.onClick;

    this.el = document.createElement("button");
    this.el.type = opts.type ?? "button";
    this.el.className = `qw-btn qw-btn-${this._variant}`;
    this.el.textContent = this._text;
    if (opts.disabled) this.el.disabled = true;

    if (this._onClick) {
      this.el.addEventListener("click", this._onClick);
    }
  }

  get text(): string {
    return this._text;
  }

  set text(val: string) {
    this._text = val;
    this.el.textContent = val;
  }

  get variant(): ButtonVariant {
    return this._variant;
  }

  set variant(val: ButtonVariant) {
    this.el.classList.remove(`qw-btn-${this._variant}`);
    this._variant = val;
    this.el.classList.add(`qw-btn-${this._variant}`);
  }

  get disabled(): boolean {
    return this.el.disabled;
  }

  set disabled(val: boolean) {
    this.el.disabled = val;
  }

  /** 销毁，释放事件监听 */
  destroy(): void {
    if (this._onClick) {
      this.el.removeEventListener("click", this._onClick);
    }
    this.el.remove();
  }
}
