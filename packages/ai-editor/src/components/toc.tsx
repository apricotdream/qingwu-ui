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

/** 滚动跟踪基准线：距滚动容器顶部的距离。与标题的 scroll-margin-top: 5rem 对齐，
 * 点击跳转落定后的标题位置恰好满足高亮条件 */
const BASELINE_PX = 84;
/** 点击跳转锁的兜底超时（ms）：平滑滚动因异常未能完成时解锁 */
const LOCK_TIMEOUT_MS = 3000;

/**
 * 文档目录面板：自动收集 h1~h6 建树、支持折叠/展开、点击平滑滚动；
 * 内容滚动时目录自动跟踪高亮当前标题，并让激活项保持在目录视野内。
 */
export const TocPanel: FC<TocPanelProps> = ({ editor, className = "", onClose }) => {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  // 缓存上一次 headings 摘要，仅在结构实际变化时重收集
  const lastSignatureRef = useRef<string>("");
  // items 的 ref 镜像：滚动扫描回调读取最新值，避免闭包过期
  const itemsRef = useRef<TocItem[]>([]);
  const navRef = useRef<HTMLElement | null>(null);
  // 编辑器内容的滚动容器；null 表示 window 滚动
  const scrollParentRef = useRef<HTMLElement | null>(null);
  // 点击跳转锁：平滑滚动期间禁止中间标题抢占高亮
  const lockRef = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const rafRef = useRef(0);

  const unlock = useCallback(() => {
    if (lockRef.current) {
      clearTimeout(lockRef.current.timer);
      lockRef.current = null;
    }
  }, []);

  /** 现场收集标题并赋锚点 id：ProseMirror 会替换 DOM 节点，引用不可长期持有 */
  const collectHeadings = useCallback((): TocItem[] => {
    const heads = Array.from(editor.view.dom.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"));
    return heads.map((el, i) => {
      if (!el.id) el.id = slugify(el.textContent || "", i);
      return {
        id: el.id,
        level: Number(el.tagName.slice(1)),
        text: el.textContent?.trim() || "(无标题)",
        el,
      };
    });
  }, [editor]);

  /** 扫描标题位置，取最后一个已越过基准线的标题为激活项（滚动位置的纯函数） */
  const scan = useCallback(() => {
    // 缓存节点被 ProseMirror 替换（isConnected 失效）时现场重收集
    let list = itemsRef.current;
    if (!list.length || list.some((it) => !it.el.isConnected)) {
      list = collectHeadings();
      itemsRef.current = list;
    }
    if (!list.length) return;
    const container = scrollParentRef.current;
    const containerTop = container ? container.getBoundingClientRect().top : 0;
    const line = containerTop + BASELINE_PX;
    const atBottom = container
      ? container.scrollHeight - container.scrollTop - container.clientHeight < 2
      : document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 2;

    let next = "";
    for (const it of list) {
      if (!it.el.isConnected) continue;
      if (it.el.getBoundingClientRect().top <= line) next = it.id;
    }
    // 滚动到底时强制激活最后一个标题（末节可能永远到不了基准线）
    if (atBottom) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].el.isConnected) {
          next = list[i].id;
          break;
        }
      }
    }

    // 点击跳转锁定中：未到达前不让扫描覆盖高亮，到达后自动解锁
    const lock = lockRef.current;
    if (lock) {
      const target = list.find((it) => it.id === lock.id);
      const arrived =
        !target ||
        !target.el.isConnected ||
        atBottom ||
        target.el.getBoundingClientRect().top <= line;
      if (!arrived) return;
      unlock();
    }

    setActiveId(next);
  }, [collectHeadings, unlock]);

  /** rAF 节流调度一次扫描 */
  const scheduleScan = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      scan();
    });
  }, [scan]);

  const rebuild = useCallback(() => {
    const list = collectHeadings();
    // 比较 headings 摘要：level+text，避免打字时频繁更新列表
    const signature = list.map((it) => `${it.level}:${it.text}`).join("|");
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    itemsRef.current = list;
    setItems(list);
    scheduleScan();
  }, [collectHeadings, scheduleScan]);

  // 监听内容滚动容器（或 window）与视口变化，rAF 节流重算激活标题
  useEffect(() => {
    const container = findScrollParent(editor.view.dom);
    scrollParentRef.current = container;
    const target: HTMLElement | Window = container ?? window;
    target.addEventListener("scroll", scheduleScan, { passive: true });
    window.addEventListener("resize", scheduleScan);
    // 用户手动接管滚动（滚轮/触摸）时立即解除点击跳转锁
    target.addEventListener("wheel", unlock, { passive: true });
    target.addEventListener("touchstart", unlock, { passive: true });
    return () => {
      target.removeEventListener("scroll", scheduleScan);
      window.removeEventListener("resize", scheduleScan);
      target.removeEventListener("wheel", unlock);
      target.removeEventListener("touchstart", unlock);
    };
  }, [editor, scheduleScan, unlock]);

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
      unlock();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [editor, rebuild, unlock]);

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

      // 锁定高亮到目标：平滑滚动期间中间标题不会抢走高亮，scan 到达后自动解锁
      unlock();
      lockRef.current = { id: item.id, timer: setTimeout(unlock, LOCK_TIMEOUT_MS) };
      setActiveId(item.id);
      // scrollIntoView 自动适配任何滚动容器（window 或内层 div），
      // 配合 globals.css 的 scroll-margin-top 留出顶部偏移
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [editor, unlock],
  );

  const tree = useMemo(() => buildTree(items), [items]);
  const parentIds = useMemo(() => collectParentIds(tree), [tree]);
  // 子 id -> 父 id：折叠降级时上溯最近可见祖先
  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (ns: TocNode[], parent: string) => {
      for (const n of ns) {
        if (parent) map.set(n.id, parent);
        walk(n.children, n.id);
      }
    };
    walk(tree, "");
    return map;
  }, [tree]);
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
  const visibleSet = useMemo(() => new Set(visibleItems.map((it) => it.id)), [visibleItems]);
  // 折叠降级：激活项被祖先折叠遮住时，改为高亮其最近的可见祖先
  const effectiveActiveId = useMemo(() => {
    let id = activeId;
    while (id && !visibleSet.has(id)) id = parentMap.get(id) ?? "";
    return id;
  }, [activeId, visibleSet, parentMap]);

  // 目录自滚动：让激活项始终留在目录视野内（仅出视野时移动，避免抖动）
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !effectiveActiveId) return;
    const container = nav.closest(".toc-scroll");
    if (!(container instanceof HTMLElement)) return;
    const itemEl = nav.querySelector<HTMLElement>(
      `[data-toc-id="${CSS.escape(effectiveActiveId)}"]`,
    );
    if (!itemEl) return;
    const pad = 8;
    const cRect = container.getBoundingClientRect();
    const iRect = itemEl.getBoundingClientRect();
    if (iRect.top < cRect.top + pad) {
      container.scrollTop -= cRect.top + pad - iRect.top;
    } else if (iRect.bottom > cRect.bottom - pad) {
      container.scrollTop += iRect.bottom - (cRect.bottom - pad);
    }
  }, [effectiveActiveId]);

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
    <nav ref={navRef} className={`toc-panel ${className}`} aria-label="目录">
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
                data-toc-id={it.id}
                className={`toc-item ${effectiveActiveId === it.id ? "is-active" : ""}`}
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
