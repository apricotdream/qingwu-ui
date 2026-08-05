/**
 * 本地媒体解析流程：粘贴进来的相对路径图片/附件 → 读取真实文件 → 上传存储 → 换链。
 *
 * 两级获取策略（由 `RelativeMedia` 扩展编排）：
 * 1. **剪贴板文件匹配**：部分来源（如直接复制了图片文件）会把文件本体放入剪贴板，
 *    按 basename 匹配后**静默**上传，不打扰用户；
 * 2. **目录授权解析**（File System Access API，仅 Chromium）：先弹项目风格弹窗说明原因，
 *    用户同意后唤起系统目录选择器，按相对路径（精确 → 去头段 → basename 兜底）找回文件。
 *
 * 不支持目录读取的浏览器（Safari/Firefox）降级为"拖拽文件进编辑器"引导
 * （拖拽上传由 ImageUpload 扩展既有 handleDrop 完成）。
 *
 * 安全与体验约定（对应产品原则"温和但明确"）：
 * - 读盘只在用户明确点击授权后发生，绝不静默进行；
 * - 每个文件先过附件限额校验，超限说人话拒绝；
 * - 结束统一 toast 汇总：成功数 / 仅本次可见 / 未找到清单，不留下无声碎图。
 */
import { toast } from "../../components/toast";
import { getEditorAttachmentLimits, validateAttachmentFile } from "../attachment-limits";
import { uploadPlaceholder } from "../extensions/image-upload";
import { getStorageProvider } from "../storage";
import {
  type FsDirectoryHandle,
  findFileInDirectory,
  type LocalMediaRef,
  pickLocalFiles,
} from "./local-media";

/** 单个引用的解析结果 */
export type ResolveOutcome = "uploaded" | "sessionOnly" | "limitRejected";

export interface ResolveReport {
  uploaded: number;
  sessionOnly: number;
  limitRejected: number;
  missing: LocalMediaRef[];
  /** 在目录里找到了同名文件，但读不出字节（云同步占位文件等） */
  readFailed: LocalMediaRef[];
}

export function createEmptyReport(): ResolveReport {
  return { uploaded: 0, sessionOnly: 0, limitRejected: 0, missing: [], readFailed: [] };
}

export function mergeReports(target: ResolveReport, src: ResolveReport): void {
  target.uploaded += src.uploaded;
  target.sessionOnly += src.sessionOnly;
  target.limitRejected += src.limitRejected;
  target.missing.push(...src.missing);
  target.readFailed.push(...src.readFailed);
}

/** 将文档中 src === matchSrc 的媒体节点换成 newSrc（同时记录文件大小） */
function swapNodeSrc(view: any, matchSrc: string, newSrc: string, size: number): boolean {
  const { state } = view;
  const positions: number[] = [];
  state.doc.descendants((node: any, pos: number) => {
    if (node.attrs?.src === matchSrc) positions.push(pos);
  });
  if (positions.length === 0) return false;

  const tr = state.tr;
  for (const pos of positions) {
    const node = state.doc.nodeAt(pos);
    if (!node) continue;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: newSrc, size });
  }
  view.dispatch(tr);
  return true;
}

/** 将 href === matchHref 的链接整体指向新 URL（链接型附件用） */
function swapLinkHref(view: any, matchHref: string, newHref: string): boolean {
  const { state } = view;
  const linkType = state.schema.marks.link;
  if (!linkType) return false;

  const ranges: Array<{ from: number; to: number; mark: any }> = [];
  state.doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type === linkType && mark.attrs.href === matchHref) {
        ranges.push({ from: pos, to: pos + node.nodeSize, mark });
      }
    }
  });
  if (ranges.length === 0) return false;

  let tr = state.tr;
  for (const { from, to, mark } of ranges) {
    tr = tr.removeMark(from, to, linkType);
    tr = tr.addMark(from, to, linkType.create({ ...mark.attrs, href: newHref }));
  }
  view.dispatch(tr);
  return true;
}

/**
 * 处理单个已拿到字节的文件：限额校验 → 先显示（objectURL 占位）→ 上传 → 换持久 URL。
 * 链接型附件无节点可占位，直接上传后把 href 指向存储 URL。
 */
export async function processResolvedFile(
  view: any,
  editor: any,
  ref: LocalMediaRef,
  file: File,
): Promise<ResolveOutcome> {
  const limits = getEditorAttachmentLimits(editor);
  if (limits) {
    const err = validateAttachmentFile(view.state.doc, file, limits);
    if (err) {
      toast(`${ref.basename}：${err}`, "error");
      return "limitRejected";
    }
  }

  if (ref.isLink) {
    try {
      const url = await getStorageProvider().upload(file, "editor");
      // 链接已被用户删除等情况：上传成功但无处可换，不算 uploaded
      const swapped = swapLinkHref(view, ref.src, url);
      return swapped ? "uploaded" : "sessionOnly";
    } catch (err) {
      console.error(`本地附件 ${ref.basename} 上传失败:`, err);
      toast(`「${ref.basename}」上传失败`, "error");
      return "sessionOnly";
    }
  }

  // 媒体节点：先换 objectURL 立即显示，再走共享的上传换链流程
  const objectUrl = URL.createObjectURL(file);
  const found = swapNodeSrc(view, ref.src, objectUrl, file.size);
  if (!found) {
    URL.revokeObjectURL(objectUrl);
    return "sessionOnly"; // 节点已被用户删除等，无需上传
  }
  const swapped = await uploadPlaceholder(view, file, objectUrl);
  return swapped ? "uploaded" : "sessionOnly";
}

/**
 * 用剪贴板里随文本一起粘贴的文件（basename → File）匹配引用。
 * 命中的直接从 clipboardFiles 中消费；返回命中与未命中两组。
 */
export function matchClipboardFiles(
  refs: LocalMediaRef[],
  clipboardFiles: Map<string, File>,
): { matched: Array<{ ref: LocalMediaRef; file: File }>; unmatched: LocalMediaRef[] } {
  const matched: Array<{ ref: LocalMediaRef; file: File }> = [];
  const unmatched: LocalMediaRef[] = [];
  for (const ref of refs) {
    const file = clipboardFiles.get(ref.basename);
    if (file) {
      matched.push({ ref, file });
      clipboardFiles.delete(ref.basename);
    } else {
      unmatched.push(ref);
    }
  }
  return { matched, unmatched };
}

/** 在已授权的目录里逐个找回引用对应的文件并上传换链；找不到的记入 missing，读不出的记入 readFailed。 */
export async function resolveRefsFromDirectory(
  view: any,
  editor: any,
  refs: LocalMediaRef[],
  dir: FsDirectoryHandle,
  onSuccess?: (ref: LocalMediaRef) => void,
): Promise<ResolveReport> {
  const report = createEmptyReport();
  for (const ref of refs) {
    const { file, readError } = await findFileInDirectory(dir, ref.src);
    if (!file) {
      if (readError) {
        console.warn(`本地文件「${ref.basename}」在所选文件夹中找到但读取失败:`, readError);
        report.readFailed.push(ref);
      } else {
        console.warn(`本地文件「${ref.basename}」未在所选文件夹「${dir.name}」中找到`);
        report.missing.push(ref);
      }
      continue;
    }
    const outcome = await processResolvedFile(view, editor, ref, file);
    if (outcome === "uploaded") onSuccess?.(ref);
    report[outcome]++;
  }
  return report;
}

function namesSummary(refs: LocalMediaRef[]): string {
  const names = refs.map((r) => r.basename);
  if (names.length <= 3) return names.join("、");
  return `${names.slice(0, 3).join("、")} 等 ${names.length} 个文件`;
}

/** 汇总 toast：上传成功 / 仅本次可见 / 读取失败 / 未找到，全部说清楚 */
export function reportResolveResult(report: ResolveReport): void {
  const parts: string[] = [];
  if (report.uploaded > 0) parts.push(`${report.uploaded} 个已上传至存储`);
  if (report.sessionOnly > 0) {
    parts.push(`${report.sessionOnly} 个仅本次会话可见（未配置存储或上传失败）`);
  }
  if (report.limitRejected > 0) parts.push(`${report.limitRejected} 个超出大小限制`);
  if (report.readFailed.length > 0) {
    parts.push(
      `${report.readFailed.length} 个找到但读取失败：${namesSummary(report.readFailed)}` +
        "（若在 OneDrive / WPS 云盘等同步目录，请右键文件选择「始终保留在此设备」后重试）",
    );
  }
  if (report.missing.length > 0) {
    parts.push(
      `${report.missing.length} 个未能获取：${namesSummary(report.missing)}` +
        "（可把文件直接拖进编辑器上传）",
    );
  }
  if (parts.length === 0) return;

  const allGood =
    report.uploaded > 0 && report.missing.length === 0 && report.readFailed.length === 0;
  toast(`本地文件解析完成：${parts.join("；")}`, allGood ? "success" : "info");
}

/**
 * 授权说明弹窗（纯 DOM，非 React 上下文可用）。
 * 在唤起系统目录选择器之前，先向用户解释"为什么要读文件夹"，
 * 避免突兀的系统弹窗被当成恶意行为。全部走 textContent，无 innerHTML。
 *
 * @returns "pick" 用户同意选择文件夹；"cancel" 用户放弃
 */
export function openDirectoryConsentDialog(count: number): Promise<"pick" | "cancel"> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className =
      "fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm select-none";

    const panel = document.createElement("div");
    panel.className =
      "bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-xl max-w-md w-full mx-4 border border-default-200 dark:border-zinc-700 relative overflow-hidden";

    const title = document.createElement("div");
    title.className = "text-sm font-medium text-default-800 dark:text-zinc-100 mb-2";
    title.textContent = "粘贴内容中包含本地文件";

    const msg = document.createElement("div");
    msg.className =
      "text-xs text-default-500 dark:text-zinc-400 mb-4 whitespace-pre-line leading-relaxed";
    msg.textContent =
      `检测到 ${count} 个本地图片/附件使用相对路径，粘贴时文件本体没有跟过来。\n` +
      "浏览器不能直接读取你的磁盘。请选择一个包含这些文件的文件夹" +
      "（推荐 Obsidian 库根目录，它会连同子目录一起查找），" +
      "编辑器读取后会上传到你的存储。\n" +
      "也可以选择稍后把文件直接拖进编辑器。";

    const btnRow = document.createElement("div");
    btnRow.className = "flex justify-end gap-2";

    const close = (value: "pick" | "cancel") => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(value);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("cancel");
    };
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close("cancel");
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className =
      "px-3 py-1.5 text-xs rounded-lg border border-default-200 hover:bg-default-100 text-default-700 dark:text-zinc-300 dark:border-zinc-600 dark:hover:bg-zinc-700";
    cancelBtn.textContent = "稍后处理";
    cancelBtn.addEventListener("click", () => close("cancel"));

    const pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "px-3 py-1.5 text-xs rounded-lg bg-blue-500 hover:bg-blue-600 text-white";
    pickBtn.textContent = "选择文件夹…";
    pickBtn.addEventListener("click", () => close("pick"));

    btnRow.append(cancelBtn, pickBtn);
    panel.append(title, msg, btnRow);
    overlay.appendChild(panel);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  });
}

/** 非 Chromium 降级提示：引导拖拽（同样不静默） */
export function openDragHintDialog(count: number): void {
  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm select-none";

  const panel = document.createElement("div");
  panel.className =
    "bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-xl max-w-md w-full mx-4 border border-default-200 dark:border-zinc-700";

  const title = document.createElement("div");
  title.className = "text-sm font-medium text-default-800 dark:text-zinc-100 mb-2";
  title.textContent = "粘贴内容中包含本地文件";

  const msg = document.createElement("div");
  msg.className =
    "text-xs text-default-500 dark:text-zinc-400 mb-4 whitespace-pre-line leading-relaxed";
  msg.textContent =
    `检测到 ${count} 个本地图片/附件使用相对路径，粘贴时文件本体没有跟过来。\n` +
    "当前浏览器不支持读取本地文件夹（需要 Chrome / Edge）。" +
    "请把对应的图片或文件直接拖进编辑器，会自动完成上传。";

  const btnRow = document.createElement("div");
  btnRow.className = "flex justify-end";

  const close = () => {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });

  const okBtn = document.createElement("button");
  okBtn.type = "button";
  okBtn.className = "px-3 py-1.5 text-xs rounded-lg bg-blue-500 hover:bg-blue-600 text-white";
  okBtn.textContent = "知道了";
  okBtn.addEventListener("click", close);

  btnRow.append(okBtn);
  panel.append(title, msg, btnRow);
  overlay.appendChild(panel);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

/**
 * 兜底弹窗：文件夹解析失败的引用，引导用户直接用系统文件选择器选文件。
 * 系统对话框走 OS 外壳，云同步占位文件 / 文件夹名匹配不上都能绕过。
 */
export function openPickFilesDialog(names: string[]): Promise<"pick" | "cancel"> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className =
      "fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm select-none";

    const panel = document.createElement("div");
    panel.className =
      "bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-xl max-w-md w-full mx-4 border border-default-200 dark:border-zinc-700 relative overflow-hidden";

    const title = document.createElement("div");
    title.className = "text-sm font-medium text-default-800 dark:text-zinc-100 mb-2";
    title.textContent = "选择文件直接上传";

    const msg = document.createElement("div");
    msg.className =
      "text-xs text-default-500 dark:text-zinc-400 mb-4 whitespace-pre-line leading-relaxed";
    msg.textContent =
      `还有 ${names.length} 个本地文件无法从所选文件夹读取：${names.join("、")}。\n` +
      "点击「选择文件…」后在系统对话框里选中这些文件（可多选），将直接上传到存储。" +
      "若它们位于云同步目录（OneDrive / 绿联云等），选中后会自动取回本地内容。";

    const btnRow = document.createElement("div");
    btnRow.className = "flex justify-end gap-2";

    const close = (value: "pick" | "cancel") => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(value);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("cancel");
    };
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close("cancel");
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className =
      "px-3 py-1.5 text-xs rounded-lg border border-default-200 hover:bg-default-100 text-default-700 dark:text-zinc-300 dark:border-zinc-600 dark:hover:bg-zinc-700";
    cancelBtn.textContent = "稍后处理";
    cancelBtn.addEventListener("click", () => close("cancel"));

    const pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "px-3 py-1.5 text-xs rounded-lg bg-blue-500 hover:bg-blue-600 text-white";
    pickBtn.textContent = "选择文件…";
    pickBtn.addEventListener("click", () => close("pick"));

    btnRow.append(cancelBtn, pickBtn);
    panel.append(title, msg, btnRow);
    overlay.appendChild(panel);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  });
}

/**
 * 兜底：从系统文件选择器选中的真实文件，按 basename 匹配引用后上传换链；
 * 用户取消或选了但仍有未匹配的引用，记入 missing（交给汇总 toast 说明）。
 */
export async function resolveRefsByFilePicker(
  view: any,
  editor: any,
  refs: LocalMediaRef[],
  onSuccess?: (ref: LocalMediaRef) => void,
): Promise<ResolveReport> {
  const report = createEmptyReport();
  const files = await pickLocalFiles();
  if (!files) {
    // 取消/失败：全部留在占位状态，交汇总 toast 说明
    report.missing.push(...refs);
    return report;
  }

  const byName = new Map(files.map((f) => [f.name.toLowerCase(), f] as const));
  const unmatched: LocalMediaRef[] = [];
  for (const ref of refs) {
    const file = byName.get(ref.basename);
    if (!file) {
      unmatched.push(ref);
      continue;
    }
    byName.delete(ref.basename);
    const outcome = await processResolvedFile(view, editor, ref, file);
    if (outcome === "uploaded") onSuccess?.(ref);
    report[outcome]++;
  }
  report.missing.push(...unmatched);
  return report;
}
