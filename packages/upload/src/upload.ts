/* ============================================================
   青梧UI · 图片上传组件（ImageUpload）
   - 拖拽/点击选择，多文件 + 数量限制
   - 客户端压缩：原图 / webp / avif 多份产出，格式按配置三选一
   - avif 不可编码时自动降级 webp → png
   - 每个上传项独立进度条（内置 XHR 真实进度，或自定义 uploadFn）
   - 零框架依赖，纯 DOM + CSS
   ============================================================ */

import { Button } from "@qingwu/button";
import { compressImage, detectEncodeMimes } from "./compress";
import type { CompressedFile, OutputFormat, UploadItem, UploadOptions } from "./types";

const FORMAT_LABEL: Record<OutputFormat, string> = {
  original: "原图",
  webp: "WebP",
  avif: "AVIF",
};

/** 扩展名 → MIME 映射（supportedFormats 白名单专用） */
const FORMAT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function matchesAccept(file: File, accept: string[]): boolean {
  return accept.some((a) => {
    const mime = a.trim().toLowerCase();
    if (!mime) return false;
    if (mime.endsWith("/*")) {
      const prefix = mime.slice(0, mime.length - 1);
      return file.type.toLowerCase().startsWith(prefix);
    }
    return file.type.toLowerCase() === mime;
  });
}

export type FileRejectReason = "type" | "size" | "count";

/** 文件准入校验：类型 / 大小 / 数量上限。通过返回 null */
export function validateFile(
  file: File,
  accept: string[],
  maxSizeMB: number,
  currentCount: number,
  maxCount: number,
): FileRejectReason | null {
  if (!matchesAccept(file, accept)) return "type";
  if (file.size > maxSizeMB * 1024 * 1024) return "size";
  if (maxCount > 0 && currentCount >= maxCount) return "count";
  return null;
}

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `qu-${Date.now().toString(36)}-${idSeq}`;
}

import { ICO_UPLOAD } from "../../../icon/icons";

export class ImageUpload {
  /** 根容器 */
  el!: HTMLElement;

  private opts: Required<
    Pick<
      UploadOptions,
      | "trigger"
      | "accept"
      | "supportedFormats"
      | "multiple"
      | "maxCount"
      | "maxSizeMB"
      | "fieldName"
      | "compress"
      | "formats"
      | "quality"
      | "maxWidth"
      | "maxHeight"
    >
  >;
  /** 生效的 accept：显式 accept > supportedFormats 映射 > ["image/*"] */
  private readonly accept: string[];
  private url?: string;
  private headers: Record<string, string>;
  private uploadFn?: (file: File, onProgress: (p: number) => void) => Promise<void>;
  private onStart?: UploadOptions["onStart"];
  private onProgress?: UploadOptions["onProgress"];
  private onSuccess?: UploadOptions["onSuccess"];
  private onError?: UploadOptions["onError"];
  private onChange?: UploadOptions["onChange"];

  private items: UploadItem[] = [];
  private readonly xhrs = new Map<string, XMLHttpRequest>();
  private previewUrls = new Set<string>();
  private encodable: ReadonlySet<string> | null = null;

  private dropzone!: HTMLElement;
  private btn: Button | null = null;
  private hint!: HTMLElement;
  private list!: HTMLElement;
  private input!: HTMLInputElement;

  constructor(root: HTMLElement, opts: UploadOptions = {}) {
    this.opts = {
      trigger: opts.trigger ?? "dropzone",
      accept: opts.accept?.length ? opts.accept : [],
      supportedFormats: opts.supportedFormats?.length ? opts.supportedFormats : [],
      multiple: opts.multiple ?? true,
      maxCount: opts.maxCount ?? 0,
      maxSizeMB: opts.maxSizeMB ?? 10,
      fieldName: opts.fieldName ?? "file",
      compress: opts.compress ?? true,
      formats: opts.formats?.length ? opts.formats : ["original", "webp", "avif"],
      quality: opts.quality ?? 0.8,
      maxWidth: opts.maxWidth ?? 2048,
      maxHeight: opts.maxHeight ?? 2048,
    };
    this.accept = this.opts.accept.length
      ? this.opts.accept
      : this.opts.supportedFormats.length
        ? this.opts.supportedFormats.map((f) => {
            const ext = f.toLowerCase();
            return FORMAT_MIME[ext] ?? `image/${ext}`;
          })
        : ["image/*"];
    this.url = opts.url;
    this.headers = opts.headers ?? {};
    this.uploadFn = opts.uploadFn;
    this.onStart = opts.onStart;
    this.onProgress = opts.onProgress;
    this.onSuccess = opts.onSuccess;
    this.onError = opts.onError;
    this.onChange = opts.onChange;

    this.build();
    this.bind();
    root.append(this.el);

    // 预热格式编码探测（压缩开启时），避免首个文件等待
    if (this.opts.compress) {
      void detectEncodeMimes().then((s) => {
        this.encodable = s;
      });
    }
  }

  /* ============================================================
     Build / Bind
     ============================================================ */
  private build(): void {
    this.el = el("div", "qw-upload");

    this.input = document.createElement("input");
    this.input.type = "file";
    this.input.accept = this.accept.join(",");
    this.input.multiple = this.opts.multiple;
    this.input.hidden = true;

    if (this.opts.trigger === "button") {
      /* 按钮变体：复用 @qingwu/button 样式，点击打开文件选择 */
      this.btn = new Button({
        text: "选择图片",
        variant: "primary",
        onClick: () => this.input.click(),
      });
      this.el.append(this.btn.el, this.input);
    } else {
      this.dropzone = el("div", "qw-upload-dropzone");
      this.dropzone.setAttribute("role", "button");
      this.dropzone.setAttribute("tabindex", "0");
      this.dropzone.setAttribute("aria-label", "选择或拖拽图片上传");

      const hintText = this.opts.maxCount > 0 ? `最多 ${this.opts.maxCount} 张 · ` : "";
      const fmtHint = this.opts.supportedFormats.length
        ? this.opts.supportedFormats.map((f) => f.toUpperCase()).join("/")
        : "JPG/PNG/WebP/GIF/AVIF";
      this.dropzone.innerHTML =
        `<span class="qw-upload-ico">${ICO_UPLOAD}</span>` +
        `<span class="qw-upload-main">拖拽图片到此处，或 <em>点击选择</em></span>` +
        `<span class="qw-upload-sub">${hintText}单张 ≤ ${this.opts.maxSizeMB} MB · 支持 ${fmtHint}</span>`;
      this.dropzone.append(this.input);
      this.el.append(this.dropzone);
    }

    this.hint = el("div", "qw-upload-hint");
    this.hint.hidden = true;

    this.list = el("div", "qw-upload-list");
    this.list.hidden = true;

    this.el.append(this.hint, this.list);
  }

  private bind(): void {
    this.input.addEventListener("change", () => {
      this.addFiles(Array.from(this.input.files ?? []));
      this.input.value = "";
    });

    /* 拖拽（仅拖拽区形态） */
    this.dropzone?.addEventListener("click", () => this.input.click());
    this.dropzone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.input.click();
      }
    });
    this.dropzone?.addEventListener("dragenter", (e) => {
      e.preventDefault();
      this.dropzone.classList.add("is-drag");
    });
    this.dropzone?.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    this.dropzone?.addEventListener("dragleave", (e) => {
      // 移入内部子元素也会触发 dragleave，仅当真正离开拖拽区时取消高亮
      const related = e.relatedTarget as Node | null;
      if (related && this.dropzone.contains(related)) return;
      this.dropzone.classList.remove("is-drag");
    });
    this.dropzone?.addEventListener("drop", (e) => {
      e.preventDefault();
      this.dropzone.classList.remove("is-drag");
      this.addFiles(Array.from(e.dataTransfer?.files ?? []));
    });

    /* 列表事件委托：删除按钮 */
    this.list.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".qw-upload-remove");
      if (btn?.dataset.id) this.remove(btn.dataset.id);
    });
  }

  /* ============================================================
     文件接入
     ============================================================ */
  private setHint(msg: string): void {
    this.hint.textContent = msg;
    this.hint.hidden = false;
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => {
      this.hint.hidden = true;
    }, 3000);
  }
  private hintTimer: number | undefined;

  private addFiles(files: File[]): void {
    let rejected = 0;
    for (const file of files) {
      const reason = validateFile(
        file,
        this.accept,
        this.opts.maxSizeMB,
        this.items.length,
        this.opts.maxCount,
      );
      if (reason) {
        rejected += 1;
        continue;
      }
      void this.ingest(file);
    }
    if (rejected > 0) this.setHint(`${rejected} 个文件被拒绝：类型/大小不符或已达数量上限`);
  }

  /** 压缩 → 生成上传项 → 开始上传 */
  private async ingest(file: File): Promise<void> {
    const preview = URL.createObjectURL(file);
    this.previewUrls.add(preview);
    const name = file.name;
    const originalSize = file.size;
    const pending: UploadItem[] = [];

    // 默认按原图上传一份；压缩开启时尝试产出多份
    let outputs: CompressedFile[] = [];
    let skipReason = false;
    if (this.opts.compress) {
      const supported = this.encodable ?? (await detectEncodeMimes());
      this.encodable = supported;
      try {
        outputs = await compressImage(
          file,
          this.opts.formats,
          {
            quality: this.opts.quality,
            maxWidth: this.opts.maxWidth,
            maxHeight: this.opts.maxHeight,
          },
          supported,
        );
      } catch {
        skipReason = true;
      }
    }

    const base: Omit<UploadItem, "format" | "file" | "name" | "mime" | "size"> = {
      id: "",
      originalSize,
      status: "pending",
      progress: 0,
      preview,
    };

    if (outputs.length === 0) {
      pending.push({
        ...base,
        id: nextId(),
        file,
        name,
        mime: file.type,
        size: originalSize,
        format: "original",
        skipped: !this.opts.compress || skipReason,
      });
    } else {
      if (this.opts.formats.includes("original")) {
        pending.push({
          ...base,
          id: nextId(),
          file,
          name,
          mime: file.type,
          size: originalSize,
          format: "original",
        });
      }
      for (const out of outputs) {
        pending.push({
          ...base,
          id: nextId(),
          file: out.blob,
          name: out.blob.name,
          mime: out.mime,
          size: out.blob.size,
          format: out.format,
        });
      }
    }

    this.items.push(...pending);
    this.renderList();
    this.emitChange();
    for (const item of pending) void this.upload(item);
  }

  /* ============================================================
     上传
     ============================================================ */
  private async upload(item: UploadItem): Promise<void> {
    this.setStatus(item, "uploading");
    item.progress = 0;
    this.onStart?.(item);

    try {
      if (this.uploadFn) {
        await this.uploadFn(item.file, (p) => {
          item.progress = p;
          this.renderItem(item);
          this.onProgress?.(item);
        });
      } else if (this.url) {
        await this.uploadXHR(item);
      }
      // 无 url 也无 uploadFn：仅压缩/选择模式，直接视为成功
      this.setStatus(item, "success");
      item.progress = 100;
      this.renderItem(item);
      this.onSuccess?.(item);
      this.emitChange();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (e.name === "AbortError") return; // 主动移除，不报错
      item.error = e.message;
      this.setStatus(item, "error");
      this.renderItem(item);
      this.onError?.(item, e);
      this.emitChange();
    }
  }

  private uploadXHR(item: UploadItem): Promise<void> {
    const url = this.url;
    if (!url) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.xhrs.set(item.id, xhr);
      xhr.open("POST", url);
      for (const [k, v] of Object.entries(this.headers)) xhr.setRequestHeader(k, v);
      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        item.progress = Math.round((e.loaded / e.total) * 100);
        this.renderItem(item);
        this.onProgress?.(item);
      });
      xhr.addEventListener("load", () => {
        this.xhrs.delete(item.id);
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`HTTP ${xhr.status}`));
      });
      xhr.addEventListener("error", () => {
        this.xhrs.delete(item.id);
        reject(new Error("网络错误"));
      });
      xhr.addEventListener("abort", () => {
        this.xhrs.delete(item.id);
        reject(new DOMException("上传已取消", "AbortError"));
      });
      const fd = new FormData();
      fd.append(this.opts.fieldName, item.file, item.file.name);
      xhr.send(fd);
    });
  }

  /* ============================================================
     渲染
     ============================================================ */
  private setStatus(item: UploadItem, status: UploadItem["status"]): void {
    item.status = status;
  }

  private renderList(): void {
    this.list.hidden = this.items.length === 0;
    this.list.textContent = "";
    const frag = document.createDocumentFragment();
    for (const item of this.items) frag.append(this.buildItem(item));
    this.list.append(frag);
  }

  private buildItem(item: UploadItem): HTMLElement {
    const row = el("div", "qw-upload-item");
    row.dataset.id = item.id;

    const thumb = el("div", "qw-upload-thumb");
    const img = document.createElement("img");
    img.src = item.preview ?? "";
    img.alt = "";
    thumb.append(img);

    const info = el("div", "qw-upload-info");
    const head = el("div", "qw-upload-head");
    const name = el("span", "qw-upload-name", escapeHTML(item.name));
    const tag = el(
      "span",
      "qw-upload-tag",
      `${FORMAT_LABEL[item.format]}${item.skipped ? " · 不压缩" : ""}`,
    );
    head.append(name, tag);

    const sizeText =
      item.originalSize !== item.size
        ? `${formatBytes(item.originalSize)} → ${formatBytes(item.size)}`
        : formatBytes(item.size);
    const meta = el("span", "qw-upload-meta");
    meta.textContent = sizeText;

    const bar = el("div", "qw-upload-progress");
    const barFill = el("div", "qw-upload-bar");
    bar.append(barFill);

    const status = el("span", "qw-upload-status");
    info.append(head, meta, bar, status);

    const removeBtn = el("button", "qw-upload-remove", "✕") as HTMLButtonElement;
    removeBtn.type = "button";
    removeBtn.dataset.id = item.id;
    removeBtn.setAttribute("aria-label", `移除 ${item.name}`);
    removeBtn.title = "移除";

    row.append(thumb, info, removeBtn);
    this.updateItemDom(row, item);
    return row;
  }

  private updateItemDom(row: HTMLElement, item: UploadItem): void {
    row.className = `qw-upload-item is-${item.status}`;
    const fill = row.querySelector<HTMLElement>(".qw-upload-bar");
    if (fill) fill.style.width = `${item.progress}%`;
    const status = row.querySelector<HTMLElement>(".qw-upload-status");
    if (!status) return;
    if (item.status === "uploading") {
      status.textContent = `${item.progress}%`;
    } else if (item.status === "success") {
      status.textContent = "✓ 完成";
    } else if (item.status === "error") {
      status.textContent = `✕ ${item.error ?? "失败"}`;
    } else {
      status.textContent = "等待…";
    }
  }

  private renderItem(item: UploadItem): void {
    const row = this.list.querySelector<HTMLElement>(`[data-id="${item.id}"]`);
    if (row) this.updateItemDom(row, item);
  }

  /* ============================================================
     Public API
     ============================================================ */

  getItems(): UploadItem[] {
    return [...this.items];
  }

  /** 移除一个上传项（上传中会中止请求） */
  remove(id: string): void {
    const xhr = this.xhrs.get(id);
    if (xhr) {
      xhr.abort();
      this.xhrs.delete(id);
    }
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const [item] = this.items.splice(idx, 1);
    if (item) {
      if (item.preview) {
        URL.revokeObjectURL(item.preview);
        this.previewUrls.delete(item.preview);
      }
      this.renderList();
      this.emitChange();
    }
  }

  /** 清空全部上传项 */
  clear(): void {
    for (const id of [...this.xhrs.keys()]) {
      const xhr = this.xhrs.get(id);
      if (xhr) xhr.abort();
    }
    this.xhrs.clear();
    this.items = [];
    this.renderList();
    this.emitChange();
  }

  /** 销毁组件，释放全部资源 */
  destroy(): void {
    this.clear();
    for (const url of this.previewUrls) URL.revokeObjectURL(url);
    this.previewUrls.clear();
    if (this.hintTimer !== undefined) clearTimeout(this.hintTimer);
    this.btn?.destroy();
    this.el.remove();
  }

  private emitChange(): void {
    this.onChange?.(this.getItems());
  }
}

function escapeHTML(s: string): string {
  return s.replace(/[&<>"]/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return "&quot;";
    }
  });
}
