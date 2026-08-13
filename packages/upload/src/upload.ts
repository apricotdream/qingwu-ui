/* ============================================================
   青梧UI · 图片上传组件（ImageUpload）
   - 拖拽/点击选择，多文件 + 数量限制
   - 客户端压缩：原图 / webp / avif 多份产出，格式按配置三选一
   - avif 不可编码时自动降级 webp → png
   - 每个上传项独立进度条（内置 XHR 真实进度，或自定义 uploadFn）
   - 零框架依赖，纯 DOM + CSS
   ============================================================ */

import { Button } from "@apricotdream/button";
import { compressImage, detectEncodeMimes } from "./compress";
import type { CompressedFile, OutputFormat, UploadItem, UploadOptions } from "./types";

/* ============================================================
   持久化：未完成上传项（File + 元数据）存入 IndexedDB
   IndexedDB 不可用时（如测试环境）降级内存 Map，行为等价
   ============================================================ */

type PersistStrategy = "session" | "local";

interface PersistEntry {
  id: string;
  file: File;
  name: string;
  mime: string;
  originalSize: number;
  size: number;
  format: OutputFormat;
  source?: "local" | "url";
  originalUrl?: string;
}

const PERSIST_DB = "qw-upload";
const PERSIST_VERSION = 1;
const persistMemory: Record<PersistStrategy, Map<string, PersistEntry>> = {
  session: new Map(),
  local: new Map(),
};
let persistDbPromise: Promise<IDBDatabase | null> | null = null;

function openPersistDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(PERSIST_DB, PERSIST_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of ["session", "local"] as const) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function getPersistDb(): Promise<IDBDatabase | null> {
  if (!persistDbPromise) persistDbPromise = openPersistDb();
  return persistDbPromise;
}

/** 全量覆盖写（先清后写）；IndexedDB 不可用时写内存 Map */
async function persistWriteAll(strategy: PersistStrategy, entries: PersistEntry[]): Promise<void> {
  const db = await getPersistDb();
  if (!db) {
    const mem = persistMemory[strategy];
    mem.clear();
    for (const e of entries) mem.set(e.id, e);
    return;
  }
  const tx = db.transaction(strategy, "readwrite");
  const store = tx.objectStore(strategy);
  store.clear();
  for (const e of entries) store.put(e);
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function persistReadAll(strategy: PersistStrategy): Promise<PersistEntry[]> {
  const db = await getPersistDb();
  if (!db) return [...persistMemory[strategy].values()];
  return new Promise((resolve) => {
    const req = db.transaction(strategy, "readonly").objectStore(strategy).getAll();
    req.onsuccess = () => resolve(req.result as PersistEntry[]);
    req.onerror = () => resolve([]);
  });
}

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

/* ============================================================
   URL 导入辅助
   ============================================================ */

/** scheme 白名单：仅 http/https/data；解析失败或其它协议返回原因 */
function checkUrl(raw: string): { ok: true } | { ok: false; reason: string } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "URL 格式无效" };
  }
  if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "data:") {
    return { ok: true };
  }
  return { ok: false, reason: `不支持 ${u.protocol} 协议` };
}

/** 按行拆分 URL（空行忽略），供批量导入 */
function parseUrlLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 带超时的 fetch；超时以 AbortError 抛出 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * HEAD 预检：Content-Length 超限返回 { tooLarge: true }；
 * HEAD 不可用（405/CORS 等）返回 null，由调用方降级直接 GET。
 */
async function headCheck(
  url: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<{ tooLarge: boolean } | null> {
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD" }, timeoutMs);
    const len = res.headers.get("content-length");
    if (len != null && Number(len) > maxBytes) return { tooLarge: true };
    return { tooLarge: false };
  } catch {
    return null;
  }
}

/**
 * 读取文件头签名（magic bytes）识别真实图片格式。
 * 后缀不可信，识别结果作为 accept 校验 / 文件名 / 压缩判断的权威依据。
 */
async function detectImageType(blob: Blob): Promise<string | null> {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (head.length < 4) return null;
  // PNG
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47)
    return "image/png";
  // JPEG
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  // GIF
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38)
    return "image/gif";
  // BMP
  if (head[0] === 0x42 && head[1] === 0x4d) return "image/bmp";
  // RIFF 容器 → WebP（字节 8-11 为 "WEBP"）
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) {
    const brand = new TextDecoder().decode(head.slice(8, 12));
    if (brand === "WEBP") return "image/webp";
  }
  // ISO-BMFF 容器（字节 4-7 为 "ftyp"）→ AVIF（brand 为 avif/avis）
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = new TextDecoder().decode(head.slice(8, 12));
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  // SVG：文本形式，允许前置 XML 声明/注释
  const text = await blob.slice(0, 512).text();
  if (/^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg[\s>/]/i.test(text))
    return "image/svg+xml";
  return null;
}

/** 由 URL 生成文件名：最后一段去 query；无可识别扩展名时回退 url-image.<ext> */
function nameFromUrl(url: string, mime: string): string {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    /* data: 等不可解析时按整体处理 */
  }
  let name = path.split("/").pop() ?? "";
  try {
    name = decodeURIComponent(name);
  } catch {
    /* 保留原样 */
  }
  name = name.replace(/[?#].*$/, "");
  if (!name || !/\.[a-z0-9]{2,5}$/i.test(name)) {
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "img";
    name = `url-image.${ext}`;
  }
  return name;
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

/** 单文件大图模式的「上传中」视觉保底时长：真实上传可能瞬间完成，避免进度一闪而过 */
const MIN_UPLOAD_VISIBLE_MS = 350;

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
      | "urlImport"
      | "urlImportTimeout"
      | "initialUrls"
      | "persist"
      | "previewFit"
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
  /** 拖拽容器提示区（ico/main/sub；状态切换只切 hidden，不重建容器） */
  private dropzoneHint!: HTMLElement;
  /** 单文件大图区（absolute 盖满容器） */
  private dropzonePreviewBox!: HTMLElement;
  /** 单文件模式容器大图预览对应的 item id（非空时容器点击 = 预览，X = 移除） */
  private dropzonePreviewId: string | null = null;
  private previewLightbox: HTMLElement | null = null;
  /** 上传开始时间戳（视觉保底计算） */
  private uploadStartAt = 0;
  /** 视觉保底到期时间戳：期间成功项仍渲染为「上传中」态 */
  private holdDropzoneUntil = 0;
  private btn: Button | null = null;
  /** 按钮形态状态机：空闲选文件 / 上传中忽略 / 已上传或失败点击移除 */
  private btnState: "idle" | "uploading" | "done" | "error" = "idle";
  private btnItemId: string | null = null;
  private hint!: HTMLElement;
  private list!: HTMLElement;
  private input!: HTMLInputElement;
  private urlBar: HTMLElement | null = null;
  private urlPanel: HTMLElement | null = null;
  private urlInput: HTMLTextAreaElement | null = null;
  private urlGoBtn: HTMLButtonElement | null = null;

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
      urlImport: opts.urlImport ?? true,
      urlImportTimeout: opts.urlImportTimeout ?? 10000,
      initialUrls: opts.initialUrls ?? [],
      persist: opts.persist ?? "off",
      previewFit: opts.previewFit ?? "cover",
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

    // 编辑态回显：initialUrls 渲染为成功项（无文件、不参与上传，删除走 remove → onChange 差集）
    for (const raw of this.opts.initialUrls ?? []) {
      this.items.push({
        id: nextId(),
        file: undefined,
        name: nameFromUrl(raw, "image/*"),
        mime: "image/*",
        originalSize: 0,
        size: 0,
        format: "original",
        status: "success",
        progress: 100,
        preview: raw,
        source: "remote",
        remoteUrl: raw,
      });
    }
    if (this.items.length > 0) {
      this.renderList();
      this.emitChange();
    }

    // 持久化恢复：上次未完成的项（刷新/重开后列表还在），恢复为 pending 并自动重新上传
    if (this.opts.persist !== "off") void this.restorePersisted();

    // 预热格式编码探测（压缩开启时），避免首个文件等待
    if (this.opts.compress) {
      void detectEncodeMimes().then((s) => {
        this.encodable = s;
      });
    }
  }

  /** 恢复持久化的未完成项并自动重新上传（成功项不持久化，由宿主 initialUrls 回显） */
  private async restorePersisted(): Promise<void> {
    const strategy = this.opts.persist;
    if (strategy === "off") return;
    const entries = await persistReadAll(strategy);
    for (const e of entries) {
      if (this.items.some((i) => i.id === e.id)) continue;
      const preview = URL.createObjectURL(e.file);
      this.previewUrls.add(preview);
      this.items.push({
        id: e.id,
        file: e.file,
        name: e.name,
        mime: e.mime,
        originalSize: e.originalSize,
        size: e.size,
        format: e.format,
        status: "pending",
        progress: 0,
        preview,
        source: e.source ?? "local",
        originalUrl: e.originalUrl,
      });
    }
    if (entries.length > 0) {
      this.renderList();
      this.emitChange();
      for (const item of this.items) {
        if (item.status === "pending") void this.upload(item);
      }
    }
  }

  /** 持久化同步：只保留未完成项（上传中/失败/等待）；成功与 remote 项不入库 */
  private syncPersist(): void {
    const strategy = this.opts.persist;
    if (strategy === "off") return;
    const entries: PersistEntry[] = this.items
      .filter((i) => i.file && i.status !== "success" && i.source !== "remote")
      .map((i) => ({
        id: i.id,
        file: i.file!,
        name: i.name,
        mime: i.mime,
        originalSize: i.originalSize,
        size: i.size,
        format: i.format,
        source: i.source === "url" ? ("url" as const) : undefined,
        originalUrl: i.originalUrl,
      }));
    void persistWriteAll(strategy, entries);
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
      /* 按钮变体：复用 @apricotdream/button 样式，进度内嵌按钮，不渲染列表容器 */
      this.btn = new Button({
        text: "选择图片",
        variant: "primary",
        onClick: () => this.handleBtnClick(),
      });
      this.btn.el.classList.add("qw-upload-btn");
      this.el.append(this.btn.el, this.input);
    } else {
      this.dropzone = el("div", "qw-upload-dropzone");
      this.dropzone.setAttribute("role", "button");
      this.dropzone.setAttribute("tabindex", "0");
      this.dropzone.setAttribute("aria-label", "选择或拖拽图片上传");

      // 提示区（稳定子元素，状态切换只切 hidden，不重建容器）
      this.dropzoneHint = el("div", "qw-upload-dropzone-hint");
      this.dropzoneHint.innerHTML =
        `<span class="qw-upload-ico">${ICO_UPLOAD}</span>` +
        `<span class="qw-upload-main">拖拽图片到此处，或 <em>点击选择</em></span>` +
        `<span class="qw-upload-sub">${this.hintText()}</span>`;
      // 单文件大图区（absolute 盖满容器）
      this.dropzonePreviewBox = el("div", "qw-upload-dropzone-preview-box");
      this.dropzonePreviewBox.hidden = true;
      this.dropzone.append(this.dropzoneHint, this.dropzonePreviewBox);

      if (this.opts.urlImport) {
        this.urlBar = el("div", "qw-upload-urlbar");
        this.urlBar.innerHTML = `<button type="button" class="qw-upload-urlbtn">从 URL 导入</button>`;

        this.urlPanel = el("div", "qw-upload-urlpanel");
        this.urlPanel.hidden = true;
        // textarea 而非 input：单行 input 会剥离换行，无法多行粘贴
        this.urlInput = document.createElement("textarea");
        this.urlInput.rows = 2;
        this.urlInput.className = "qw-upload-urlinput";
        this.urlInput.placeholder = "粘贴图片 URL，支持多行";
        this.urlInput.setAttribute("aria-label", "图片 URL");
        this.urlGoBtn = el("button", "qw-upload-urlgo", "导入") as HTMLButtonElement;
        this.urlGoBtn.type = "button";
        const cancel = el("button", "qw-upload-urlcancel", "取消") as HTMLButtonElement;
        cancel.type = "button";
        cancel.addEventListener("click", () => this.closeUrlPanel());
        this.urlPanel.append(this.urlInput, this.urlGoBtn, cancel);
        // URL 入口在图片框内（底部）
        this.dropzone.append(this.urlBar, this.urlPanel);
      }
      this.el.append(this.dropzone);
    }

    this.hint = el("div", "qw-upload-hint");
    this.hint.hidden = true;

    /* 按钮形态不渲染列表容器：进度内嵌按钮，移除/清空后按钮复位 */
    if (this.opts.trigger === "button") {
      this.el.append(this.hint);
      return;
    }

    this.list = el("div", "qw-upload-list");
    this.list.hidden = true;

    this.el.append(this.hint, this.list, this.input);
  }

  private bind(): void {
    this.input.addEventListener("change", () => {
      this.handleFiles(Array.from(this.input.files ?? []));
      this.input.value = "";
    });

    /* 拖拽（仅拖拽区形态）；大图模式：✕ = 一键清空全部（单文件容器承载整个字段），容器点击 = 图片预览 */
    this.dropzone?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".qw-upload-dropzone-remove")) {
        // ✕ 只出现在单文件预览态：一张图可衍生多份格式项，点 ✕ = 放弃整个字段（clear 语义）
        this.clear();
        return;
      }
      if (this.dropzonePreviewId) {
        const item = this.items.find((i) => i.id === this.dropzonePreviewId);
        if (item?.preview && item.status === "success") this.openPreview(item.preview);
        return;
      }
      this.input.click();
    });
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
      this.handleFiles(Array.from(e.dataTransfer?.files ?? []));
    });

    /* URL 导入：入口/面板事件（stopPropagation 防止触发文件选择） */
    this.urlBar?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleUrlPanel();
    });
    this.urlPanel?.addEventListener("click", (e) => e.stopPropagation());
    this.urlInput?.addEventListener("keydown", (e) => {
      e.stopPropagation();
      // Enter 导入，Shift+Enter 换行
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.importUrls();
      } else if (e.key === "Escape") {
        this.closeUrlPanel();
      }
    });
    this.urlGoBtn?.addEventListener("click", () => void this.importUrls());

    /* 列表事件委托：删除按钮（按钮形态无列表，跳过） */
    this.list?.addEventListener("click", (e) => {
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

  private handleFiles(files: File[]): void {
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

  /**
   * 压缩 → 生成上传项 → 开始上传。
   * @param meta source/originalUrl 溯源信息（URL 导入时传入）
   * @returns 生成的上传项（尚未完成上传，status 为 pending）
   */
  private async ingest(
    file: File,
    meta?: { source?: "local" | "url"; originalUrl?: string },
  ): Promise<UploadItem[]> {
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
      source: meta?.source ?? "local",
      originalUrl: meta?.originalUrl,
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
    this.syncPersist(); // 新项入库（未完成态）
    for (const item of pending) void this.upload(item);
    return pending;
  }

  /* ============================================================
     上传
     ============================================================ */
  private async upload(item: UploadItem): Promise<void> {
    this.setStatus(item, "uploading");
    item.progress = 0;
    this.onStart?.(item);
    this.syncBtn(item, "uploading", 0);
    this.uploadStartAt = Date.now();
    this.renderItem(item); // 立即进入大图「上传中 0%」态（快速上传也可见）

    try {
      if (this.uploadFn) {
        // 上传项必有文件（remote 回显项为 success 态不会走到这里）
        await this.uploadFn(item.file!, (p) => {
          item.progress = p;
          this.renderItem(item);
          this.onProgress?.(item);
          this.syncBtn(item, "uploading", item.progress);
        });
      } else if (this.url) {
        await this.uploadXHR(item);
      }
      // 无 url 也无 uploadFn：仅压缩/选择模式，直接视为成功
      this.setStatus(item, "success");
      item.progress = 100;
      // 单文件大图模式视觉保底：先设 hold 再渲染，上传中态至少可见 MIN_UPLOAD_VISIBLE_MS，再切「点击移除」
      const remain = MIN_UPLOAD_VISIBLE_MS - (Date.now() - this.uploadStartAt);
      if (this.dropzone && this.opts.maxCount === 1 && remain > 0) {
        this.holdDropzoneUntil = Date.now() + remain;
        window.setTimeout(() => {
          this.holdDropzoneUntil = 0;
          if (this.dropzonePreviewId === item.id) this.renderItem(item);
        }, remain);
      }
      this.renderItem(item);
      this.onSuccess?.(item);
      this.syncBtn(item, "done", null);
      this.emitChange();
      this.syncPersist(); // 成功项出库，失败/等待项保留
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (e.name === "AbortError") return; // 主动移除，不报错
      item.error = e.message;
      this.setStatus(item, "error");
      this.renderItem(item);
      this.onError?.(item, e);
      this.syncBtn(item, "error", null);
      this.emitChange();
      this.syncPersist(); // 失败项保留（刷新后可重试）
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
      fd.append(this.opts.fieldName, item.file!, item.file!.name);
      xhr.send(fd);
    });
  }

  /* ============================================================
     URL 导入
     ============================================================ */

  /**
   * 从 URL 导入图片：HEAD 预检 → GET 下载 → magic bytes 识别 → 校验 → 走压缩/上传同一管线。
   * 失败时在列表留下 error 条目（可删除）并返回 null。
   */
  async addFromUrl(url: string): Promise<UploadItem | null> {
    const raw = url.trim();
    const checked = checkUrl(raw);
    if (!checked.ok) {
      this.pushErrorItem(raw, checked.reason, raw);
      return null;
    }
    const maxBytes = this.opts.maxSizeMB * 1024 * 1024;
    try {
      // 预检：仅 http(s)；HEAD 不可用时降级直接 GET
      if (!raw.startsWith("data:")) {
        const pre = await headCheck(raw, maxBytes, this.opts.urlImportTimeout);
        if (pre?.tooLarge) {
          this.pushErrorItem(raw, `超过大小上限 ${this.opts.maxSizeMB} MB`, raw);
          return null;
        }
      }
      const res = await fetchWithTimeout(raw, {}, this.opts.urlImportTimeout);
      if (!res.ok) {
        this.pushErrorItem(raw, `HTTP ${res.status}`, raw);
        return null;
      }
      const blob = await res.blob();
      if (blob.size > maxBytes) {
        this.pushErrorItem(raw, `超过大小上限 ${this.opts.maxSizeMB} MB`, raw);
        return null;
      }
      const mime = await detectImageType(blob);
      if (!mime) {
        this.pushErrorItem(raw, "无法识别为图片", raw);
        return null;
      }
      const name = nameFromUrl(raw, mime);
      const file = new File([blob], name, { type: mime });
      const reason = validateFile(
        file,
        this.accept,
        this.opts.maxSizeMB,
        this.items.length,
        this.opts.maxCount,
      );
      if (reason) {
        const msg =
          reason === "type"
            ? `不支持 ${mime}`
            : reason === "size"
              ? `超过大小上限 ${this.opts.maxSizeMB} MB`
              : "已达数量上限";
        this.pushErrorItem(name, msg, raw);
        return null;
      }
      const items = await this.ingest(file, { source: "url", originalUrl: raw });
      return items.find((i) => i.format === "original") ?? items[0] ?? null;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      const msg =
        e.name === "AbortError"
          ? "导入超时"
          : /failed to fetch/i.test(e.message)
            ? "跨域或网络错误"
            : e.message;
      this.pushErrorItem(raw, msg, raw);
      return null;
    }
  }

  /** 失败项：留在列表中供查看/删除，不触发 onError（其语义是上传阶段错误） */
  private pushErrorItem(name: string, message: string, originalUrl?: string): UploadItem {
    const item: UploadItem = {
      id: nextId(),
      file: new File([], name, { type: "" }),
      name,
      mime: "",
      originalSize: 0,
      size: 0,
      format: "original",
      status: "error",
      progress: 0,
      error: message,
      source: "url",
      originalUrl,
    };
    this.items.push(item);
    this.renderList();
    this.emitChange();
    return item;
  }

  private toggleUrlPanel(): void {
    if (!this.urlPanel || !this.urlInput) return;
    this.urlPanel.hidden = !this.urlPanel.hidden;
    if (!this.urlPanel.hidden) this.urlInput.focus();
  }

  private closeUrlPanel(): void {
    if (!this.urlPanel || !this.urlInput) return;
    this.urlPanel.hidden = true;
    this.urlInput.value = "";
  }

  private setUrlBusy(busy: boolean): void {
    if (!this.urlGoBtn || !this.urlBar) return;
    this.urlGoBtn.disabled = busy;
    this.urlGoBtn.textContent = busy ? "导入中…" : "导入";
    this.urlBar.classList.toggle("is-busy", busy);
  }

  /** 批量导入输入框中的多行 URL；失败项留在列表，toast 汇总 */
  private async importUrls(): Promise<void> {
    const urls = parseUrlLines(this.urlInput?.value ?? "");
    if (urls.length === 0) {
      this.setHint("请输入图片 URL");
      return;
    }
    this.setUrlBusy(true);
    try {
      const results = await Promise.allSettled(urls.map((u) => this.addFromUrl(u)));
      const failed = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value === null),
      ).length;
      if (failed > 0) this.setHint(`${failed} 个 URL 导入失败，详见列表`);
    } finally {
      this.setUrlBusy(false);
      this.closeUrlPanel();
    }
  }

  /* ============================================================
     渲染
     ============================================================ */
  private setStatus(item: UploadItem, status: UploadItem["status"]): void {
    item.status = status;
  }

  private renderList(): void {
    if (!this.list) return; // 按钮形态无列表容器
    this.renderDropzone();
    // 先清空：隐藏态（空态/大图模式）不重建，但必须清掉残留行——✕ 全清后隐藏列表不应残留上次的项
    this.list.textContent = "";
    if (this.list.hidden) return; // 大图模式或空态：列表隐藏
    const frag = document.createDocumentFragment();
    for (const item of this.items) frag.append(this.buildItem(item));
    this.list.append(frag);
  }

  /** 拖拽区默认提示文案 */
  private hintText(): string {
    const hintCount = this.opts.maxCount > 0 ? `最多 ${this.opts.maxCount} 张 · ` : "";
    const fmtHint = this.opts.supportedFormats.length
      ? this.opts.supportedFormats.map((f) => f.toUpperCase()).join("/")
      : "JPG/PNG/WebP/GIF/AVIF";
    return `${hintCount}单张 ≤ ${this.opts.maxSizeMB} MB · 支持 ${fmtHint}`;
  }

  /**
   * 单文件模式（maxCount=1）下容器承载大图预览：成功/上传中且有预览的项替换默认提示，
   * 列表同步隐藏；空态/失败态恢复默认提示（失败项仍走列表展示）。
   * 只切换子元素 hidden，不重建容器——URL 导入入口（容器内）不受影响。
   */
  private renderDropzone(): void {
    if (!this.dropzone || this.opts.maxCount !== 1) return;
    const item = this.items.find((i) => i.status === "success" || i.status === "uploading");
    const preview = item?.preview;
    const show = !!preview;
    this.dropzonePreviewId = show ? item!.id : null;
    this.dropzone.classList.toggle("is-preview", show);
    this.dropzoneHint.hidden = show;
    this.dropzonePreviewBox.hidden = !show;
    if (this.urlBar) {
      this.urlBar.hidden = show; // 大图盖满容器，URL 入口随提示区一起隐藏
      if (this.urlPanel) this.urlPanel.hidden = true; // 大图切换时收起展开面板
    }
    // 单文件大图模式或空态：列表隐藏；其他状态列表展示（失败项等）
    if (this.list) this.list.hidden = this.items.length === 0 || this.dropzonePreviewId !== null;
    if (!show) return;
    // 视觉保底窗口内：已成功的项仍渲染为「上传中」态，避免快速上传进度一闪而过
    const hold = item!.status === "success" && Date.now() < this.holdDropzoneUntil;
    // 容器内进度条 = 所有上传中项的聚合（多格式多份时进度条仍完整反映整体）
    const active = this.items.filter(
      (i) => i.status === "uploading" || (i.status === "success" && hold),
    );
    const uploading = active.length > 0;
    const pct =
      uploading && active.length > 0
        ? Math.round(active.reduce((sum, i) => sum + i.progress, 0) / active.length)
        : item!.progress;
    // auto：初始保守用 contain（完整显示），图片加载完成后按「图 ≥ 容器」判定切换 cover
    const fitContain = this.opts.previewFit === "contain" || this.opts.previewFit === "auto";
    this.dropzonePreviewBox.innerHTML =
      `<img class="qw-upload-dropzone-preview${fitContain ? " is-contain" : ""}" src="${escapeHTML(preview)}" alt="" />` +
      `<span class="qw-upload-dropzone-mask">${uploading ? `上传中 ${pct}%` : "点击预览"}</span>` +
      (uploading
        ? `<span class="qw-upload-dropzone-progress"><i style="width:${pct}%"></i></span>`
        : "") +
      `<button type="button" class="qw-upload-dropzone-remove" aria-label="移除图片" title="移除">✕</button>`;
    if (this.opts.previewFit === "auto") {
      const imgEl = this.dropzonePreviewBox.querySelector<HTMLImageElement>("img");
      if (imgEl) {
        const applyAutoFit = () => {
          if (!imgEl.naturalWidth || !imgEl.naturalHeight) return;
          // 自适应：图片比例与容器比例接近 → 铺满（裁切少）；差异大（如横图进竖容器）→ 完整显示，避免裁切主体
          const imgRatio = imgEl.naturalWidth / imgEl.naturalHeight;
          const boxRatio = (this.dropzone.clientWidth || 1) / (this.dropzone.clientHeight || 1);
          const diff = Math.abs(imgRatio - boxRatio) / boxRatio;
          imgEl.classList.toggle("is-contain", diff >= 0.2);
        };
        // 缓存命中的图（如 initialUrls 回显）可能在监听前已 complete，load 不再触发 → 立即执行一次
        if (imgEl.complete) applyAutoFit();
        else imgEl.addEventListener("load", applyAutoFit, { once: true });
      }
    }
  }

  /** 打开图片预览（全屏遮罩），点击关闭 */
  private openPreview(url: string): void {
    if (this.previewLightbox) return;
    const layer = el("div", "qw-upload-lightbox");
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    layer.append(img);
    layer.addEventListener("click", () => this.closePreview());
    document.body.append(layer);
    this.previewLightbox = layer;
  }

  private closePreview(): void {
    this.previewLightbox?.remove();
    this.previewLightbox = null;
  }

  private buildItem(item: UploadItem): HTMLElement {
    const row = el("div", "qw-upload-item");
    row.dataset.id = item.id;

    const thumb = el("div", "qw-upload-thumb");
    if (item.preview) {
      const img = document.createElement("img");
      img.src = item.preview;
      img.alt = "";
      thumb.append(img);
    } else {
      thumb.classList.add("is-empty"); // 无预览（如识别失败的 error 条目）显示占位符
    }

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
      item.source === "remote"
        ? "已上传"
        : item.originalSize !== item.size
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
    if (!this.list) return; // 按钮形态无列表容器
    this.renderDropzone(); // 单文件模式：进度/状态变化同步容器大图
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
  /** 程序化添加文件（等同用户选择/拖入组件），走完整压缩上传管线 */
  addFiles(files: File[]): void {
    this.handleFiles(files);
  }

  /* ============================================================
     按钮形态：状态机 + 内嵌进度
     ============================================================ */

  /** 同步按钮形态状态（其他形态为空操作） */
  private syncBtn(
    item: UploadItem,
    state: "uploading" | "done" | "error",
    pct: number | null,
  ): void {
    if (!this.btn) return;
    if (state === "uploading") this.btnItemId = item.id; // 认领当前上传项
    if (this.btnItemId !== item.id) return;
    this.btnState = state;
    if (state === "uploading") {
      this.btn.disabled = true;
      this.renderBtn("上传中", pct ?? 0);
    } else {
      this.btn.disabled = false;
      this.renderBtn(state === "done" ? "已上传 ✓" : "上传失败", null);
    }
  }

  /**
   * 按钮形态渲染：自管按钮内部 DOM（Button.text setter 用 textContent 会清掉进度条子元素）。
   * 进度条为半透明白条叠在主色按钮上，宿主主题化时无需额外覆盖。
   */
  private renderBtn(label: string, pct: number | null): void {
    const btnEl = this.btn?.el;
    if (!btnEl) return;
    btnEl.textContent = "";
    const txt = el("span", "qw-upload-btn-label");
    txt.textContent = pct === null ? label : `${label} ${pct}%`;
    btnEl.append(txt);
    if (pct !== null) {
      const bar = el("span", "qw-upload-btn-progress");
      bar.style.width = `${pct}%`;
      btnEl.append(bar);
    }
  }

  /** 按钮点击状态机：空闲选文件 / 上传中忽略 / 已上传或失败点击移除（单文件已上传 = 清空全部） */
  private handleBtnClick(): void {
    if (this.btnState === "uploading") return;
    if (this.btnState === "done" || this.btnState === "error") {
      if (!this.btnItemId) return;
      // 单文件按钮形态：一张图可衍生多份格式项，已上传后点击 = 放弃整个字段；
      // 若只删一项，其余项会残留并卡死数量上限（新文件永远被拒）
      if (this.btnState === "done" && this.opts.maxCount === 1) this.clear();
      else this.remove(this.btnItemId);
      return;
    }
    this.input.click();
  }

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
      if (this.btn && this.btnItemId === id) {
        this.btnState = "idle";
        this.btnItemId = null;
        this.renderBtn("选择图片", null);
      }
      this.renderList();
      this.emitChange();
      this.syncPersist();
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
    if (this.btn) {
      this.btnState = "idle";
      this.btnItemId = null;
      this.renderBtn("选择图片", null);
    }
    this.renderList();
    this.emitChange();
    this.syncPersist();
  }

  /** 销毁组件，释放全部资源 */
  destroy(): void {
    // 静默清理：不触发 onChange（宿主差集会把已成功项误判为「被移除」→ 清字段 + 删存储）。
    // 宿主在 Step1 切步骤/离开时卸载组件，字段与已上传 URL 必须保留。
    for (const id of [...this.xhrs.keys()]) {
      const xhr = this.xhrs.get(id);
      if (xhr) xhr.abort();
    }
    this.xhrs.clear();
    this.items = [];
    if (this.btn) {
      this.btnState = "idle";
      this.btnItemId = null;
      this.renderBtn("选择图片", null);
    }
    if (this.list) {
      this.list.hidden = true;
      this.list.textContent = "";
    }
    if (this.opts.persist !== "off") void persistWriteAll(this.opts.persist, []); // 销毁即丢弃持久化
    this.closePreview();
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
