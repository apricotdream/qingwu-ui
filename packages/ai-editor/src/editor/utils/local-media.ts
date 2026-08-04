/**
 * 本地媒体（相对路径图片 / 附件）识别与解析工具。
 *
 * 背景：从 Obsidian / Typora 等复制 Markdown 粘贴进来时，文中的图片与附件往往是
 * **相对路径**（`./img/a.png`、`attachments/x.pdf`）或本地协议（`file://`、`app://`）。
 * 浏览器沙箱无法按路径直接读取用户磁盘，这些引用粘贴后会变成死链。
 *
 * 本模块只负责"**识别 + 定位**"：
 * 1. 判断一个 src/href 是否是本地引用（`isLocalMediaSrc`）；
 * 2. 归一化路径，便于跨平台匹配（`normalizeLocalSrc`）;
 * 3. 在用户授权的目录里把相对路径找回成真实 `File`（File System Access API）。
 *
 * 真正"读取字节 → 上传存储 → 换链"的编排，见 `relative-media.ts` / `resolve-local-media.ts`。
 */

/** 常见媒体/附件扩展名，用于判断剪贴板文本里是否"可能含本地资源引用" */
const MEDIA_EXT_RE =
  /\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|m4v|webm|ogg|mov|avi|mkv|mp3|wav|flac|m4a|aac|opus|pdf|docx?|xlsx?|pptx?|odt|rtf|txt|md|csv|zip|rar|7z|json)(\?|#|$)/i;

/** 不应被当作"本地文件"的伪协议 / 锚点 */
const NON_FILE_SCHEME_RE = /^(?:mailto:|tel:|javascript:|about:|data:|blob:)/i;

/**
 * 判断一个 src/href 是否是"需要解析的本地引用"。
 *
 * 返回 true 的情形：相对路径（`./a.png`、`a.png`、`../a.png`、`dir/a.png`）、
 * `file://...`、`app://...`（Obsidian）、Windows 绝对路径（`C:\`、`C:/`）。
 *
 * 返回 false 的情形：`http(s)://`、协议相对 `//`、`data:`、`blob:`、锚点、伪协议。
 */
export function isLocalMediaSrc(src: string | null | undefined): src is string {
  if (!src) return false;
  const s = src.trim();
  if (!s) return false;
  // 已可加载 / 已处理的来源，不需要解析
  if (/^(?:https?:)?\/\//i.test(s)) return false; // http:// https:// //
  if (NON_FILE_SCHEME_RE.test(s)) return false;
  if (s.startsWith("#")) return false; // 页内锚点
  // 其余一律视为本地引用
  return true;
}

/** 路径是否"看起来指向一个文件"（带扩展名），用于过滤 `[[笔记名]]`、`#锚点` 等非文件链接 */
export function looksLikeFilePath(path: string): boolean {
  return MEDIA_EXT_RE.test(path);
}

/**
 * 归一化本地路径，便于跨平台 / 跨写法匹配：
 * 去掉 `file://`、`app://` 前缀，URL 解码，反斜杠转正斜杠，去掉 `./` 与开头 `/`、盘符。
 */
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

// ---- File System Access API（仅 Chromium，需安全上下文） ----

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

/**
 * 弹出系统目录选择器，返回用户授权的目录句柄。
 * 用户取消（AbortError）或 API 抛错时返回 null。
 */
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

/** 按路径段逐级下钻取文件；任一段不存在则返回 null */
async function tryExactPath(root: FsDirectoryHandle, parts: string[]): Promise<File | null> {
  if (parts.length === 0) return null;
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      dir = await dir.getDirectoryHandle(parts[i]);
    } catch {
      return null;
    }
  }
  try {
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    return await fh.getFile();
  } catch {
    return null;
  }
}

/** 在目录里按 basename 递归查找（带遍历预算，防止超大目录拖垮主线程） */
async function searchByBasename(
  root: FsDirectoryHandle,
  basename: string,
  budget = 5000,
): Promise<File | null> {
  const target = basename.toLowerCase();
  const stack: FsDirectoryHandle[] = [root];
  let visited = 0;
  while (stack.length > 0 && visited < budget) {
    const dir = stack.pop() as FsDirectoryHandle;
    try {
      for await (const entry of dir.values()) {
        visited++;
        if (visited > budget) break;
        if (entry.kind === "file") {
          if (entry.name.toLowerCase() === target) {
            return await entry.getFile();
          }
        } else if (entry.kind === "directory") {
          stack.push(entry as unknown as FsDirectoryHandle);
        }
      }
    } catch {
      /* 个别目录无权限等，跳过 */
    }
  }
  return null;
}

/**
 * 在用户授权的目录里，把一个相对/本地路径找回成真实 `File`。
 *
 * 策略（从精确到宽松）：
 * 1. 完整路径逐级下钻；
 * 2. 逐段去掉开头路径段再试（兼容粘贴进来的是"库绝对路径"，而用户授权的是子目录）；
 * 3. 按 basename 递归查找（兼容 Obsidian"最短路径"写法）。
 * 找不到返回 null。
 */
export async function findFileInDirectory(
  root: FsDirectoryHandle,
  src: string,
): Promise<File | null> {
  const normalized = normalizeLocalSrc(src);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  // 1 + 2：完整路径 → 逐步去掉开头段
  for (let start = 0; start < parts.length; start++) {
    const sub = parts.slice(start);
    const file = await tryExactPath(root, sub);
    if (file) return file;
  }

  // 3：basename 兜底
  return searchByBasename(root, parts[parts.length - 1]);
}

// ---- 文档扫描：找出待解析的本地媒体引用 ----

export type LocalMediaKind = "image" | "video" | "audio" | "attachment";

export interface LocalMediaRef {
  /** 原始 src（媒体节点）或 href（链接型附件） */
  src: string;
  /** 归一化后的路径 */
  normalized: string;
  /** 小写 basename，用于剪贴板文件名匹配 */
  basename: string;
  kind: LocalMediaKind;
  /** true = 链接型附件（文本上的 link mark），false = 媒体节点（image/video/audio/attachment） */
  isLink: boolean;
}

const MEDIA_NODE_KIND: Record<string, LocalMediaKind> = {
  image: "image",
  videoEmbed: "video",
  audioEmbed: "audio",
  attachmentEmbed: "attachment",
};

/**
 * 扫描 ProseMirror 文档（或 Fragment 包装节点），收集所有"本地媒体引用"：
 * - image / videoEmbed / audioEmbed / attachmentEmbed 节点中 src 为本地引用的；
 * - 文本上 link mark 的 href 为本地文件路径的（链接型附件，如 `[[a.pdf]]`）。
 *
 * 按 src 去重。粘贴后由 RelativeMedia 扩展据此驱动解析与上传。
 */
export function collectLocalMediaRefs(rootNode: {
  descendants: (fn: (node: any, pos: number) => boolean | undefined) => void;
  nodeAt?: (pos: number) => any;
}): LocalMediaRef[] {
  const seen = new Map<string, LocalMediaRef>();

  rootNode.descendants((node: any) => {
    const kind = MEDIA_NODE_KIND[node.type?.name];
    if (kind) {
      const src = node.attrs?.src;
      if (typeof src === "string" && isLocalMediaSrc(src) && !seen.has(src)) {
        seen.set(src, {
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
        if (
          typeof href === "string" &&
          isLocalMediaSrc(href) &&
          looksLikeFilePath(href) &&
          !seen.has(href)
        ) {
          seen.set(href, {
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

  return [...seen.values()];
}

// ---- 剪贴板文本探测（供粘贴分流用） ----

/**
 * 粗判剪贴板文本/HTML 里是否"可能含本地媒体引用"。
 * 只用于粘贴分流（决定要不要让位给本地媒体解析），不保证精确；
 * 精确的引用清单以插入后文档节点为准（`collectLocalMediaRefs`）。
 */
export function textHasLocalMediaRefs(text: string, html?: string): boolean {
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

  return candidates.some((c) => looksLikeFilePath(c) && isLocalMediaSrc(c));
}
