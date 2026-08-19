/**
 * RelativeMedia 扩展：粘贴外部 Markdown 后自动解析本地相对路径图片/附件。
 * 观察粘贴后落入文档的节点（本地 src/href），appendTransaction 微任务扫描；
 * 文档为唯一事实来源，失败（取消/未找到/读取失败）暂停至下次粘贴。
 * 解析编排委托 resolve-local-media.ts。
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { toast } from "../../components/toast";
import { ownedUrlChecker } from "../storage";
import {
  collectLocalMediaRefs,
  type FsDirectoryHandle,
  filePickerSupported,
  fsAccessSupported,
  type LocalMediaRef,
  pickDirectory,
} from "../utils/local-media";
import {
  createEmptyReport,
  groupRefsByFile,
  matchClipboardFiles,
  mergeReports,
  openDirectoryConsentDialog,
  openDragHintDialog,
  openPickFilesDialog,
  processResolvedFileGroup,
  reportResolveResult,
  resolveRefsByFilePicker,
  resolveRefsFromDirectory,
} from "../utils/resolve-local-media";

/** RelativeMedia 的 storage 形状（clipboardFiles / pausedUntilPaste 由粘贴路径写入） */
export interface RelativeMediaStorage {
  /** 最近一次粘贴时剪贴板里的文件（basename 小写 → File） */
  clipboardFiles: Map<string, File>;
  /** 上一轮编排以遗留结束时暂停探测；新粘贴（任一粘贴路径）清除并重试 */
  pausedUntilPaste: boolean;
}

export const RelativeMedia = Extension.create({
  name: "relativeMedia",

  addStorage(): RelativeMediaStorage {
    return { clipboardFiles: new Map(), pausedUntilPaste: false };
  },

  addProseMirrorPlugins() {
    const editor = this.editor as any;
    const storage = this.storage as RelativeMediaStorage;
    /** 是否有一轮编排（含收尾轮）正在进行 */
    let busy = false;
    /** 最近一次成功授权的目录句柄：收尾轮直接复用，避免二次授权弹窗 */
    let lastDir: FsDirectoryHandle | null = null;

    const runResolution = async (
      refs: LocalMediaRef[],
      preferredDir?: FsDirectoryHandle | null,
    ): Promise<void> => {
      const view = editor.view;
      const report = createEmptyReport();

      // 1) 剪贴板文件：按文件归组、basename 匹配后静默上传（同组只传一次），不打扰用户
      const { matched, unmatched } = matchClipboardFiles(refs, storage.clipboardFiles);
      for (const { refs: group, file } of matched) {
        const outcome = await processResolvedFileGroup(view, editor, group, file);
        report[outcome]++;
      }

      // 2) 剩余引用：目录授权（Chromium）或拖拽降级；读盘只在用户明确同意后发生
      if (unmatched.length > 0) {
        // 面向用户的数量按"文件"口径（同组节点+链接只算一个文件），与上传/计数口径一致
        const pendingFileCount = groupRefsByFile(unmatched).length;
        if (fsAccessSupported()) {
          // 收尾轮复用已授权目录（同一轮编排内用户已同意过读这个文件夹）
          let dir: FsDirectoryHandle | null = preferredDir ?? null;
          if (!dir) {
            const choice = await openDirectoryConsentDialog(pendingFileCount);
            if (choice === "pick") {
              dir = await pickDirectory();
              if (!dir) {
                toast(
                  "没有选择文件夹。本地文件暂以占位显示，稍后可直接把文件拖进编辑器上传",
                  "info",
                );
              }
            } else {
              toast("已选择稍后处理。本地文件暂以占位显示，可直接把文件拖进编辑器上传", "info");
            }
          }
          if (dir) {
            lastDir = dir;
            const dirReport = await resolveRefsFromDirectory(view, editor, unmatched, dir);
            mergeReports(report, dirReport);
            // 兜底：文件夹方式仍有遗漏（云占位/文件夹不匹配）时，引导直接选文件
            const stragglers = [...report.missing, ...report.readFailed];
            if (stragglers.length > 0 && filePickerSupported()) {
              const pickChoice = await openPickFilesDialog(stragglers.map((r) => r.basename));
              if (pickChoice === "pick") {
                const pickReport = await resolveRefsByFilePicker(view, editor, stragglers);
                mergeReports(report, pickReport);
                // 原 missing/readFailed 已被兜底尝试过一轮，最终结果以 pickReport 为准
                report.missing = pickReport.missing;
                report.readFailed = [];
              }
            }
          }
        } else {
          openDragHintDialog(pendingFileCount);
        }
      }

      reportResolveResult(report);
    };

    const maybeResolve = (): void => {
      if (!editor || editor.isDestroyed) return;
      if (storage.pausedUntilPaste) return;
      // 宿主 owns 判定：其自有资源（上传返回的站内相对路径）不算本地引用
      const isOwned = ownedUrlChecker();
      const fresh = collectLocalMediaRefs(editor.state.doc, isOwned);
      if (fresh.length === 0 || busy) return;

      busy = true;
      const runSrcs = new Set(fresh.map((r) => r.src));
      void runResolution(fresh)
        .then(() => {
          if (editor.isDestroyed) return;
          // 收尾：补扫 busy 期间出现的新引用；本轮已处理的 src 不重跑，留给下次粘贴重试
          const next = collectLocalMediaRefs(editor.state.doc, isOwned).filter(
            (r) => !runSrcs.has(r.src),
          );
          if (next.length === 0) return;
          return runResolution(next, lastDir);
        })
        .finally(() => {
          busy = false;
          if (!editor || editor.isDestroyed) return;
          // 仍有未解析引用：暂停探测至下次粘贴，避免每次击键都弹窗
          storage.pausedUntilPaste = collectLocalMediaRefs(editor.state.doc, isOwned).length > 0;
        });
    };

    return [
      new Plugin({
        key: new PluginKey("relativeMedia"),
        props: {
          handlePaste(_view, event) {
            // 暂存剪贴板文件供按名匹配；新粘贴解除暂停；不拦截粘贴
            const files = event.clipboardData?.files;
            storage.clipboardFiles = new Map(
              Array.from(files ?? []).map((f) => [f.name.toLowerCase(), f] as const),
            );
            storage.pausedUntilPaste = false;
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
