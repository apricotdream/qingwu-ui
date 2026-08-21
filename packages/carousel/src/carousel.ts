import type { CarouselItem, CarouselOptions } from "./types";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHTML(value: string): string {
  return value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
}

function itemValue(item: CarouselItem, index: number): string {
  return item.value ?? String(index);
}

function button(className: string, label: string): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.setAttribute("aria-label", label);
  return node;
}

function lineTag(
  tag: "div" | "h3" | "p" | "a" | "span",
  className: string,
  step: number,
): HTMLElement {
  const node = document.createElement(tag);
  node.className = `qcar-line ${className}`.trim();
  node.style.setProperty("--qcar-step", String(step));
  return node;
}

export class Carousel {
  private root: HTMLElement;
  private items: CarouselItem[];
  private readonly controlled: boolean;
  private readonly className: string;
  private interval: number;
  private speed: number;
  private loop: boolean;
  private showArrows: boolean;
  private showThumbs: boolean;
  private readonly onChange?: (value: string, item: CarouselItem, index: number) => void;
  private autoplayRequested: boolean;
  private index = 0;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;
  private swiping = false;
  private swipeStartX = 0;
  private swipeStartY = 0;

  private readonly onSwipeStart = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") return;
    this.swiping = true;
    this.swipeStartX = event.clientX;
    this.swipeStartY = event.clientY;
  };

  private readonly onSwipeEnd = (event: PointerEvent): void => {
    if (!this.swiping) return;
    this.swiping = false;
    const deltaX = event.clientX - this.swipeStartX;
    const deltaY = event.clientY - this.swipeStartY;
    if (Math.abs(deltaX) < 48) return;
    /* 纵向分量拒绝：斜滑只让页面原生滚动、不切卡，避免「图也换、页也跳」双重动作 */
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) this.next();
    else this.prev();
  };

  private readonly onSwipeCancel = (): void => {
    this.swiping = false;
  };

  private visual!: HTMLElement;
  private background!: HTMLDivElement;
  private figure!: HTMLImageElement;
  private copy!: HTMLElement;
  private thumbs!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;

  constructor(root: HTMLElement, opts: CarouselOptions = {}) {
    this.root = root;
    this.items = opts.items ?? [];
    this.controlled = "value" in opts;
    this.className = opts.className ?? "";
    this.interval = opts.interval ?? 4200;
    this.speed = opts.speed ?? 1;
    this.loop = opts.loop !== false;
    this.showArrows = opts.showArrows !== false;
    this.showThumbs = opts.showThumbs !== false;
    this.onChange = opts.onChange;
    this.autoplayRequested = opts.autoplay === true;

    const initialValue = opts.value ?? opts.defaultValue ?? null;
    this.index = this.findIndex(initialValue);
    this.build(opts.ariaLabel ?? "轮播图");
    this.render();
    this.scheduleAuto(true);
  }

  get value(): string | null {
    const item = this.items[this.index];
    return item ? itemValue(item, this.index) : null;
  }

  get currentIndex(): number {
    return this.index;
  }

  next(): void {
    this.goTo(this.index + 1);
  }

  prev(): void {
    this.goTo(this.index - 1);
  }

  goTo(nextIndex: number): void {
    if (this.items.length === 0) return;
    const target = this.normalizeIndex(nextIndex);
    if (target === this.index) return;
    const targetItem = this.items[target];
    if (!targetItem) return;
    this.onChange?.(itemValue(targetItem, target), targetItem, target);
    if (this.controlled) return;
    this.index = target;
    this.render();
    this.scheduleAuto(true);
  }

  update(patch: Partial<CarouselOptions>): void {
    if (patch.items) {
      this.items = patch.items;
      if (this.index >= this.items.length) this.index = 0;
    }
    if ("value" in patch) this.index = this.findIndex(patch.value ?? null);
    if (patch.autoplay != null) this.autoplayRequested = patch.autoplay;
    if (patch.interval != null) this.interval = patch.interval;
    if (patch.speed != null) this.speed = patch.speed;
    if (patch.loop != null) this.loop = patch.loop;
    if (patch.showArrows != null) this.showArrows = patch.showArrows;
    if (patch.showThumbs != null) this.showThumbs = patch.showThumbs;
    this.syncChrome();
    this.render();
    this.scheduleAuto(true);
  }

  start(): void {
    this.paused = false;
    this.scheduleAuto(true);
  }

  stop(): void {
    this.paused = true;
    this.clearAuto();
  }

  destroy(): void {
    this.clearAuto();
    this.root.onkeydown = null;
    this.root.onpointerenter = null;
    this.root.onpointerleave = null;
    this.visual.removeEventListener("pointerdown", this.onSwipeStart);
    this.visual.removeEventListener("pointerup", this.onSwipeEnd);
    this.visual.removeEventListener("pointercancel", this.onSwipeCancel);
    this.root.replaceChildren();
    this.root.className = this.root.className
      .split(" ")
      .filter((name) => name && name !== "qcar" && name !== this.className)
      .join(" ");
  }

  private build(ariaLabel: string): void {
    this.root.classList.add("qcar");
    if (this.className) this.root.classList.add(this.className);
    this.root.tabIndex = 0;
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-roledescription", "carousel");
    this.root.setAttribute("aria-label", ariaLabel);
    this.root.onkeydown = (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.prev();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.next();
      }
    };
    this.root.onpointerenter = () => this.stop();
    this.root.onpointerleave = () => this.start();

    this.visual = document.createElement("div");
    this.visual.className = "qcar-visual";

    this.background = document.createElement("div");
    this.background.className = "qcar-bg";
    this.background.setAttribute("aria-hidden", "true");

    const figureWrap = document.createElement("div");
    figureWrap.className = "qcar-figure-wrap";
    this.figure = document.createElement("img");
    this.figure.className = "qcar-figure";
    this.figure.loading = "lazy";
    this.figure.decoding = "async";
    figureWrap.append(this.figure);

    this.visual.append(this.background, figureWrap);

    /* 触屏横滑切换：touch-action: pan-y 保证纵向滚动不被劫持，横向滑动交给手势；
       阈值 48px 过滤点按，鼠标拖拽不启用（桌面走箭头/键盘） */
    this.visual.style.touchAction = "pan-y";
    this.visual.addEventListener("pointerdown", this.onSwipeStart);
    this.visual.addEventListener("pointerup", this.onSwipeEnd);
    this.visual.addEventListener("pointercancel", this.onSwipeCancel);

    this.copy = document.createElement("div");
    this.copy.className = "qcar-copy";

    this.prevBtn = button("qcar-arrow qcar-prev", "上一张");
    this.prevBtn.innerHTML = "‹";
    this.prevBtn.addEventListener("click", () => this.prev());
    this.nextBtn = button("qcar-arrow qcar-next", "下一张");
    this.nextBtn.innerHTML = "›";
    this.nextBtn.addEventListener("click", () => this.next());

    this.root.append(this.visual, this.copy);

    this.thumbs = document.createElement("div");
    this.thumbs.className = "qcar-thumbs";
    this.thumbs.setAttribute("role", "tablist");
    this.thumbs.setAttribute("aria-label", "轮播图缩略图");

    this.syncChrome();
  }

  /** 按 showArrows/showThumbs 增删箭头与缩略图；仅显隐变化时动，避免 update() 重放入场动画 */
  private syncChrome(): void {
    const hasArrows = this.prevBtn.isConnected;
    const hasThumbs = this.thumbs.isConnected;
    if (this.showArrows && !hasArrows) this.visual.append(this.prevBtn, this.nextBtn);
    else if (!this.showArrows && hasArrows) {
      this.prevBtn.remove();
      this.nextBtn.remove();
    }
    if (this.showThumbs && !hasThumbs) this.root.append(this.thumbs);
    else if (!this.showThumbs && hasThumbs) this.thumbs.remove();
  }

  private render(): void {
    const item = this.items[this.index];
    this.root.classList.toggle("is-empty", !item);
    this.replayIntro();

    if (!item) {
      this.background.style.removeProperty("--qcar-bg-image");
      this.figure.removeAttribute("src");
      this.figure.alt = "";
      this.copy.replaceChildren();
      this.copy.append(this.emptyState());
      this.thumbs.replaceChildren();
      this.clearAuto();
      return;
    }

    this.background.style.setProperty(
      "--qcar-bg-image",
      item.background ? `url("${item.background}")` : "none",
    );
    this.figure.src = item.image;
    this.figure.alt = item.alt ?? item.title;
    this.copy.replaceChildren(...this.buildCopy(item));
    this.renderThumbs();
    this.prevBtn.disabled = !this.loop && this.index === 0;
    this.nextBtn.disabled = !this.loop && this.index === this.items.length - 1;
    this.scheduleAuto();
  }

  private buildCopy(item: CarouselItem): HTMLElement[] {
    const nodes: HTMLElement[] = [];
    let step = 0;

    if (item.eyebrow) {
      const eyebrow = lineTag("div", "qcar-eyebrow", step++);
      eyebrow.textContent = item.eyebrow;
      nodes.push(eyebrow);
    }

    const title = lineTag("h3", "qcar-title", step++);
    title.textContent = item.title;
    nodes.push(title);

    if (item.subtitle) {
      const subtitle = lineTag("div", "qcar-subtitle", step++);
      subtitle.textContent = item.subtitle;
      nodes.push(subtitle);
    }

    const slash = lineTag("span", "qcar-slash", step++);
    slash.setAttribute("aria-hidden", "true");
    nodes.push(slash);

    if (item.description) {
      const desc = lineTag("p", "qcar-desc", step++);
      desc.textContent = item.description;
      nodes.push(desc);
    }

    if (item.href) {
      const link = lineTag("a", "qcar-link", step++) as HTMLAnchorElement;
      link.href = item.href;
      link.textContent = item.linkLabel ?? "查看详情";
      nodes.push(link);
    }

    return nodes;
  }

  private renderThumbs(): void {
    const nodes = this.items.map((item, index) => {
      const thumb = button("qcar-thumb", `切换到 ${item.title}`);
      thumb.setAttribute("role", "tab");
      thumb.setAttribute("aria-selected", String(index === this.index));
      thumb.classList.toggle("is-active", index === this.index);
      thumb.innerHTML = `<img src="${escapeHTML(item.thumbnail ?? item.image)}" alt="" />`;
      thumb.addEventListener("click", () => this.goTo(index));
      return thumb;
    });
    this.thumbs.replaceChildren(...nodes);
  }

  private emptyState(): HTMLElement {
    const node = document.createElement("div");
    node.className = "qcar-empty";
    node.textContent = "暂无轮播内容";
    return node;
  }

  private findIndex(value: string | null): number {
    if (!value) return 0;
    const index = this.items.findIndex((item, itemIndex) => itemValue(item, itemIndex) === value);
    return index < 0 ? 0 : index;
  }

  private normalizeIndex(nextIndex: number): number {
    if (this.loop) return (nextIndex + this.items.length) % this.items.length;
    return Math.min(Math.max(nextIndex, 0), this.items.length - 1);
  }

  /** 实际播放间隔：interval / speed，下限 250ms 防闪 */
  private effectiveDelay(): number {
    const safeSpeed = this.speed > 0 ? this.speed : 1;
    return Math.max(this.interval / safeSpeed, 250);
  }

  private scheduleAuto(force = false): void {
    if (this.autoTimer && !force) return;
    this.clearAuto();
    if (!this.autoplayRequested || this.paused || this.items.length <= 1) return;
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      if (!this.autoplayRequested || this.paused || this.items.length <= 1) return;
      const nextIndex = this.normalizeIndex(this.index + 1);
      if (nextIndex !== this.index) {
        this.index = nextIndex;
        this.render();
        this.scheduleAuto(true);
      } else {
        this.scheduleAuto(true);
      }
    }, this.effectiveDelay());
  }

  private clearAuto(): void {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  private replayIntro(): void {
    this.root.classList.remove("is-enter");
    void this.root.offsetWidth;
    this.root.classList.add("is-enter");
  }
}
