import { type CommandProps, Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * 全文搜索高亮扩展
 *
 * 设计：基于 ProseMirror Decoration 实现，不污染文档内容。
 * - 匹配位置存储在 plugin state 中，文档变更时重新计算
 * - 当前匹配项用不同 class 标识，可滚动到视图
 * - 大小写敏感/整词匹配可配置
 *
 * 命令：
 * - setSearch(keyword, opts)  设置关键词并立即匹配
 * - nextMatch()               跳到下一个匹配
 * - prevMatch()               跳到上一个匹配
 * - clearSearch()             清除高亮
 */

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

interface SearchState {
  keyword: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  matches: Array<{ from: number; to: number }>;
  currentIndex: number;
}

const EMPTY_STATE: SearchState = {
  keyword: "",
  caseSensitive: false,
  wholeWord: false,
  matches: [],
  currentIndex: -1,
};

const searchPluginKey = new PluginKey<SearchState>("search-highlight");

/** 转义正则元字符，避免用户输入被当作正则 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 在文档中查找所有匹配位置 */
function findMatches(
  doc: import("@tiptap/pm/model").Node,
  state: SearchState,
): Array<{ from: number; to: number }> {
  const { keyword, caseSensitive, wholeWord } = state;
  if (!keyword) return [];

  const flags = caseSensitive ? "g" : "gi";
  const pattern = wholeWord ? `\\b${escapeRegExp(keyword)}\\b` : escapeRegExp(keyword);
  const re = new RegExp(pattern, flags);

  const matches: Array<{ from: number; to: number }> = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text)) !== null) {
      const from = pos + m.index;
      const to = from + m[0].length;
      matches.push({ from, to });
      // 防止零宽匹配死循环
      if (m[0].length === 0) re.lastIndex++;
    }
  });
  return matches;
}

/** 根据匹配位置生成 DecorationSet - 必须传入 doc 才能正确关联装饰 */
function buildDecorations(doc: import("@tiptap/pm/model").Node, state: SearchState): DecorationSet {
  if (state.matches.length === 0) return DecorationSet.empty;
  const decos = state.matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class:
        i === state.currentIndex ? "search-highlight search-highlight--active" : "search-highlight",
    }),
  );
  return DecorationSet.create(doc, decos);
}

/**
 * 滚动当前匹配项到视图中央（如不在视野内）
 *
 * 策略：
 * 1. 优先查找当前匹配项对应的 DOM 元素（.search-highlight--active span），
 *    用 scrollIntoView 让浏览器自动找最近的可滚动祖先（window 或编辑器内部容器）
 * 2. 先检查 getBoundingClientRect 是否在视口内（留 120px 顶部边距给 sticky header，
 *    80px 底部边距），在视野内则不滚动，避免搜索时跳动
 * 3. fallback：若 span 未渲染（时序问题），用 view.coordsAtPos 计算 + window.scrollBy
 */
function scrollCurrentIntoView(view: import("@tiptap/pm/view").EditorView, state: SearchState) {
  if (state.currentIndex < 0 || state.currentIndex >= state.matches.length) return;
  const m = state.matches[state.currentIndex];
  if (!m) return;

  // 用 rAF 延迟到下一帧，确保 dispatch 后的 decoration 已渲染到 DOM
  requestAnimationFrame(() => {
    try {
      // 1. 优先用 DOM 元素 scrollIntoView
      const activeSpan = view.dom.querySelector(".search-highlight--active") as HTMLElement | null;
      if (activeSpan) {
        const rect = activeSpan.getBoundingClientRect();
        const viewportTop = 120; // sticky header + 搜索框高度
        const viewportBottom = window.innerHeight - 80;
        // 不在视野内才滚动，避免已在视野内时强制滚动跳动
        if (rect.top < viewportTop || rect.bottom > viewportBottom) {
          activeSpan.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      // 2. fallback：span 未渲染时用 coordsAtPos
      const coords = view.coordsAtPos(m.from);
      const viewportTop = 120;
      const viewportBottom = window.innerHeight - 80;
      if (coords.top < viewportTop || coords.top > viewportBottom) {
        // 滚动到视口中央
        const offset = coords.top - window.innerHeight / 2;
        window.scrollBy({ top: offset, behavior: "smooth" });
      }
    } catch {
      // 位置无效时静默忽略
    }
  });
}

export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchPluginKey,
        state: {
          init: () => EMPTY_STATE,
          apply(tr, prev) {
            // 命令通过 meta 触发状态更新
            const meta = tr.getMeta(searchPluginKey) as Partial<SearchState> | undefined;
            if (meta) {
              const next: SearchState = {
                ...prev,
                ...meta,
                // matches/currentIndex 由命令计算后传入；未提供则保留 prev
                matches: meta.matches !== undefined ? meta.matches : prev.matches,
                currentIndex:
                  meta.currentIndex !== undefined ? meta.currentIndex : prev.currentIndex,
              };
              return next;
            }
            // 文档变更但非本插件命令：若有关键词，需重新匹配
            if (tr.docChanged && prev.keyword) {
              const matches = findMatches(tr.doc, prev);
              // 若当前 index 越界则回退
              let idx = prev.currentIndex;
              if (idx >= matches.length) idx = matches.length - 1;
              if (idx < 0) idx = matches.length > 0 ? 0 : -1;
              return { ...prev, matches, currentIndex: idx };
            }
            return prev;
          },
        },
        props: {
          decorations(editorState) {
            const ss = searchPluginKey.getState(editorState);
            if (!ss) return DecorationSet.empty;
            return buildDecorations(editorState.doc, ss);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearch:
        (keyword: string, opts: SearchOptions = {}) =>
        ({ state, dispatch, view }: CommandProps) => {
          const prev = searchPluginKey.getState(state) || EMPTY_STATE;
          const next: SearchState = {
            keyword,
            caseSensitive: opts.caseSensitive ?? prev.caseSensitive,
            wholeWord: opts.wholeWord ?? prev.wholeWord,
            matches: [],
            currentIndex: -1,
          };
          next.matches = findMatches(state.doc, next);
          next.currentIndex = next.matches.length > 0 ? 0 : -1;
          if (dispatch) {
            dispatch(state.tr.setMeta(searchPluginKey, next));
            if (view) scrollCurrentIntoView(view, next);
          }
          return true;
        },
      nextMatch:
        () =>
        ({ state, dispatch, view }: CommandProps) => {
          const prev = searchPluginKey.getState(state) || EMPTY_STATE;
          if (prev.matches.length === 0) return false;
          const idx = (prev.currentIndex + 1) % prev.matches.length;
          if (dispatch) {
            dispatch(state.tr.setMeta(searchPluginKey, { currentIndex: idx }));
            if (view) scrollCurrentIntoView(view, { ...prev, currentIndex: idx });
          }
          return true;
        },
      prevMatch:
        () =>
        ({ state, dispatch, view }: CommandProps) => {
          const prev = searchPluginKey.getState(state) || EMPTY_STATE;
          if (prev.matches.length === 0) return false;
          const idx = (prev.currentIndex - 1 + prev.matches.length) % prev.matches.length;
          if (dispatch) {
            dispatch(state.tr.setMeta(searchPluginKey, { currentIndex: idx }));
            if (view) scrollCurrentIntoView(view, { ...prev, currentIndex: idx });
          }
          return true;
        },
      clearSearch:
        () =>
        ({ state, dispatch }: CommandProps) => {
          if (dispatch) dispatch(state.tr.setMeta(searchPluginKey, EMPTY_STATE));
          return true;
        },
    };
  },
});

/** 读取当前搜索状态（供 UI 显示匹配数） */
export function getSearchState(editor: import("@tiptap/core").Editor): SearchState {
  const state = editor.state;
  return searchPluginKey.getState(state) || EMPTY_STATE;
}
