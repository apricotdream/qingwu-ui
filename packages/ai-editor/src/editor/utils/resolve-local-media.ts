/**
 * 本地媒体解析：粘贴的相对路径附件 → 读取真实文件 → 上传存储 → 换链。
 * 两级策略：剪贴板文件按 basename 静默匹配上传；否则目录授权后按相对路径找回。
 * 不支持目录读取的浏览器降级为拖拽引导；读盘仅发生在用户授权后。
 */
import { toast } from "../../components/toast";
import { getEditorAttachmentLimits, validateAttachmentFile } from "../attachment-limits";
import { getStorageProvider } from "../storage";
import {
  type FsDirectoryHandle,
  findFileInDirectory,
  type LocalMediaRef,
  pickLocalFiles,
} from "./local-media";
import { verifyImageRenderable } from "./render-probe";

/** 单个引用的解析结果 */
export type ResolveOutcome = "uploaded" | "sessionOnly" | "limitRejected" | "renderFailed";

export interface ResolveReport {
  uploaded: number;
  sessionOnly: number;
  limitRejected: number;
  /** 换链成功但浏览器渲染失败，不计入已上传 */
  renderFailed: number;
  missing: LocalMediaRef[];
  /** 在目录里找到了同名文件，但读不出字节（云同步占位文件等） */
  readFailed: LocalMediaRef[];
}

export function createEmptyReport(): ResolveReport {
  return {
    uploaded: 0,
    sessionOnly: 0,
    limitRejected: 0,
    renderFailed: 0,
    missing: [],
    readFailed: [],
  };
}

export function mergeReports(target: ResolveReport, src: ResolveReport): void {
  target.uploaded += src.uploaded;
  target.sessionOnly += src.sessionOnly;
  target.limitRejected += src.limitRejected;
  target.renderFailed += src.renderFailed;
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
 * 按同一文件归组：同一文件常同时有 <img> 节点与 Open: 链接两种形态，
 * 归组后整组只读取/上传一次、共享同一 URL。
 */
export function groupRefsByFile(refs: LocalMediaRef[]): LocalMediaRef[][] {
  const map = new Map<string, LocalMediaRef[]>();
  for (const ref of refs) {
    const group = map.get(ref.normalized);
    if (group) group.push(ref);
    else map.set(ref.normalized, [ref]);
  }
  return Array.from(map.values());
}

/**
 * 处理指向同一文件的一组引用：限额校验 → 节点先 objectURL 预览 → 只上传一次 →
 * 统一换持久 URL，只计一次（修复同文件被上传两次、计数翻倍的问题）。
 */
export async function processResolvedFileGroup(
  view: any,
  editor: any,
  refs: LocalMediaRef[],
  file: File,
): Promise<ResolveOutcome> {
  if (refs.length === 0) return "sessionOnly";
  const first = refs[0];

  const limits = getEditorAttachmentLimits(editor);
  if (limits) {
    const err = validateAttachmentFile(view.state.doc, file, limits);
    if (err) {
      toast(`${first.basename}：${err}`, "error");
      return "limitRejected";
    }
  }

  const nodeRefs = refs.filter((r) => !r.isLink);
  const linkRefs = refs.filter((r) => r.isLink);

  // 纯链接型附件（无媒体节点）：上传一次，所有链接指向同一 URL
  if (nodeRefs.length === 0) {
    try {
      const url = await getStorageProvider().upload(file, "editor");
      let swapped = false;
      for (const ref of linkRefs) {
        if (swapLinkHref(view, ref.src, url)) swapped = true;
      }
      // 链接已被用户删除等情况：上传成功但无处可换，不算 uploaded
      return swapped ? "uploaded" : "sessionOnly";
    } catch (err) {
      console.error(`本地附件 ${first.basename} 上传失败:`, err);
      toast(`「${first.basename}」上传失败`, "error");
      return "sessionOnly";
    }
  }

  // 含媒体节点：先换 objectURL 预览，再统一上传换持久 URL
  const objectUrl = URL.createObjectURL(file);
  let nodeSwapped = false;
  for (const ref of nodeRefs) {
    if (swapNodeSrc(view, ref.src, objectUrl, file.size)) nodeSwapped = true;
  }

  let url: string;
  try {
    url = await getStorageProvider().upload(file, "editor");
  } catch (err) {
    console.error(`本地文件 ${first.basename} 上传失败:`, err);
    toast(`「${first.basename}」上传失败`, "error");
    URL.revokeObjectURL(objectUrl);
    return "sessionOnly";
  }
  URL.revokeObjectURL(objectUrl);

  if (nodeSwapped) swapNodeSrc(view, objectUrl, url, file.size); // 所有预览节点 → 持久 URL
  for (const ref of linkRefs) swapLinkHref(view, ref.src, url);

  if (!nodeSwapped && linkRefs.length === 0) return "sessionOnly"; // 节点已删且无链接可换

  // 图片需探针真实渲染才计已上传；非图片无解码探针，按换链成功计数
  if (nodeSwapped && refs.some((r) => r.kind === "image")) {
    return (await verifyImageRenderable(url)) ? "uploaded" : "renderFailed";
  }
  return "uploaded";
}

/** 单引用解析（单元素组的特例，保留旧签名供既有调用与测试使用） */
export async function processResolvedFile(
  view: any,
  editor: any,
  ref: LocalMediaRef,
  file: File,
): Promise<ResolveOutcome> {
  return processResolvedFileGroup(view, editor, [ref], file);
}

/**
 * 用剪贴板携带的文件（basename → File）按组匹配引用；命中整组消费，返回命中与未命中。
 */
export function matchClipboardFiles(
  refs: LocalMediaRef[],
  clipboardFiles: Map<string, File>,
): { matched: Array<{ refs: LocalMediaRef[]; file: File }>; unmatched: LocalMediaRef[] } {
  const matched: Array<{ refs: LocalMediaRef[]; file: File }> = [];
  const unmatched: LocalMediaRef[] = [];
  for (const group of groupRefsByFile(refs)) {
    const rep = group[0];
    const file = clipboardFiles.get(rep.basename);
    if (file) {
      matched.push({ refs: group, file });
      clipboardFiles.delete(rep.basename);
    } else {
      unmatched.push(...group);
    }
  }
  return { matched, unmatched };
}

/**
 * 在授权目录按组找回并上传换链；找不到记 missing，读不出记 readFailed（每组计一次）。
 */
export async function resolveRefsFromDirectory(
  view: any,
  editor: any,
  refs: LocalMediaRef[],
  dir: FsDirectoryHandle,
): Promise<ResolveReport> {
  const report = createEmptyReport();
  for (const group of groupRefsByFile(refs)) {
    const rep = group[0];
    const { file, readError } = await findFileInDirectory(dir, rep.src);
    if (!file) {
      if (readError) {
        console.warn(`本地文件「${rep.basename}」在所选文件夹中找到但读取失败:`, readError);
        report.readFailed.push(rep);
      } else {
        console.warn(`本地文件「${rep.basename}」未在所选文件夹「${dir.name}」中找到`);
        report.missing.push(rep);
      }
      continue;
    }
    const outcome = await processResolvedFileGroup(view, editor, group, file);
    report[outcome]++;
  }
  return report;
}

function namesSummary(refs: LocalMediaRef[]): string {
  const names = refs.map((r) => r.basename);
  if (names.length <= 3) return names.join("、");
  return `${names.slice(0, 3).join("、")} 等 ${names.length} 个文件`;
}

/** 汇总 toast：成功/仅本次/读取失败/未找到全部说清 */
export function reportResolveResult(report: ResolveReport): void {
  const parts: string[] = [];
  if (report.uploaded > 0) parts.push(`${report.uploaded} 个已上传至存储`);
  if (report.sessionOnly > 0) {
    parts.push(`${report.sessionOnly} 个仅本次会话可见（未配置存储或上传失败）`);
  }
  if (report.limitRejected > 0) parts.push(`${report.limitRejected} 个超出大小限制`);
  if (report.renderFailed > 0) {
    parts.push(`${report.renderFailed} 个上传成功但页面渲染失败（存储 URL 无法在浏览器访问/解码）`);
  }
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
    report.uploaded > 0 &&
    report.renderFailed === 0 &&
    report.missing.length === 0 &&
    report.readFailed.length === 0;
  toast(`本地文件解析完成：${parts.join("；")}`, allGood ? "success" : "info");
}

/**
 * 授权说明弹窗（纯 DOM）：选目录前向用户解释读取原因，避免系统弹窗突兀；全 textContent 防 XSS。
 * @returns "pick" 同意选文件夹；"cancel" 放弃
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

/** 非 Chromium 降级提示：引导拖拽 */
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

/** 兜底弹窗：文件夹解析失败时引导用系统文件选择器（绕开云占位/匹配不上） */
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
 * 兜底：用系统选择器选中的文件按 basename 匹配上传换链；
 * 取消或未匹配的组记入 missing，交汇总 toast 说明。
 */
export async function resolveRefsByFilePicker(
  view: any,
  editor: any,
  refs: LocalMediaRef[],
): Promise<ResolveReport> {
  const report = createEmptyReport();
  const groups = groupRefsByFile(refs);
  const files = await pickLocalFiles();
  if (!files) {
    // 取消/失败：每组记一个 missing，交汇总 toast
    for (const group of groups) report.missing.push(group[0]);
    return report;
  }

  const byName = new Map(files.map((f) => [f.name.toLowerCase(), f] as const));
  for (const group of groups) {
    const rep = group[0];
    const file = byName.get(rep.basename);
    if (!file) {
      report.missing.push(rep);
      continue;
    }
    byName.delete(rep.basename);
    const outcome = await processResolvedFileGroup(view, editor, group, file);
    report[outcome]++;
  }
  return report;
}
