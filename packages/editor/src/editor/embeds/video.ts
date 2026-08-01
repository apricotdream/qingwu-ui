import { Node } from "@tiptap/core";
import { NodeSelection, Plugin } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { VideoEmbedView } from "./video-view";

export type VideoSource = "bilibili" | "xiaohongshu" | "direct" | "unknown";

function detectSource(src: string): VideoSource {
  if (/bilibili\.com|BV[a-zA-Z0-9]{10}|av\d+/i.test(src)) return "bilibili";
  if (/xiaohongshu\.com|xhslink\.com/i.test(src)) return "xiaohongshu";
  // 常用视频格式：mp4 / m3u8 / webm / ogg / flv / mkv / mov / avi / wmv / ts / m4v / 3gp / f4v / rmvb
  if (
    /\.(mp4|m3u8|webm|ogg|flv|mkv|mov|avi|wmv|ts|m4v|3gp|f4v|rmvb)(\?|$)/i.test(src) ||
    /\/.*\.(mp4|m3u8|mov|webm|flv|mkv)/i.test(src)
  )
    return "direct";
  return "unknown";
}

function extractBVID(input: string): string {
  const bv = input.match(/BV[a-zA-Z0-9]{10}/);
  if (bv) return bv[0];
  const av = input.match(/av(\d+)/i);
  if (av) return av[0];
  return input;
}

function extractXHSNoteId(input: string): string {
  const m = input.match(/explore\/([a-zA-Z0-9]+)/);
  return m ? m[1] : input;
}

export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  inline: false,

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            if (event.key !== " ") return false;
            const selection = view.state.selection;
            if (selection instanceof NodeSelection && selection.node.type.name === "videoEmbed") {
              event.preventDefault();
              // 空格键切换视频播放/暂停
              const dom = view.nodeDOM(selection.from) as HTMLElement | null;
              if (dom) {
                const el = dom.querySelector("div") as any;
                const xg = el?.__xgplayer;
                if (xg) {
                  if (xg.paused) xg.play();
                  else xg.pause();
                }
              }
              return true;
            }
            return false;
          },
          handlePaste(view, event) {
            const raw = event.clipboardData?.getData("text/plain");
            if (!raw) return false;

            // 逐行检测：仅纯链接行（不含空格）触发视频嵌入
            const lines = raw.split(/\r?\n/);
            for (const line of lines) {
              const text = line.trim();
              if (!text || text.includes(" ")) continue;

              const source = detectSource(text);
              if (source === "unknown") continue;

              event.preventDefault();

              const node = view.state.schema.nodes.videoEmbed.create({
                src: text,
                source,
              });
              const tr = view.state.tr.replaceSelectionWith(node);
              view.dispatch(tr);
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
      source: { default: "unknown" as VideoSource },
      name: { default: "" },
      size: {
        default: 0,
        parseHTML: (element) => Number((element as HTMLElement).getAttribute("data-size") || 0),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-video-embed]",
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const src = el.getAttribute("src") || el.getAttribute("data-src") || "";
          return { src, source: detectSource(src) };
        },
      },
      { tag: "div[data-bilibili]" },
      { tag: "div[data-xiaohongshu]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = (HTMLAttributes.src || "") as string;
    const source = detectSource(src);

    if (source === "bilibili") {
      const bvid = extractBVID(src);
      return [
        "div",
        {
          "data-video-embed": "bilibili",
          src,
          "data-bvid": bvid,
          class: "video-embed video-embed--bilibili",
          style: "margin: 1rem 0; border-radius: 12px; overflow: hidden;",
        },
        [
          "iframe",
          {
            src: `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1`,
            width: "100%",
            height: "400",
            frameborder: "0",
            allowfullscreen: "true",
            scrolling: "no",
            style: "border: none; display: block;",
          },
        ],
      ];
    }

    if (source === "xiaohongshu") {
      const _noteId = extractXHSNoteId(src);
      return [
        "div",
        {
          "data-video-embed": "xiaohongshu",
          src,
          class: "video-embed video-embed--xiaohongshu",
          style:
            "border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 12px; max-width: 480px; margin: 1rem 0;",
        },
        [
          "div",
          {
            style:
              "width:40px;height:40px;background:#ff2442;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;flex-shrink:0;",
          },
          "红",
        ],
        [
          "div",
          {},
          ["div", { style: "font-weight:600;font-size:14px;" }, "小红书笔记"],
          [
            "a",
            {
              href: src,
              target: "_blank",
              rel: "noopener noreferrer",
              style: "color:#ff2442;font-size:12px;text-decoration:none;",
            },
            "在小红书中打开 →",
          ],
        ],
      ];
    }

    // direct video URL — 使用 xgplayer 播放
    const playerId = `xgplayer-${Math.random().toString(36).slice(2, 8)}`;
    return [
      "div",
      {
        "data-video-embed": "direct",
        src,
        "data-player-id": playerId,
        "data-size": HTMLAttributes.size || 0,
        class: "video-embed video-embed--direct",
        style: "margin: 1rem 0; border-radius: 12px; overflow: hidden; background: #000;",
      },
      ["div", { id: playerId, style: "width:100%;max-width:720px;" }],
    ];
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addCommands(): any {
    return {
      insertVideo:
        (options: { src: string }) =>
        ({ chain }: { chain: () => any }) => {
          const source = detectSource(options.src);
          return chain()
            .insertContent({
              type: this.name,
              attrs: { ...options, source },
            })
            .focus()
            .run();
        },
    };
  },
});
