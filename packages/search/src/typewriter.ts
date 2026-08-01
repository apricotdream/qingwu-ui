/* ============================================================
   打字机轮播引擎（Typewriter）
   - 逐字打入 → 全文停顿 → 逐字删除 → 空文停顿 → 下一条
   - reduced 模式退化为静态首条，零定时器
   - 通过 destroy() 确保无泄漏
   ============================================================ */

import type { TypewriterOptions } from "./types";

export class Typewriter {
  private target: HTMLElement;
  private words: string[];
  private reduced: boolean;
  private typeMs: number;
  private delMs: number;
  private holdFull: number;
  private holdEmpty: number;
  private i: number;
  private n: number;
  private phase: "typing" | "hold" | "deleting";
  private timer: ReturnType<typeof setTimeout> | null;
  private running: boolean;

  constructor(target: HTMLElement, words: string[], opts: TypewriterOptions = {}) {
    this.target = target;
    this.words = words.length ? words : [""];
    this.reduced = opts.reduced ?? false;
    this.typeMs = opts.typeMs ?? 80;
    this.delMs = opts.delMs ?? 38;
    this.holdFull = opts.holdFull ?? 1500;
    this.holdEmpty = opts.holdEmpty ?? 320;
    this.i = 0;
    this.n = 0;
    this.phase = "typing";
    this.timer = null;
    this.running = false;
  }

  /** 启动轮播（幂等） */
  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.reduced) {
      this.target.textContent = this.words[0] ?? "";
      return;
    }
    this.schedule(0);
  }

  /** 暂停轮播 */
  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** 销毁实例，清理所有定时器 */
  destroy(): void {
    this.stop();
  }

  private schedule(ms: number): void {
    this.timer = setTimeout(() => {
      this.tick();
    }, ms);
  }

  private render(): void {
    this.target.textContent = (this.words[this.i] ?? "").slice(0, this.n);
  }

  private tick(): void {
    if (!this.running) return;
    const word = this.words[this.i] ?? "";
    if (this.phase === "typing") {
      if (this.n < word.length) {
        this.n++;
        this.render();
        this.schedule(this.typeMs + Math.random() * 55);
      } else {
        this.phase = "hold";
        this.schedule(this.holdFull);
      }
    } else if (this.phase === "hold") {
      this.phase = "deleting";
      this.schedule(0);
    } else {
      if (this.n > 0) {
        this.n--;
        this.render();
        this.schedule(this.delMs);
      } else {
        this.phase = "typing";
        this.i = (this.i + 1) % this.words.length;
        this.schedule(this.holdEmpty);
      }
    }
  }
}
