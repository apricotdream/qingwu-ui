import type { Node } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** 插入媒体后进入其下方的空段落；插入与光标移动共用一次事务，方便撤销。 */
export function insertMediaTransaction(tr: Transaction, media: Node, pos?: number) {
  if (pos === undefined) tr.replaceSelectionWith(media);
  else tr.insert(pos, media);

  let after = 0;
  tr.doc.descendants((node, nodePos) => {
    if (node === media) after = nodePos + node.nodeSize;
  });
  if (!after) return false;

  const next = tr.doc.nodeAt(after);
  if (next?.type.name !== "paragraph" || next.content.size !== 0) {
    tr.insert(after, tr.doc.type.schema.nodes.paragraph.create());
  }
  tr.setSelection(TextSelection.create(tr.doc, after + 1));
  return true;
}

export function insertMedia(view: EditorView, media: Node, pos?: number) {
  const tr = view.state.tr;
  if (!insertMediaTransaction(tr, media, pos)) return false;
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}
