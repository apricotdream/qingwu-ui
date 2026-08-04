import type { AnyExtension } from "@tiptap/core";
import { Image as BaseImage } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Underline } from "@tiptap/extension-underline";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ImageView } from "./image-view";

const Image = BaseImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("width") || null,
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("height") || null,
        renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
      },
      // 记录文件大小（字节），用于附件总大小统计与限制校验
      size: {
        default: 0,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute("data-size") || 0),
        renderHTML: (attrs) => (attrs.size ? { "data-size": attrs.size } : {}),
      },
    };
  },
});

import { CharacterCount } from "@tiptap/extension-character-count";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { TextStyle } from "@tiptap/extension-text-style";
import { Markdown } from "tiptap-markdown";
import { AttachmentEmbed } from "../embeds/attachment";
import { AudioEmbed } from "../embeds/audio";
import { VideoEmbed } from "../embeds/video";
import { t } from "../i18n";
import { CodeBlock } from "./code-block";
import { ImageUpload } from "./image-upload";
import { ObsidianMarkdown } from "./obsidian-markdown";
import { QingwuUI } from "./qingwu-ui";
import { RelativeMedia } from "./relative-media";
import { SearchHighlight } from "./search-highlight";
import { createSlashCommandExtension, getDefaultSlashCommands } from "./slash-command";

export {
  AttachmentEmbed,
  AudioEmbed,
  CodeBlock,
  createSlashCommandExtension,
  ImageUpload,
  ObsidianMarkdown,
  QingwuUI,
  RelativeMedia,
  SearchHighlight,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  VideoEmbed,
};

export interface EditorExtensionsConfig {
  placeholder?: string;
  maxLength?: number;
  /** 单文件上传大小上限（字节），0 表示不限制 */
  maxAttachmentSize?: number;
  /** 文档内所有附件总大小上限（字节），0 表示不限制 */
  maxTotalAttachmentSize?: number;
}

/** 根据配置组装编辑器扩展列表（StarterKit + 自定义节点 + 斜杠命令等）。 */
export function getEditorExtensions(config: EditorExtensionsConfig = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      codeBlock: false,
      horizontalRule: false,
      underline: false,
      link: false,
    }),
    Underline,
    Link.configure({
      openOnClick: true,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
    Image.configure({ inline: false, allowBase64: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    CharacterCount.configure(config.maxLength ? { limit: config.maxLength } : {}),
    HorizontalRule,
    CodeBlock,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Markdown.configure({
      html: true,
      transformPastedText: true,
      transformCopiedText: false,
    }),
    Placeholder.configure({
      placeholder: config.placeholder || "输入 '/' 打开菜单…",
    }),
    createSlashCommandExtension(() =>
      getDefaultSlashCommands((key) => t(key), {
        maxAttachmentSize: config.maxAttachmentSize,
        maxTotalAttachmentSize: config.maxTotalAttachmentSize,
      }),
    ),
    ImageUpload.configure({
      maxAttachmentSize: config.maxAttachmentSize,
      maxTotalAttachmentSize: config.maxTotalAttachmentSize,
    }),
    // 粘贴外部 Markdown 后解析本地相对路径图片/附件（读盘需用户授权）
    RelativeMedia,
    ObsidianMarkdown,
    SearchHighlight,
    QingwuUI,
    VideoEmbed,
    AudioEmbed,
    AttachmentEmbed,
  ];
}
