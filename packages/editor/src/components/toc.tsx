import type { Editor } from "@tiptap/core";
import { type FC, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface TocItem {
  id: string;
  level: number;
  text: string;
  el: HTMLElement;
}

interface TocNode extends TocItem {
  children: TocNode[];
}

export interface TocPanelProps {
  editor: Editor;
  className?: string;
  /** 点击标题区左侧按钮时收起目录面板；不传则左侧渲染为装饰图标 */
  onClose?: () => void;
}

/** 把标题文本转成稳定的锚点 id（中文也兼容，保留字母数字） */
function slugify(text: string, index: number): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return `${base || "heading"}-${index}`;
}

/** 从扁平标题列表构建树形结构（基于 level 层级） */
function buildTree(items: TocItem[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];
  for (const item of items) {
    const node: TocNode = { ...item, children: [] };
    // 弹出栈中 level >= 当前 level 的节点，找到最近的父节点
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  }
  return roots;
}

/** 收集所有有子节点的 id */
function collectParentIds(nodes: TocNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (ns: TocNode[]) => {
    for (const n of ns) {
      if (n.children.length > 0) {
        ids.add(n.id);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

/** 扁平化树，跳过折叠节点的子节点 */
function flattenTree(nodes: TocNode[], collapsed: Set<string>): TocNode[] {
  const result: TocNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0 && !collapsed.has(node.id)) {
      result.push(...flattenTree(node.children, collapsed));
    }
  }
  return result;
}

/** 搜索过滤树：保留匹配节点及其所有祖先和后代 */
function filterTree(nodes: TocNode[], query: string): TocNode[] {
  const lower = query.toLowerCase();
  const filter = (ns: TocNode[]): TocNode[] => {
    const result: TocNode[] = [];
    for (const n of ns) {
      const isMatch = n.text.toLowerCase().includes(lower);
      const filteredChildren = filter(n.children);
      if (isMatch || filteredChildren.length > 0) {
        result.push({ ...n, children: isMatch ? n.children : filteredChildren });
      }
    }
    return result;
  };
  return filter(nodes);
}

/** 查找最近的滚动容器（消费方可能将编辑器放在可滚动 div 内而非 window 滚动） */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent && parent !== document.documentElement) {
    const style = getComputedStyle(parent);
    const oy = style.overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "overlay") return parent;
    parent = parent.parentElement;
  }
  return null;
}

/** 高亮搜索关键词：将匹配部分包裹在 <mark> 中 */
function highlightText(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (;;) {
    const idx = lower.indexOf(lowerQuery, lastIndex);
    if (idx === -1) break;
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <mark key={`hl-${key++}`} className="toc-highlight">
        {text.slice(idx, idx + query.length)}
      </mark>,
    );
    lastIndex = idx + query.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : text;
}

/**
 * 现代化文档目录面板：
 * - 自动收集编辑器内 h1~h6 标题，构建树形结构
 * - 支持全部折叠/全部展开
 * - 有子标题的标题支持单独折叠/展开
 * - 点击平滑滚动并高亮
 * - IntersectionObserver 滚动时高亮当前标题
 */
export const TocPanel: FC<TocPanelProps> = ({ editor, className = "", onClose }) => {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleMap = useRef<Map<string, number>>(new Map());
  // 缓存上一次 headings 摘要，仅在结构实际变化时重建 observer
  const lastSignatureRef = useRef<string>("");

  const rebuild = useCallback(() => {
    const root = editor.view.dom;
    const heads = Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"));
    const list: TocItem[] = heads.map((el, i) => {
      if (!el.id) el.id = slugify(el.textContent || "", i);
      return {
        id: el.id,
        level: Number(el.tagName.slice(1)),
        text: el.textContent?.trim() || "(无标题)",
        el,
      };
    });
    // 比较 headings 摘要：level+text，避免打字时频繁重建 observer
    const signature = list.map((it) => `${it.level}:${it.text}`).join("|");
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    setItems(list);

    observerRef.current?.disconnect();
    visibleMap.current.clear();
    if (!heads.length) return;

    const ob = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (e.isIntersecting) {
            visibleMap.current.set(id, e.boundingClientRect.top);
          } else {
            visibleMap.current.delete(id);
          }
        }
        let bestId = "";
        let bestTop = Infinity;
        visibleMap.current.forEach((top, id) => {
          if (top < bestTop && top >= 0) {
            bestTop = top;
            bestId = id;
          }
        });
        if (bestId) setActiveId(bestId);
      },
      {
        // 消费方可能把编辑器放在可滚动容器内（而非 window 滚动），
        // 用最近滚动祖先作 root 才能正确观测标题可见性
        root: findScrollParent(editor.view.dom),
        rootMargin: "0px 0px -72% 0px",
        threshold: [0, 1],
      },
    );
    heads.forEach((h) => ob.observe(h));
    observerRef.current = ob;
  }, [editor]);

  useEffect(() => {
    // debounce 300ms，避免连续打字时频繁触发 rebuild
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      const signature: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === "heading") {
          signature.push(`${node.attrs.level}:${node.textContent}`);
        }
      });
      if (signature.join("|") === lastSignatureRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(rebuild, 300);
    };
    editor.on("update", handler);
    const raf = requestAnimationFrame(rebuild);
    return () => {
      editor.off("update", handler);
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(raf);
      observerRef.current?.disconnect();
    };
  }, [editor, rebuild]);

  const scrollTo = useCallback(
    (item: TocItem) => {
      // 优先使用存储的 DOM 引用；ProseMirror 重渲染后可能失效，再做作用域查找
      let el: HTMLElement | null = item.el;
      if (!el || !editor.view.dom.contains(el)) {
        el = editor.view.dom.querySelector<HTMLElement>(`[id="${CSS.escape(item.id)}"]`);
      }
      if (!el) {
        const tag = `h${item.level}`;
        const heads = editor.view.dom.querySelectorAll<HTMLElement>(tag);
        for (const h of heads) {
          if (h.textContent?.trim() === item.text) {
            el = h;
            break;
          }
        }
      }
      if (!el) return;

      // scrollIntoView 自动适配任何滚动容器（window 或内层 div），
      // 配合 globals.css 的 scroll-margin-top 留出顶部偏移
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(item.id);
    },
    [editor],
  );

  const tree = useMemo(() => buildTree(items), [items]);
  const parentIds = useMemo(() => collectParentIds(tree), [tree]);
  const isSearching = searchQuery.trim().length > 0;
  const filteredTree = useMemo(
    () => (isSearching ? filterTree(tree, searchQuery.trim()) : tree),
    [tree, isSearching, searchQuery],
  );
  // 搜索时忽略折叠状态，全部展开
  const visibleItems = useMemo(
    () => flattenTree(filteredTree, isSearching ? new Set() : collapsed),
    [filteredTree, collapsed, isSearching],
  );

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsed(new Set(parentIds));
  }, [parentIds]);

  const expandAll = useCallback(() => {
    setCollapsed(new Set());
  }, []);

  if (!items.length) {
    return (
      <div
        className={`toc-panel ${className}`}
        style={{ padding: "24px 16px", textAlign: "center" }}
      >
        <div className="toc-empty">文档暂无标题</div>
        <div className="toc-empty-hint">使用 # 标记可创建标题</div>
      </div>
    );
  }

  return (
    <nav className={`toc-panel ${className}`} aria-label="目录">
      <div className="toc-title">
        {onClose ? (
          <button
            type="button"
            className="toc-close-btn"
            onClick={onClose}
            title="收起目录"
            aria-label="收起目录"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m16 15-3-3 3-3" />
            </svg>
          </button>
        ) : (
          <span className="toc-title__icon" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7" />
            </svg>
          </span>
        )}
        <span className="toc-title__text">目录</span>
        <div className="toc-actions">
          <button
            type="button"
            className="toc-action-btn"
            onClick={collapseAll}
            title="全部折叠"
            aria-label="全部折叠"
            disabled={isSearching}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            className="toc-action-btn"
            onClick={expandAll}
            title="全部展开"
            aria-label="全部展开"
            disabled={isSearching}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
      <div className="toc-search">
        <svg
          className="toc-search__icon"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
          />
        </svg>
        <input
          type="text"
          className="toc-search__input"
          placeholder="搜索标题..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="搜索标题"
        />
        {searchQuery && (
          <button
            type="button"
            className="toc-search__clear"
            onClick={() => setSearchQuery("")}
            title="清除"
            aria-label="清除搜索"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {visibleItems.length === 0 ? (
        <div className="toc-search__empty">
          {isSearching ? `未找到"${searchQuery.trim()}"相关标题` : "文档暂无标题"}
        </div>
      ) : (
        <ul className="toc-list">
          {visibleItems.map((it) => {
            const hasChildren = parentIds.has(it.id);
            const isCollapsed = collapsed.has(it.id);
            return (
              <li
                key={it.id}
                className={`toc-item ${activeId === it.id ? "is-active" : ""}`}
                style={{ paddingLeft: `${(it.level - 1) * 12 + 12}px` }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    className={`toc-toggle ${isCollapsed ? "is-collapsed" : "is-expanded"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(it.id);
                    }}
                    title={isCollapsed ? "展开子标题" : "折叠子标题"}
                    aria-label={isCollapsed ? "展开子标题" : "折叠子标题"}
                    aria-expanded={!isCollapsed}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                ) : (
                  <span className="toc-bullet" aria-hidden />
                )}
                <button
                  type="button"
                  className="toc-link"
                  onClick={() => scrollTo(it)}
                  title={it.text}
                >
                  <span className="toc-text">
                    {isSearching ? highlightText(it.text, searchQuery.trim()) : it.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
};
