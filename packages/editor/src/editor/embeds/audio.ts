/** 音频嵌入节点（audioEmbed）：粘贴音频链接时自动识别为音频块。 */
import { Node } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AudioEmbedView } from "./audio-view";

function detectAudio(src: string): boolean {
  return (
    /\.(mp3|wav|ogg|flac|aac|m4a|wma|opus)(\?|$)/i.test(src) ||
    /\/.*\.(mp3|wav|ogg|flac)/i.test(src)
  );
}

export const AudioEmbed = Node.create({
  name: "audioEmbed",
  group: "block",
  atom: true,
  inline: false,

  addNodeView() {
    return ReactNodeViewRenderer(AudioEmbedView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const raw = event.clipboardData?.getData("text/plain");
            if (!raw) return false;

            const lines = raw.split(/\r?\n/);
            for (const line of lines) {
              const text = line.trim();
              if (!text || text.includes(" ")) continue;
              if (!detectAudio(text)) continue;

              event.preventDefault();
              const node = view.state.schema.nodes.audioEmbed.create({ src: text });
              view.dispatch(view.state.tr.replaceSelectionWith(node));
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },

  addAttributes() {
    return {
      src: { default: null },
      name: { default: "" },
      size: {
        default: 0,
        parseHTML: (element) => Number((element as HTMLElement).getAttribute("data-size") || 0),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-audio-embed]" }, { tag: "audio[src]" }];
  },

  renderHTML({ HTMLAttributes }: any) {
    return [
      "div",
      {
        "data-audio-embed": "true",
        "data-size": HTMLAttributes.size || 0,
        class: "audio-embed",
      },
      ["audio", { src: HTMLAttributes.src, controls: "true", style: "width:100%;" }],
    ];
  },
});
