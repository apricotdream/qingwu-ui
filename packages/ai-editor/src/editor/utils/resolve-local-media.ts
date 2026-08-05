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
  /** 换链成功但存储 URL 在浏览器里渲染/解码失败——不计入"已上传"，如实上报 */
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
 * 把引用按"同一文件"归组（归一化路径相同即同一文件）。
 * 同一文件常同时以 `<img>` 节点与 `Open: xxx` 链接两种形态出现（Obsidian 导出常见形状），
 * 归组后整组只读取/上传一次、只计一次，组内所有节点与链接共享同一个存储 URL。
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
 * 处理"指向同一文件"的一组引用：限额校验 → 节点先 objectURL 预览 → **只上传一次** →
 * 组内所有媒体节点与链接统一换成同一个持久 URL，结果只计一次。
 *
 * 修复一张图既有 `<img>` 节点又有同路径 `Open:` 链接时，同文件被上传两次、
 * "已上传"计数翻倍（5 张图报成 10 个）的问题。
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

  // 含媒体节点：全部先换 objectURL 立即预览，再统一上传、统一换成持久 URL
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

  // 只有图片真实渲染出来才计"已上传"（探针与 ImageView 私有桶回退一致）；
  // 非图片节点（video/audio/attachment）无 Image 解码探针可用，按换链成功计数
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
 * 用剪贴板里随文本一起粘贴的文件（basename → File）匹配引用。
 * 按文件归组后整组匹配：一个剪贴板文件服务同组的全部引用（节点 + 链接），
 * 命中即从 clipboardFiles 中消费；返回命中（整组）与未命中两组。
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
 * 在已授权的目录里按文件归组找回并上传换链：同组只查找/读取/上传一次、只计一次；
 * 找不到记入 missing，读不出记入 readFailed（均以组为代表，不重复计数）。
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

/** 汇总 toast：上传成功 / 仅本次可见 / 读取失败 / 未找到，全部说清楚 */
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
 * 兜底：从系统文件选择器选中的真实文件，按文件归组、以 basename 匹配后上传换链；
 * 同组只上传一次、只计一次；用户取消或选了但仍有未匹配的组，记入 missing（交汇总 toast 说明）。
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
    // 取消/失败：全部留在占位状态，交汇总 toast 说明（每组记一个，不重复）
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
