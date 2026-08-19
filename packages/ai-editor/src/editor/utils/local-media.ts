/**
 * 本地媒体（相对路径图片/附件）识别与定位：判断本地引用 → 归一化路径 → 授权目录找回 File。
 * 粘贴自 Obsidian/Typora 的相对路径或 file:// 引用浏览器无法直读，需此模块解析。
 */

/** 媒体/附件扩展名，判断文本是否可能含本地引用 */
const MEDIA_EXT_RE =
  /\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|m4v|webm|ogg|mov|avi|mkv|mp3|wav|flac|m4a|aac|opus|pdf|docx?|xlsx?|pptx?|odt|rtf|txt|md|csv|zip|rar|7z|json)(\?|#|$)/i;

/** 伪协议（不应视为本地文件） */
const NON_FILE_SCHEME_RE = /^(?:mailto:|tel:|javascript:|about:|data:|blob:)/i;

/**
 * 判断 src/href 是否为本地引用。
 * true：相对路径、file://、app://、Windows 绝对路径；false：http(s)、data:、blob:、锚点、伪协议。
 */
export function isLocalMediaSrc(src: string | null | undefined): src is string {
  if (!src) return false;
  const s = src.trim();
  if (!s) return false;
  if (/^(?:https?:)?\/\//i.test(s)) return false; // http:// https:// //
  if (NON_FILE_SCHEME_RE.test(s)) return false;
  if (s.startsWith("#")) return false; // 页内锚点
  // 其余一律视为本地引用
  return true;
}

/** 路径是否带扩展名（用于过滤 [[笔记名]]、#锚点 等非文件链接） */
export function looksLikeFilePath(path: string): boolean {
  return MEDIA_EXT_RE.test(path);
}

/** 归一化本地路径：去 file://、app:// 前缀，URL 解码，统一斜杠，去 ./、开头 / 与盘符 */
export function normalizeLocalSrc(src: string): string {
  let s = src.trim();
  s = s.replace(/^(?:file|app):\/\/(?:localhost)?/i, "");
  try {
    s = decodeURIComponent(s);
  } catch {
    /* 解码失败保留原样 */
  }
  s = s.replace(/\\/g, "/");
  s = s.replace(/^\.\//, "");
  s = s.replace(/^\/+/, "");
  s = s.replace(/^[a-zA-Z]:\//, ""); // Windows 盘符
  return s;
}

/** 取路径的 basename（小写），用于剪贴板文件名匹配 */
export function basenameOf(path: string): string {
  const normalized = normalizeLocalSrc(path);
  const parts = normalized.split("/").filter(Boolean);
  return (parts[parts.length - 1] || normalized).toLowerCase();
}

// File System Access API（仅 Chromium，需安全上下文）

/** 结构化的目录句柄类型（FileSystemDirectoryHandle 的最小可用子集） */
export type FsDirectoryHandle = {
  name: string;
  getDirectoryHandle(name: string): Promise<FsDirectoryHandle>;
  getFileHandle(name: string): Promise<{ getFile(): Promise<File> }>;
  values(): AsyncIterableIterator<
    { kind: "file"; name: string; getFile(): Promise<File> } | { kind: "directory"; name: string }
  >;
};

/** 当前环境是否支持"选择目录并按相对路径读文件"（File System Access API） */
export function fsAccessSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext === false) return false;
  return (
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
    "function"
  );
}

/** 弹出系统目录选择器；取消或抛错返回 null */
export async function pickDirectory(): Promise<FsDirectoryHandle | null> {
  if (!fsAccessSupported()) return null;
  try {
    const picker = (
      window as unknown as {
        showDirectoryPicker: (opts?: { mode?: "read" | "readwrite" }) => Promise<FsDirectoryHandle>;
      }
    ).showDirectoryPicker;
    const handle = await picker.call(window, { mode: "read" });
    return handle ?? null;
  } catch {
    return null;
  }
}

/** 当前环境是否支持"系统文件选择器直接取文件"（File System Access API） */
export function filePickerSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext === false) return false;
  return (
    typeof (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker === "function"
  );
}

/**
 * 弹出系统文件选择器（可多选），返回真实 File 列表；取消或抛错返回 null。
 * 目录授权解析失败后的兜底，绕过云同步占位文件与文件夹名匹配不上两类问题。
 */
export async function pickLocalFiles(): Promise<File[] | null> {
  if (!filePickerSupported()) return null;
  try {
    const picker = (
      window as unknown as {
        showOpenFilePicker: (opts?: {
          multiple?: boolean;
        }) => Promise<Array<{ getFile(): Promise<File> }>>;
      }
    ).showOpenFilePicker;
    const handles = await picker.call(window, { multiple: true });
    return await Promise.all(handles.map((h) => h.getFile()));
  } catch {
    return null;
  }
}

/** 目录查找结果：file 为空时 readError 区分「没找到」与「找到了读不出」 */
export interface FindFileResult {
  file: File | null;
  /** 找到同名句柄但 getFile() 失败（云同步占位文件：存在但读不出字节） */
  readError?: unknown;
}

/** 按路径段逐级下钻取文件；任一段不存在返回空结果 */
async function tryExactPath(root: FsDirectoryHandle, parts: string[]): Promise<FindFileResult> {
  if (parts.length === 0) return { file: null };
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      dir = await dir.getDirectoryHandle(parts[i]);
    } catch {
      return { file: null };
    }
  }
  try {
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    try {
      return { file: await fh.getFile() };
    } catch (readError) {
      return { file: null, readError };
    }
  } catch {
    return { file: null };
  }
}

/** 按 basename 递归查找（带遍历预算防卡主线程） */
async function searchByBasename(
  root: FsDirectoryHandle,
  basename: string,
  budget = 5000,
): Promise<FindFileResult> {
  const target = basename.toLowerCase();
  const stack: FsDirectoryHandle[] = [root];
  let visited = 0;
  let readError: unknown;
  while (stack.length > 0 && visited < budget) {
    const dir = stack.pop() as FsDirectoryHandle;
    try {
      for await (const entry of dir.values()) {
        visited++;
        if (visited > budget) break;
        if (entry.kind === "file") {
          if (entry.name.toLowerCase() === target) {
            try {
              return { file: await entry.getFile() };
            } catch (err) {
              // 同名但读不出（云占位等）：记错误继续找
              readError = err;
            }
          }
        } else if (entry.kind === "directory") {
          stack.push(entry as unknown as FsDirectoryHandle);
        }
      }
    } catch {
      /* 个别目录无权限等，跳过 */
    }
  }
  if (visited >= budget) {
    console.warn(`目录遍历预算 ${budget} 已耗尽，「${basename}」可能藏在不完整的搜索范围内`);
  }
  return { file: null, readError };
}

/**
 * 在授权目录里把相对/本地路径找回成 File。
 * 策略由精确到宽松：完整路径下钻 → 去开头段重试 → basename 递归；
 * file 为 null 且带 readError 表示「找到但读不出」（云占位）。
 */
export async function findFileInDirectory(
  root: FsDirectoryHandle,
  src: string,
): Promise<FindFileResult> {
  const normalized = normalizeLocalSrc(src);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return { file: null };

  let readError: unknown;
  // 1 + 2：完整路径 → 逐步去掉开头段
  for (let start = 0; start < parts.length; start++) {
    const sub = parts.slice(start);
    const result = await tryExactPath(root, sub);
    if (result.file) return result;
    if (result.readError) readError = result.readError;
  }

  // 3：basename 兜底
  const fallback = await searchByBasename(root, parts[parts.length - 1]);
  if (fallback.file || fallback.readError) return fallback;
  return { file: null, readError };
}

// 文档扫描：找出待解析的本地媒体引用

export type LocalMediaKind = "image" | "video" | "audio" | "attachment";

export interface LocalMediaRef {
  /** 原始 src（媒体节点）或 href（链接型附件） */
  src: string;
  /** 归一化后的路径 */
  normalized: string;
  /** 小写 basename，用于剪贴板文件名匹配 */
  basename: string;
  kind: LocalMediaKind;
  /** true = 链接型附件，false = 媒体节点 */
  isLink: boolean;
}

const MEDIA_NODE_KIND: Record<string, LocalMediaKind> = {
  image: "image",
  videoEmbed: "video",
  audioEmbed: "audio",
  attachmentEmbed: "attachment",
};

/**
 * 扫描文档收集本地媒体引用：媒体节点 src 或链接 mark 的 href 为本地路径者。
 * 按 src 去重，但链接型与节点型不互相去重（同一文件可能既被嵌入又被链接，两者都要换链）。
 * @param isOwned 宿主 URL 归属判定：命中表示已是本站存储资源，跳过
 */
export function collectLocalMediaRefs(
  rootNode: {
    descendants: (fn: (node: any, pos: number) => boolean | undefined | void) => void;
    nodeAt?: (pos: number) => any;
  },
  isOwned?: (src: string) => boolean,
): LocalMediaRef[] {
  const seen = new Set<string>();
  const refs: LocalMediaRef[] = [];

  rootNode.descendants((node: any) => {
    const kind = MEDIA_NODE_KIND[node.type?.name];
    if (kind) {
      const src = node.attrs?.src;
      const key = `node:${src}`;
      if (typeof src === "string" && isLocalMediaSrc(src) && !seen.has(key) && !isOwned?.(src)) {
        seen.add(key);
        refs.push({
          src,
          normalized: normalizeLocalSrc(src),
          basename: basenameOf(src),
          kind,
          isLink: false,
        });
      }
      return;
    }
    // 链接型附件：文本节点上的 link mark
    if (node.isText && node.marks) {
      for (const mark of node.marks as Array<{
        type: { name: string };
        attrs: Record<string, unknown>;
      }>) {
        if (mark.type.name !== "link") continue;
        const href = mark.attrs?.href;
        const key = `link:${href}`;
        if (
          typeof href === "string" &&
          isLocalMediaSrc(href) &&
          looksLikeFilePath(href) &&
          !seen.has(key) &&
          !isOwned?.(href)
        ) {
          seen.add(key);
          refs.push({
            src: href,
            normalized: normalizeLocalSrc(href),
            basename: basenameOf(href),
            kind: "attachment",
            isLink: true,
          });
        }
      }
    }
  });

  return refs;
}

// 剪贴板文本探测（供粘贴分流用）

/**
 * 粗判文本/HTML 是否可能含本地媒体引用，仅用于粘贴分流，不保证精确。
 * @param isOwned 命中的候选不算本地引用
 */
export function textHasLocalMediaRefs(
  text: string,
  html?: string,
  isOwned?: (src: string) => boolean,
): boolean {
  const blob = html ? `${text}\n${html}` : text;
  if (!blob) return false;

  const candidates: string[] = [];
  // ![alt](src) / [text](href)
  for (const m of blob.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    candidates.push(m[1]);
  }
  // ![[wiki]] / [[wiki]]
  for (const m of blob.matchAll(/!?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    candidates.push(m[1]);
  }
  // <img|video|audio|source src>
  for (const m of blob.matchAll(/<(?:img|video|audio|source)[^>]*\bsrc=["']([^"']+)["']/gi)) {
    candidates.push(m[1]);
  }
  // <a href>
  for (const m of blob.matchAll(/<a[^>]*\bhref=["']([^"']+)["']/gi)) {
    candidates.push(m[1]);
  }

  return candidates.some((c) => looksLikeFilePath(c) && isLocalMediaSrc(c) && !isOwned?.(c));
}
