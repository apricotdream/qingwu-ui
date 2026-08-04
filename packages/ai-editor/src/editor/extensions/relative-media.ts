/**
 * RelativeMedia 扩展：粘贴外部 Markdown（Obsidian / Typora 等）后，自动发现并解析
 * 文中的"本地相对路径图片/附件"。
 *
 * 工作方式：
 * - 不依赖剪贴板文本里是否有 `[[`，而是**观察粘贴后落入文档的节点**——
 *   image / videoEmbed / audioEmbed / attachmentEmbed 的本地 src，以及链接型附件的本地 href。
 *   这样 Obsidian（markdown 粘贴）与 Typora（HTML 粘贴）都能被统一捕获。
 * - 用 `appendTransaction` 在每次文档变化后微任务里扫描新出现的本地引用；
 *   已处理过的引用记入 `processed`，避免打字时反复弹窗。
 * - 解析编排（先剪贴板文件静默上传，再目录授权 / 拖拽降级）委托 `resolve-local-media.ts`。
 *
 * 剪贴板文件暂存在扩展 storage（`clipboardFiles`），由本扩展与 `ai-editor` 的粘贴处理共同写入，
 * 以兼容不同来源的粘贴分流顺序。
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  collectLocalMediaRefs,
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
  processResolvedFile,
  reportResolveResult,
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
    /** 已触发过解析流程的引用（src），避免反复弹窗 */
    const processed = new Set<string>();
    let busy = false;

    const runResolution = async (refs: LocalMediaRef[]): Promise<void> => {
      const view = editor.view;
      const report = createEmptyReport();

      // 1) 剪贴板文件：按 basename 匹配后静默上传，不打扰用户
      const { matched, unmatched } = matchClipboardFiles(refs, storage.clipboardFiles);
      for (const { ref, file } of matched) {
        const outcome = await processResolvedFile(view, editor, ref, file);
        report[outcome]++;
      }

      // 2) 剩余引用：目录授权（Chromium）或拖拽降级；读盘只在用户明确同意后发生
      if (unmatched.length > 0) {
        if (fsAccessSupported()) {
          const choice = await openDirectoryConsentDialog(unmatched.length);
          if (choice === "pick") {
            const dir = await pickDirectory();
            if (dir) {
              const dirReport = await resolveRefsFromDirectory(view, editor, unmatched, dir);
              mergeReports(report, dirReport);
            }
          }
        } else {
          openDragHintDialog(unmatched.length);
        }
      }

      reportResolveResult(report);
    };

    const maybeResolve = (): void => {
      if (busy || !editor || editor.isDestroyed) return;
      const refs = collectLocalMediaRefs(editor.state.doc).filter((r) => !processed.has(r.src));
      if (refs.length === 0) return;
      for (const r of refs) processed.add(r.src);
      busy = true;
      void runResolution(refs).finally(() => {
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
