import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { toast } from "../../components/toast";
import { validateAttachmentFile, type AttachmentLimits } from "../attachment-limits";
import { getStorageProvider } from "../storage";

type MediaType = "image" | "video" | "audio" | "file" | "markdown";

function detectType(file: File): MediaType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  // 兜底：通过文件扩展名识别（部分文件类型 type 为空）
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (/^(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(ext)) return "image";
  if (/^(mp4|m3u8|webm|ogg|mov|avi|wmv|flv|mkv|ts|m4v|3gp|f4v|rmvb)$/.test(ext)) return "video";
  if (/^(mp3|wav|flac|aac|m4a|wma|opus)$/.test(ext)) return "audio";
  if (/^(md|markdown)$/.test(ext)) return "markdown";
  return "file";
}

function isMdFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return ext === "md" || ext === "markdown";
}

/** 读取 MD 文件内容并直接渲染为编辑器节点 */
async function insertMdFile(view: any, file: File, pos?: number, editor?: any, limits?: AttachmentLimits) {
  const insertPos = pos ?? view.state.selection.from;

  // 通过 editor.storage.qingwuUI 触发 MD 导入弹窗（多实例安全，替代 window.__qingwu_*）
  const storage = editor?.storage?.qingwuUI as
    | {
        chooseMd?: (filename: string, resolve: (v: "render" | "attach" | null) => void) => void;
        parseMd?: (schema: any, text: string) => unknown;
      }
    | undefined;

  const choice: "render" | "attach" | null = await new Promise((resolve) => {
    if (storage?.chooseMd) {
      storage.chooseMd(file.name, resolve);
    } else {
      // 兜底：window.confirm
      resolve(window.confirm(`将 "${file.name}" 渲染到编辑器？`) ? "render" : "attach");
    }
  });

  if (choice === null || choice === "attach") {
    // 同步校验：超限直接拒绝，不插入占位节点
    const limitErr = limits ? validateAttachmentFile(view.state.doc, file, limits) : null;
    if (limitErr) {
      toast(limitErr);
      return;
    }
    const placeholderSrc = URL.createObjectURL(file);
    const attNode = view.state.schema.nodes.attachmentEmbed?.create({
      src: placeholderSrc,
      name: file.name,
      size: file.size,
      type: file.type,
    });
    if (attNode) {
      try {
        view.dispatch(view.state.tr.insert(insertPos, attNode));
      } catch {
        /* skip */
      }
    }
    return;
  }

  // 直接渲染：读取内容并解析
  const text = await file.text();

  if (storage?.parseMd) {
    const fragment = storage.parseMd(view.state.schema, text);
    if (fragment) {
      view.dispatch(view.state.tr.insert(insertPos, fragment));
      return;
    }
  }

  // 兜底：纯文本段落插入
  const lines = text.split("\n");
  const nodes: any[] = [];
  for (const line of lines) {
    if (line.trim()) {
      nodes.push(view.state.schema.nodes.paragraph.create(null, view.state.schema.text(line)));
    } else {
      nodes.push(view.state.schema.nodes.paragraph.create());
    }
  }
  if (nodes.length > 0) {
    const { Fragment } = await import("@tiptap/pm/model");
    view.dispatch(view.state.tr.insert(insertPos, Fragment.from(nodes)));
  }
}

function createNode(schema: any, file: File, placeholderSrc: string) {
  const type = detectType(file);
  switch (type) {
    case "image":
      return schema.nodes.image?.create({ src: placeholderSrc, alt: file.name });
    case "video":
      return schema.nodes.videoEmbed?.create({
        src: placeholderSrc,
        source: "direct",
        name: file.name,
      });
    case "audio":
      return schema.nodes.audioEmbed?.create({ src: placeholderSrc, name: file.name });
    default: {
      // 附件 → attachmentEmbed node（带容器：下载 + 预览）
      if (schema.nodes.attachmentEmbed) {
        return schema.nodes.attachmentEmbed.create({
          src: placeholderSrc,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      }
      const linkMark = schema.marks.link?.create({ href: placeholderSrc });
      return linkMark ? schema.text(`📎 ${file.name}`, [linkMark]) : null;
    }
  }
}

/**
 * 上传文件并替换文档中 src === placeholderSrc 的占位节点。
 * 供拖拽/粘贴（uploadAndInsert）与斜杠命令共用。
 * 上传失败时释放占位 blob URL，避免泄漏（占位节点保留在文档中，用户可手动删除）。
 */
export async function uploadPlaceholder(
  view: any,
  file: File,
  placeholderSrc: string,
): Promise<boolean> {
  // 存储未配置时保持 placeholder
  let storage;
  try {
    storage = getStorageProvider();
  } catch {
    return false;
  }

  try {
    const url = await storage.upload(file);
    URL.revokeObjectURL(placeholderSrc);

    let swapped = false;
    view.state.doc.descendants((n: any, nodePos: number) => {
      if (n.attrs?.src === placeholderSrc) {
        view.dispatch(
          view.state.tr.setNodeMarkup(nodePos, undefined, {
            ...n.attrs,
            src: url,
          }),
        );
        swapped = true;
        return false;
      }
      return true;
    });
    return swapped;
  } catch (err) {
    console.error(`${file.type} upload failed:`, err);
    URL.revokeObjectURL(placeholderSrc);
    return false;
  }
}

async function uploadAndInsert(view: any, file: File, pos?: number, limits?: AttachmentLimits) {
  // 同步校验：超限直接拒绝，不插入占位节点
  const limitErr = limits ? validateAttachmentFile(view.state.doc, file, limits) : null;
  if (limitErr) {
    toast(limitErr);
    return;
  }

  // 先插入占位节点（不依赖存储服务）
  const placeholderSrc = URL.createObjectURL(file);
  const node = createNode(view.state.schema, file, placeholderSrc);
  if (!node) return;

  const insertPos = pos ?? view.state.selection.from;
  try {
    view.dispatch(view.state.tr.insert(insertPos, node));
  } catch {
    return;
  }

  // 再上传（存储未配置时保持 placeholder）
  await uploadPlaceholder(view, file, placeholderSrc);
}

export const ImageUpload = Extension.create<AttachmentLimits>({
  name: "imageUpload",

  // 默认 0 = 不限制；QingWuEditor 总是通过 configure 传入真实限制
  addOptions() {
    return { maxAttachmentSize: 0, maxTotalAttachmentSize: 0 };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const limits: AttachmentLimits = {
      maxAttachmentSize: this.options.maxAttachmentSize,
      maxTotalAttachmentSize: this.options.maxTotalAttachmentSize,
    };
    return [
      new Plugin({
        key: new PluginKey("imageUpload"),
        props: {
          handleDrop(view, event) {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            // 始终阻止浏览器默认行为（否则会跳转打开文件）
            event.preventDefault();

            // MD 文件 → 直接渲染；其他文件 → embed/attachment
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });

            for (const file of Array.from(files)) {
              if (isMdFile(file)) {
                insertMdFile(view, file, pos?.pos, editor, limits);
              } else {
                uploadAndInsert(view, file, pos?.pos, limits);
              }
            }
            return true;
          },

          handlePaste(view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;

            for (const item of Array.from(items)) {
              if (
                item.type.startsWith("image/") ||
                item.type.startsWith("video/") ||
                item.type.startsWith("audio/")
              ) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file && detectType(file) !== "file") {
                  uploadAndInsert(view, file, undefined, limits);
                }
                return true;
              }
              // 粘贴 MD 文件 → 直接渲染
              if (item.kind === "file") {
                const file = item.getAsFile();
                if (file && isMdFile(file)) {
                  event.preventDefault();
                  insertMdFile(view, file, undefined, editor, limits);
                  return true;
                }
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
