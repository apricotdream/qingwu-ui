import { getTextContentFromNodes, markInputRule } from "@tiptap/core";
import { Code } from "@tiptap/extension-code";

export const InlineCode = Code.extend({
  addInputRules() {
    return [
      markInputRule({
        type: this.type,
        find: (text) => {
          const { $from } = this.editor.state.selection;
          let plainTextStart = $from.parentOffset;
          while (plainTextStart > 0) {
            const { node, offset } = $from.parent.childBefore(plainTextStart);
            if (!node?.isText || node.marks.some((mark) => mark.type.spec.code)) break;
            plainTextStart = offset;
          }
          const start = Math.max(
            0,
            getTextContentFromNodes($from).length - ($from.parentOffset - plainTextStart),
          );
          const suffix = text.slice(start);
          let opening: RegExpExecArray | undefined;
          for (const delimiter of suffix.matchAll(/[`｀]+/g)) {
            if (!opening) {
              if (delimiter[0].length <= 2) opening = delimiter;
              continue;
            }
            if (delimiter[0].length !== opening[0].length) continue;
            const end = delimiter.index + delimiter[0].length;
            if (end === suffix.length) {
              return {
                index: start + opening.index,
                text: suffix.slice(opening.index),
                replaceWith: suffix.slice(opening.index + opening[0].length, delimiter.index),
              };
            }
            opening = undefined;
          }
          return null;
        },
      }),
    ];
  },
});
