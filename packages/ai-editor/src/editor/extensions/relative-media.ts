/**
 * RelativeMedia 扩展：粘贴外部 Markdown（Obsidian / Typora 等）后，自动发现并解析
 * 文中的"本地相对路径图片/附件"。
 *
 * 工作方式：
 * - 不依赖剪贴板文本里是否有 `[[`，而是**观察粘贴后落入文档的节点**——
 *   image / videoEmbed / audioEmbed / attachmentEmbed 的本地 src，以及链接型附件的本地 href。
 *   这样 Obsidian（markdown 粘贴）与 Typora（HTML 粘贴）都能被统一捕获。
 * - 用 `appendTransaction` 在每次文档变化后微任务里扫描新出现的本地引用；
 *   **成功**解析过的引用记入 `resolved`（失败/取消不记账，允许重试），避免打字时反复弹窗。
 * - 解析编排（先剪贴板文件静默上传，再目录授权 / 拖拽降级）委托 `resolve-local-media.ts`。
 *
 * 剪贴板文件暂存在扩展 storage（`clipboardFiles`），由本扩展与 `ai-editor` 的粘贴处理共同写入，
 * 以兼容不同来源的粘贴分流顺序。
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { toast } from "../../components/toast";
import {
  collectLocalMediaRefs,
  filePickerSupported,
  fsAccessSupported,
  type LocalMediaRef,
  pickDirectory,
} from "../utils/local-media";
import {
  createEmptyReport,
  matchClipboardFiles,
  mergeReports,
  openDirectoryConsentDialog,
  openDragHintDialog,
  openPickFilesDialog,
  processResolvedFile,
  reportResolveResult,
  resolveRefsByFilePicker,
  resolveRefsFromDirectory,
} from "../utils/resolve-local-media";

/** RelativeMedia 的 storage 形状（clipboardFiles 由粘贴路径写入） */
export interface RelativeMediaStorage {
  /** 最近一次粘贴时剪贴板里的文件（basename 小写 → File） */
  clipboardFiles: Map<string, File>;
}

export const RelativeMedia = Extension.create({
  name: "relativeMedia",

  addStorage(): RelativeMediaStorage {
    return { clipboardFiles: new Map() };
  },

  addProseMirrorPlugins() {
    const editor = this.editor as any;
    const storage = this.storage as RelativeMediaStorage;
    /** 已成功解析的引用（src）——成功才记账，失败/取消/被吞的竞态都允许重试 */
    const resolved = new Set<string>();
    /** busy 期间新出现的引用，收尾后再跑一轮 */
    let pending: LocalMediaRef[] = [];
    let busy = false;

    const runResolution = async (refs: LocalMediaRef[]): Promise<void> => {
      const view = editor.view;
      const report = createEmptyReport();
      const markResolved = (ref: LocalMediaRef) => resolved.add(ref.src);

      // 1) 剪贴板文件：按 basename 匹配后静默上传，不打扰用户
      const { matched, unmatched } = matchClipboardFiles(refs, storage.clipboardFiles);
      for (const { ref, file } of matched) {
        const outcome = await processResolvedFile(view, editor, ref, file);
        if (outcome === "uploaded") markResolved(ref);
        report[outcome]++;
      }

      // 2) 剩余引用：目录授权（Chromium）或拖拽降级；读盘只在用户明确同意后发生
      if (unmatched.length > 0) {
        if (fsAccessSupported()) {
          const choice = await openDirectoryConsentDialog(unmatched.length);
          if (choice === "pick") {
            const dir = await pickDirectory();
            if (dir) {
              const dirReport = await resolveRefsFromDirectory(
                view,
                editor,
                unmatched,
                dir,
                markResolved,
              );
              mergeReports(report, dirReport);
              // 兜底：文件夹方式仍有遗漏（云占位/文件夹不匹配）时，引导直接选文件
              const stragglers = [...report.missing, ...report.readFailed];
              if (stragglers.length > 0 && filePickerSupported()) {
                const pickChoice = await openPickFilesDialog(stragglers.map((r) => r.basename));
                if (pickChoice === "pick") {
                  const pickReport = await resolveRefsByFilePicker(
                    view,
                    editor,
                    stragglers,
                    markResolved,
                  );
                  mergeReports(report, pickReport);
                  // 原 missing/readFailed 已被兜底尝试过一轮，最终结果以 pickReport 为准
                  report.missing = pickReport.missing;
                  report.readFailed = [];
                }
              }
            } else {
              toast("没有选择文件夹。本地文件暂以占位显示，稍后可直接把文件拖进编辑器上传", "info");
            }
          } else {
            toast("已选择稍后处理。本地文件暂以占位显示，可直接把文件拖进编辑器上传", "info");
          }
        } else {
          openDragHintDialog(unmatched.length);
        }
      }

      reportResolveResult(report);
    };

    const maybeResolve = (): void => {
      if (!editor || editor.isDestroyed) return;
      const fresh = collectLocalMediaRefs(editor.state.doc).filter((r) => !resolved.has(r.src));
      if (fresh.length === 0) return;
      if (busy) {
        for (const r of fresh) {
          if (!pending.some((p) => p.src === r.src)) pending.push(r);
        }
        return;
      }
      busy = true;
      void runResolution(fresh)
        .then(() => {
          const hadPending = pending.length > 0;
          pending = [];
          if (!hadPending || editor.isDestroyed) return;
          // pending 只是"有新引用出现"的信号：收尾时重新扫描文档，
          // 本轮已换链的引用不再重复处理（多图场景下避免二次授权弹窗）
          const next = collectLocalMediaRefs(editor.state.doc).filter(
            (r) => !resolved.has(r.src),
          );
          if (next.length > 0) return runResolution(next);
        })
        .finally(() => {
          busy = false;
        });
    };

    return [
      new Plugin({
        key: new PluginKey("relativeMedia"),
        props: {
          handlePaste(_view, event) {
            // 暂存剪贴板文件（若有），供后续按名匹配；不拦截粘贴本身
            const files = event.clipboardData?.files;
            storage.clipboardFiles = new Map(
              Array.from(files ?? []).map((f) => [f.name.toLowerCase(), f] as const),
            );
            return false;
          },
        },
        appendTransaction(transactions) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          // 延迟到微任务，确保读到粘贴后的最新文档，且不在 dispatch 中再 dispatch
          queueMicrotask(maybeResolve);
          return null;
        },
      }),
    ];
  },
});
