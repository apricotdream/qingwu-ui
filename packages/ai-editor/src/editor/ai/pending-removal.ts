/**
 * 全文/选区替换后的孤儿媒体延迟删除：30s 延迟窗口内 undo 可救回（事务监听取消定时器），
 * 编辑器销毁时 flush 剩余孤儿。状态挂在 editor 实例（WeakMap），不随组件卸载丢失。
 */
import type { Editor } from "@tiptap/core";
import { removeStoredResource } from "../storage/remove-resource";

/** 孤儿资源延迟删除窗口（ms）：窗口内 undo 可救回，到点仍不在文档里才真删 */
const ORPHAN_DELETE_DELAY_MS = 30_000;

const MEDIA_NODE_NAMES = new Set(["image", "attachmentEmbed", "audioEmbed", "videoEmbed"]);

interface PendingState {
  timers: Map<string, ReturnType<typeof setTimeout>>;
  onTransaction: () => void;
  listening: boolean;
}

const stateByEditor = new WeakMap<Editor, PendingState>();

/** 当前文档内出现的媒体 URL 集合 */
function presentUrls(editor: Editor): Set<string> {
  const urls = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (MEDIA_NODE_NAMES.has(node.type.name)) {
      const src = (node.attrs as { src?: string | null }).src;
      if (src) urls.add(src);
    }
    return true;
  });
  return urls;
}

function ensureState(editor: Editor): PendingState {
  let state = stateByEditor.get(editor);
  if (!state) {
    state = { timers: new Map(), onTransaction: () => {}, listening: false };
    stateByEditor.set(editor, state);
  }
  return state;
}

/** 调度孤儿资源延迟删除；同一 URL 已在队列不重复挂，undo 还原时取消对应定时器 */
export function scheduleOrphanRemoval(editor: Editor, orphans: string[]): void {
  const urls = [...new Set(orphans.filter(Boolean))];
  if (urls.length === 0) return;
  const state = ensureState(editor);

  if (!state.listening) {
    state.onTransaction = () => {
      if (state.timers.size === 0) return;
      const present = presentUrls(editor);
      for (const [url, timer] of state.timers) {
        if (present.has(url)) {
          clearTimeout(timer);
          state.timers.delete(url);
        }
      }
    };
    editor.on("transaction", state.onTransaction);
    state.listening = true;
  }

  for (const url of urls) {
    if (state.timers.has(url)) continue;
    const timer = setTimeout(() => {
      // 到点复核：URL 若已回到文档（undo），不再删
      const present = presentUrls(editor);
      if (!present.has(url)) {
        void removeStoredResource(url);
      }
      state.timers.delete(url);
    }, ORPHAN_DELETE_DELAY_MS);
    state.timers.set(url, timer);
  }
}

/** 编辑器销毁时调用：取消所有待删定时器，对仍不在文档里的孤儿立即删存储。 */
export function flushPendingRemovals(editor: Editor): void {
  const state = stateByEditor.get(editor);
  if (!state) return;
  if (state.listening) {
    editor.off("transaction", state.onTransaction);
    state.listening = false;
  }
  if (state.timers.size > 0) {
    const present = presentUrls(editor);
    for (const [url, timer] of state.timers) {
      clearTimeout(timer);
      if (!present.has(url)) void removeStoredResource(url);
    }
    state.timers.clear();
  }
  stateByEditor.delete(editor);
}
