import { Mark, mergeAttributes } from "@tiptap/core";
import type { Mark as ProseMirrorMark, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Selection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { t } from "../i18n";
import { escapeHtml } from "../utils/sanitize";
import { createTextNoteMarker } from "../utils/text-note-preview";

export const TEXT_NOTE = "textNote";

interface NoteRange {
  from: number;
  to: number;
  mark: ProseMirrorMark;
}

function noteRanges(doc: ProseMirrorNode, offset = 0): NoteRange[] {
  const ranges: NoteRange[] = [];
  doc.descendants((node, position) => {
    if (!node.isText) return;
    const mark = node.marks.find((item) => item.type.name === TEXT_NOTE);
    if (!mark) return;
    const from = offset + position;
    const last = ranges.at(-1);
    const to = from + node.nodeSize;
    if (last?.to === from && mark.eq(last.mark)) last.to = to;
    else ranges.push({ from, to, mark });
  });
  return ranges;
}

export function getTextNoteSelection(doc: ProseMirrorNode, selection: Selection) {
  const { $from, $to, from, to } = selection;
  const type = doc.type.schema.marks[TEXT_NOTE];
  if (
    !type ||
    selection.empty ||
    !$from.sameParent($to) ||
    !$from.parent.isTextblock ||
    !$from.parent.type.allowsMarkType(type) ||
    !doc.textBetween(from, to).trim()
  )
    return null;
  let canAnnotate = true;
  doc.nodesBetween(from, to, (node) => {
    if (
      node.isInline &&
      (!node.isText || node.marks.some((mark) => mark.type !== type && mark.type.excludes(type)))
    ) {
      canAnnotate = false;
    }
  });
  if (!canAnnotate) return null;
  const matches = noteRanges($from.parent, $from.start()).filter(
    (note) => note.from < to && note.to > from,
  );
  if (matches.length > 1) return null;
  return matches[0] ?? { from, to, mark: null };
}

function decorations(doc: ProseMirrorNode) {
  return DecorationSet.create(
    doc,
    noteRanges(doc).map(({ to, mark }, index) =>
      Decoration.widget(
        to,
        (view) =>
          createTextNoteMarker(
            view.dom.ownerDocument,
            String(mark.attrs.text),
            index + 1,
            t("editor.bubble.viewNote"),
          ),
        {
          side: -1,
          key: JSON.stringify([mark.attrs.id, index, mark.attrs.text]),
          stopEvent: () => true,
        },
      ),
    ),
  );
}

export const TextNote = Mark.create({
  name: TEXT_NOTE,
  priority: 1100,
  inclusive: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-qw-note-id"),
        renderHTML: ({ id }) => ({ "data-qw-note-id": id }),
      },
      text: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-qw-text-note"),
        renderHTML: ({ text }) => ({ "data-qw-text-note": text }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-qw-text-note]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ class: "qw-text-note" }, HTMLAttributes), 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "",
          close: (state: { esc: (text: string) => string }, mark: ProseMirrorMark) =>
            `（${state.esc(escapeHtml(String(mark.attrs.text)))}）`,
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>("qingwuTextNote");
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_config, state) => decorations(state.doc),
          apply: (tr, previous) => (tr.docChanged ? decorations(tr.doc) : previous),
        },
        props: {
          decorations: (state) => key.getState(state),
        },
      }),
    ];
  },
});
