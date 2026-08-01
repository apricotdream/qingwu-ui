import { Extension } from "@tiptap/core";

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|#|$)/i;
const VIDEO_EXT_RE = /\.(mp4|m3u8|webm|ogg|flv|mkv|mov|avi|wmv|ts|m4v|3gp|f4v|rmvb)(\?|#|$)/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|flac|aac|m4a|wma|opus)(\?|#|$)/i;

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function basenameLabel(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/");
  return normalized.split("/").pop() || normalized;
}

/**
 * markdown-it inline 规则：解析 Obsidian `[[wiki]]` / `[[path|alias]]` / `![[embed]]`。
 * 通过 tiptap-markdown 的 MarkdownParser.setup 钩子注册，使所有 markdown 内容
 * （首页 README 与粘贴）统一经 markdown-it 解析，正确合并多行引用块/列表/分割线，
 * 并支持 Obsidian 嵌入语法（图片/视频/音频/链接）。
 */
function obsidianInlineRule(state: any, silent: boolean): boolean {
  const src = state.src.slice(state.pos);
  let m = /^!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(src);
  let embed = true;
  if (!m) {
    m = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(src);
    embed = false;
  }
  if (!m) return false;

  const path = m[1].trim();
  const alias = m[2]?.trim();

  if (!silent) {
    const label = alias || basenameLabel(path);
    if (embed) {
      let html = "";
      if (IMAGE_EXT_RE.test(path) || /^data:image\//i.test(path)) {
        html = `<img src="${escapeAttr(path)}" alt="${escapeAttr(label)}">`;
      } else if (VIDEO_EXT_RE.test(path) || /^data:video\//i.test(path)) {
        html = `<div data-video-embed src="${escapeAttr(path)}"></div>`;
      } else if (AUDIO_EXT_RE.test(path) || /^data:audio\//i.test(path)) {
        html = `<audio src="${escapeAttr(path)}"></audio>`;
      } else {
        const lo = state.push("link_open", "a", 1);
        lo.attrs = [["href", path]];
        const tx = state.push("text", "", 0);
        tx.content = label;
        state.push("link_close", "a", -1);
        state.pos += m[0].length;
        return true;
      }
      const t = state.push("html_inline", "", 0);
      t.content = html;
    } else {
      const lo = state.push("link_open", "a", 1);
      lo.attrs = [["href", path]];
      const tx = state.push("text", "", 0);
      tx.content = label;
      state.push("link_close", "a", -1);
    }
  }

  state.pos += m[0].length;
  return true;
}

export const ObsidianMarkdown = Extension.create({
  name: "obsidianMarkdown",

  addStorage() {
    return {
      markdown: {
        parse: {
          // 每次 parse 都会调用 setup，用标记避免重复注册规则
          setup(md: any) {
            if (md.__obsidianReg) return;
            md.__obsidianReg = true;
            md.inline.ruler.before("link", "obsidian_embed", obsidianInlineRule);
          },
        },
      },
    };
  },
});
