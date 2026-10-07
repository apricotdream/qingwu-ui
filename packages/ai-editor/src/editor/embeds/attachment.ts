/** 附件嵌入节点（attachmentEmbed）：内联文件附件，含名称 / 大小 / 类型属性。 */
import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AttachmentView } from "./attachment-view";

export const AttachmentEmbed = Node.create({
  name: "attachmentEmbed",
  group: "block",
  atom: true,
  inline: false,

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView);
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-src") || element.querySelector("a")?.getAttribute("href"),
        // ⚠️ 不写 renderHTML：tiptap 对有 renderHTML 的 addAttribute 只返回 data-* 结果，
        // 覆盖成 data-src 会使 HTMLAttributes.src=undefined → 序列化丢失属性、节点沦为空壳
      },
      name: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-name") ||
          element.querySelector("a")?.getAttribute("download") ||
          "",
      },
      size: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute("data-size") || 0),
      },
      type: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-type") || "",
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-attachment-embed]" }];
  },

  renderHTML({ HTMLAttributes }: any) {
    return [
      "div",
      {
        "data-attachment-embed": "true",
        "data-src": HTMLAttributes.src,
        "data-name": HTMLAttributes.name,
        "data-size": HTMLAttributes.size || 0,
        "data-type": HTMLAttributes.type || "",
        class: "attachment-embed",
      },
      [
        "a",
        { href: HTMLAttributes.src, download: HTMLAttributes.name },
        `📎 ${HTMLAttributes.name || "attachment"}`,
      ],
    ];
  },
});
