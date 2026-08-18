/**
 * 全文替换/选区替换后的孤儿资源延迟删除。
 *
 * 设计（宿主确认）：
 * - 替换后「旧文档有、新文档无」的媒体 URL 为孤儿，异步从存储删除；
 * - 删除有 30s 延迟窗口：期间用户 undo（Ctrl+Z）把 URL 还原回文档，
 *   事务监听会取消对应定时器，避免「undo 后图片 404」；
 * - 编辑器销毁（组件卸载）时 flush 剩余孤儿。
 *
 * 状态挂在 editor 实例上（WeakMap），不随 AISelector 组件卸载而丢失。
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

/**
 * 调度孤儿资源延迟删除。同一 URL 已在待删队列时不重复挂。
 * undo 还原 URL → 事务监听取消对应定时器。
 */
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
