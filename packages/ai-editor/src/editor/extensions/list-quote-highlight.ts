import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** 列表当前行与引用整块只做视图装饰，不写入文档或撤销记录。 */
export const ListQuoteHighlight = Extension.create({
  name: "listQuoteHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            const { $head, empty } = state.selection;
            if (
              !this.editor.isFocused ||
              !empty ||
              !["paragraph", "heading"].includes($head.parent.type.name)
            )
              return DecorationSet.empty;
            const decorations: Decoration[] = [];
            let foundListItem = false;
            for (let depth = $head.depth - 1; depth > 0; depth--) {
              const name = $head.node(depth).type.name;
              if (name === "listItem" && !foundListItem) {
                foundListItem = true;
                decorations.push(
                  Decoration.node($head.before(), $head.after(), { class: "qw-active-row" }),
                  Decoration.node($head.before(depth), $head.after(depth), {
                    class: "qw-active-list-item",
                  }),
                );
              }
              if (name === "blockquote") {
                decorations.push(
                  Decoration.node($head.before(depth), $head.after(depth), {
                    class: "qw-active-quote",
                  }),
                );
                break;
              }
            }
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
