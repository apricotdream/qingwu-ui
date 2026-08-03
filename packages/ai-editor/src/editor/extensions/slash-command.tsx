import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import Suggestion, {
  findSuggestionMatch as defaultFindSuggestionMatch,
  type SuggestionOptions,
} from "@tiptap/suggestion";
import { toast } from "../../components/toast";
import {
  type AttachmentLimits,
  getEditorAttachmentLimits,
  validateAttachmentFile,
} from "../attachment-limits";
import { uploadPlaceholder } from "./image-upload";

export interface SlashCommandItem {
  title: string;
  description?: string;
  icon?: string;
  command: (props: { editor: Editor }) => void;
}

export const slashCommandPluginKey = new PluginKey("slashCommand");

/**
 * 创建 SlashCommand 扩展
 *
 * @param getItems - 获取命令列表的函数（用于支持 i18n 动态切换）
 */
export function createSlashCommandExtension(getItems: () => SlashCommandItem[]) {
  return Extension.create({
    name: "slashCommand",

    addProseMirrorPlugins() {
      const suggestionOptions: Omit<SuggestionOptions<SlashCommandItem>, "editor"> = {
        char: "/",
        pluginKey: slashCommandPluginKey,
        findSuggestionMatch: (config) => {
          const { $position } = config;
          // 代码块/行内代码内不匹配 slash 命令，从匹配层杜绝触发
          for (let d = $position.depth; d >= 0; d--) {
            if ($position.node(d).type.name === "codeBlock") return null;
          }
          if ($position.marks().some((m) => m.type.name === "code")) return null;
          return defaultFindSuggestionMatch(config);
        },
        allow: ({ editor, state }) => {
          if (!editor.isEditable) return false;
          const { $from } = state.selection;
          for (let d = $from.depth; d >= 0; d--) {
            if ($from.node(d).type.name === "codeBlock") return false;
          }
          if ($from.marks().some((m) => m.type.name === "code")) return false;
          return true;
        },

        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          props.command({ editor });
        },

        items: ({ query }) => {
          const items = getItems();
          if (!query) return items;
          const q = query.toLowerCase();
          return items.filter((item) => {
            return (
              item.title.toLowerCase().includes(q) ||
              (item.description?.toLowerCase().includes(q) ?? false)
            );
          });
        },

        render: () => {
          let container: HTMLDivElement | null = null;
          let popup: HTMLDivElement | null = null;
          let selectedIndex = 0;
          let currentItems: SlashCommandItem[] = [];

          function buildPopup(
            items: SlashCommandItem[],
            command: (item: SlashCommandItem) => void,
          ) {
            if (!popup) return;
            currentItems = items;

            // 清空
            popup.textContent = "";

            // 搜索栏
            const searchWrap = document.createElement("div");
            searchWrap.style.cssText = "padding:6px 8px;border-bottom:1px solid #f4f4f5;";
            const searchInput = document.createElement("input");
            searchInput.type = "text";
            searchInput.placeholder = "搜索命令…";
            searchInput.style.cssText =
              "width:100%;padding:6px 8px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;outline:none;background:#fafafa;";
            searchWrap.appendChild(searchInput);
            popup.appendChild(searchWrap);

            // 命令列表
            const listEl = document.createElement("div");
            listEl.className = "slash-item-list";
            listEl.style.cssText = "max-height:300px;overflow-y:auto;";

            if (items.length === 0) {
              const empty = document.createElement("div");
              empty.style.cssText = "padding:12px;text-align:center;color:#a1a1aa;font-size:13px;";
              empty.textContent = "未找到匹配";
              listEl.appendChild(empty);
            } else {
              items.forEach((item, i) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `slash-item${i === selectedIndex ? " slash-item--selected" : ""}`;
                btn.dataset.index = String(i);
                btn.style.cssText = `display:flex;align-items:center;gap:12px;width:100%;padding:8px 12px;border:none;background:${i === selectedIndex ? "#f4f4f5" : "transparent"};cursor:pointer;text-align:left;border-radius:8px;font-size:14px;transition:background 0.1s;`;

                const iconSpan = document.createElement("span");
                iconSpan.style.cssText =
                  "font-size:16px;width:24px;text-align:center;flex-shrink:0;";
                iconSpan.textContent = item.icon || "";
                btn.appendChild(iconSpan);

                const textWrap = document.createElement("div");
                textWrap.style.cssText = "min-width:0;";

                const titleDiv = document.createElement("div");
                titleDiv.style.cssText = "font-weight:500;color:#18181b;";
                titleDiv.textContent = item.title;
                textWrap.appendChild(titleDiv);

                if (item.description) {
                  const descDiv = document.createElement("div");
                  descDiv.style.cssText = "font-size:12px;color:#a1a1aa;margin-top:1px;";
                  descDiv.textContent = item.description;
                  textWrap.appendChild(descDiv);
                }

                btn.appendChild(textWrap);
                btn.addEventListener("click", () => {
                  command(item);
                });
                listEl.appendChild(btn);
              });
            }
            popup.appendChild(listEl);

            // 搜索过滤
            searchInput.addEventListener("input", () => {
              const q = searchInput.value.toLowerCase();
              const btns = listEl.querySelectorAll<HTMLButtonElement>(".slash-item");
              btns.forEach((btn) => {
                const text = (btn.textContent || "").toLowerCase();
                btn.style.display = text.includes(q) ? "" : "none";
              });
            });
          }

          // 保存 clientRect 引用 + scroll 监听
          let clientRectRef: (() => DOMRect | null) | null = null;
          let scrollHandler: (() => void) | null = null;

          function updatePosition() {
            if (!container || !clientRectRef) return;
            const rect = clientRectRef();
            if (rect) {
              container.style.top = `${rect.bottom + 4}px`;
              container.style.left = `${rect.left}px`;
            }
          }

          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onStart: (props: any) => {
              selectedIndex = 0;
              clientRectRef = props.clientRect || null;

              if (!container) {
                container = document.createElement("div");
                container.style.position = "fixed";
                container.style.zIndex = "9999";
                document.body.appendChild(container);
              }
              if (!popup) {
                popup = document.createElement("div");
                popup.className = "slash-command-popup";
                popup.style.cssText =
                  "background:#fff;border:1px solid #e4e4e7;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);min-width:260px;max-width:340px;";
                container.appendChild(popup);
              }

              updatePosition();
              currentItems = props.items;
              buildPopup(props.items, props.command);
              container.style.display = "block";

              // 监听滚动，实时更新弹窗位置
              scrollHandler = () => updatePosition();
              window.addEventListener("scroll", scrollHandler, true);
            },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onUpdate: (props: any) => {
              selectedIndex = 0;
              clientRectRef = props.clientRect || null;
              currentItems = props.items;
              buildPopup(props.items, props.command);
              updatePosition();
            },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onKeyDown: (props: any) => {
              if (props.event.key === "ArrowDown") {
                props.event.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, currentItems.length - 1);
                buildPopup(currentItems, props.command);
                return true;
              }
              if (props.event.key === "ArrowUp") {
                props.event.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                buildPopup(currentItems, props.command);
                return true;
              }
              if (props.event.key === "Enter") {
                props.event.preventDefault();
                if (currentItems[selectedIndex]) {
                  props.command(currentItems[selectedIndex]);
                }
                return true;
              }
              if (props.event.key === "Escape") {
                return true;
              }
              return false;
            },

            onExit: () => {
              if (container) {
                container.style.display = "none";
              }
              selectedIndex = 0;
              currentItems = [];
              clientRectRef = null;
              if (scrollHandler) {
                window.removeEventListener("scroll", scrollHandler, true);
                scrollHandler = null;
              }
            },
          };
        },
      };

      return [
        Suggestion({
          editor: this.editor,
          ...suggestionOptions,
        }),
        // 兜底守卫：无论何种路径（IME/NodeView 选区异常）导致 slash 处于激活态，
        // 只要当前选区落在代码块/行内代码内，立即强制退出，杜绝代码块内弹出命令栏。
        new Plugin({
          key: new PluginKey("slashCodeBlockGuard"),
          appendTransaction: (_trs, _old, state) => {
            const { $from } = state.selection;
            let inCode = false;
            for (let d = $from.depth; d >= 0; d--) {
              if ($from.node(d).type.name === "codeBlock") {
                inCode = true;
                break;
              }
            }
            if (!inCode && !$from.marks().some((m) => m.type.name === "code")) return null;
            const st = slashCommandPluginKey.getState(state);
            if (st && st.active) {
              return state.tr.setMeta(slashCommandPluginKey, { exit: true });
            }
            return null;
          },
        }),
      ];
    },
  });
}

/**
 * 默认斜杠命令列表（中文）
 *
 * @param t 翻译函数
 * @param defaultLimits 构建时的附件限制兜底（实际运行期优先读 editor.storage.qingwuUI.limits，
 *   宿主可动态更新限制而无需重建扩展）
 */
export function getDefaultSlashCommands(
  t: (key: string) => string,
  defaultLimits?: Partial<AttachmentLimits>,
): SlashCommandItem[] {
  return [
    {
      title: t("editor.slash.heading1"),
      description: t("editor.slash.heading1Desc"),
      icon: "H1",
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      title: t("editor.slash.heading2"),
      description: t("editor.slash.heading2Desc"),
      icon: "H2",
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: t("editor.slash.heading3"),
      description: t("editor.slash.heading3Desc"),
      icon: "H3",
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      title: t("editor.slash.heading4"),
      description: t("editor.slash.heading4Desc"),
      icon: "H4",
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 4 }).run(),
    },
    {
      title: t("editor.slash.heading5"),
      description: t("editor.slash.heading5Desc"),
      icon: "H5",
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 5 }).run(),
    },
    {
      title: t("editor.slash.heading6"),
      description: t("editor.slash.heading6Desc"),
      icon: "H6",
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 6 }).run(),
    },
    {
      title: t("editor.slash.bulletList"),
      description: t("editor.slash.bulletListDesc"),
      icon: "•",
      command: ({ editor }) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      title: t("editor.slash.numberedList"),
      description: t("editor.slash.numberedListDesc"),
      icon: "1.",
      command: ({ editor }) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      title: t("editor.slash.taskList"),
      description: t("editor.slash.taskListDesc"),
      icon: "☑",
      command: ({ editor }) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      title: t("editor.slash.blockquote"),
      description: t("editor.slash.blockquoteDesc"),
      icon: "❝",
      command: ({ editor }) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      title: t("editor.slash.codeBlock"),
      description: t("editor.slash.codeBlockDesc"),
      icon: "</>",
      command: ({ editor }) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      title: t("editor.slash.horizontalRule"),
      description: t("editor.slash.horizontalRuleDesc"),
      icon: "—",
      command: ({ editor }) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      title: t("editor.slash.image"),
      description: t("editor.slash.imageDesc"),
      icon: "🖼",
      command: ({ editor }) => {
        // 通过 (editor.storage as any).qingwuUI 触发图片上传弹窗（多实例安全）
        const storage = (editor.storage as any).qingwuUI as
          | { openImageDialog?: () => void }
          | undefined;
        storage?.openImageDialog?.();
      },
    },
    {
      title: t("editor.slash.video"),
      description: t("editor.slash.videoDesc"),
      icon: "🎬",
      command: ({ editor }) => {
        const storage = (editor.storage as any).qingwuUI as
          | { openVideoDialog?: () => void }
          | undefined;
        storage?.openVideoDialog?.();
      },
    },
    {
      title: t("editor.slash.audio"),
      description: t("editor.slash.audioDesc"),
      icon: "🎵",
      command: ({ editor }) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "audio/*";
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          // 同步校验：超限直接拒绝，不插入占位节点（限制实时读 qingwuUI storage，兜底构建时配置）
          const activeLimits = getEditorAttachmentLimits(editor) ?? defaultLimits;
          const limitErr = activeLimits
            ? validateAttachmentFile(editor.state.doc, file, activeLimits)
            : null;
          if (limitErr) {
            toast(limitErr);
            return;
          }
          const placeholderSrc = URL.createObjectURL(file);
          const node = editor.schema.nodes.audioEmbed?.create({
            src: placeholderSrc,
            name: file.name,
            size: file.size,
          });
          if (!node) return;
          editor.chain().focus().insertContent(node).run();
          // 上传到存储并替换占位 src（存储未配置时保持 placeholder）
          await uploadPlaceholder(editor.view, file, placeholderSrc);
        };
        input.click();
      },
    },
    {
      title: t("editor.slash.attachment"),
      description: t("editor.slash.attachmentDesc"),
      icon: "📎",
      command: ({ editor }) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "*/*";
        input.multiple = true;
        input.onchange = async () => {
          const files = input.files;
          if (!files || files.length === 0) return;
          for (const file of Array.from(files)) {
            // 同步校验：超限直接拒绝（doc 含此前已插入的文件，总大小自动累计；
            // 限制实时读 qingwuUI storage，兜底构建时配置）
            const activeLimits = getEditorAttachmentLimits(editor) ?? defaultLimits;
            const limitErr = activeLimits
              ? validateAttachmentFile(editor.state.doc, file, activeLimits)
              : null;
            if (limitErr) {
              toast(limitErr);
              continue;
            }
            const placeholderSrc = URL.createObjectURL(file);
            const attType = editor.schema.nodes.attachmentEmbed;
            if (!attType) continue;
            try {
              editor
                .chain()
                .focus()
                .insertContent(
                  attType.create({
                    src: placeholderSrc,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                  }),
                )
                .run();
            } catch {
              continue;
            }
            // 上传到存储并替换占位 src（存储未配置时保持 placeholder）
            await uploadPlaceholder(editor.view, file, placeholderSrc);
          }
        };
        input.click();
      },
    },
  ];
}
