import type { Editor } from "@tiptap/core";
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSearchState } from "../editor/extensions/search-highlight";

interface SearchBarProps {
  editor: Editor | null;
  onClose: () => void;
}

/**
 * 编辑器内搜索浮层：Ctrl/Cmd+F 唤起，Enter/Shift+Enter 下/上一个。
 * keyword/选项变化用 rAF 合并同帧调用；不用 composingRef 跳过 composition（中文输入法末步不触发搜索）；
 * input 事件 stopPropagation 防冒泡到 ProseMirror。
 */
export const SearchBar: FC<SearchBarProps> = ({ editor, onClose }) => {
  const [keyword, setKeyword] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  // tick 用于强制刷新匹配数显示（getSearchState 读 editor state，不属于 React state）
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // 用 ref 保存最新的搜索参数，rAF 回调里读取，避免闭包陈旧
  const searchParamsRef = useRef({ keyword, caseSensitive, wholeWord });
  searchParamsRef.current = { keyword, caseSensitive, wholeWord };

  // 监听 update 刷新匹配数：rAF throttle；不订阅 transaction，避免光标移动重渲染
  useEffect(() => {
    if (!editor) return;
    let raf = 0;
    const handler = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        setTick((n) => (n + 1) % 1_000_000);
      });
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [editor]);

  // 打开时聚焦输入框
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, []);

  // 搜索执行：rAF 合并同帧调用，比 setTimeout 更跟手且不掉帧
  useEffect(() => {
    if (!editor) return;
    const raf = requestAnimationFrame(() => {
      const { keyword: kw, caseSensitive: cs, wholeWord: ww } = searchParamsRef.current;
      try {
        editor.commands.setSearch(kw, { caseSensitive: cs, wholeWord: ww });
      } catch (err) {
        console.warn("[SearchBar] setSearch failed:", err);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editor, keyword, caseSensitive, wholeWord]);

  // 卸载时清除高亮
  useEffect(() => {
    return () => {
      try {
        editor?.commands.clearSearch();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC 关闭 - 用 capture 但只对 ESC 生效
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const handleNext = useCallback(() => {
    try {
      editor?.commands.nextMatch();
    } catch {
      /* ignore */
    }
  }, [editor]);

  const handlePrev = useCallback(() => {
    try {
      editor?.commands.prevMatch();
    } catch {
      /* ignore */
    }
  }, [editor]);

  // input 键盘事件：阻止冒泡到 ProseMirror，避免编辑器误触发
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) handlePrev();
        else handleNext();
      }
    },
    [handleNext, handlePrev],
  );

  // 获取当前匹配信息 - tick 变化时重新计算
  const info = useMemo(() => {
    if (!editor) return null;
    try {
      return getSearchState(editor);
    } catch {
      return null;
    }
    // tick 强制刷新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, keyword, caseSensitive, wholeWord, tick]);

  const matchText = !keyword
    ? ""
    : info && info.matches.length > 0
      ? `${info.currentIndex + 1} / ${info.matches.length}`
      : "无匹配";

  // 通用事件隔离：阻止 input 上的所有事件冒泡到编辑器
  const stopProp = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className="search-bar"
      role="search"
      aria-label="文档内搜索"
      onClick={stopProp}
      onMouseDown={stopProp}
    >
      <div className="search-bar__main">
        <svg
          className="search-bar__icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-bar__input"
          placeholder="查找…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={stopProp}
          onKeyPress={stopProp}
          onInput={stopProp}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
        />
        <span className="search-bar__count">{matchText}</span>
        <button
          type="button"
          className={`search-bar__toggle${caseSensitive ? " search-bar__toggle--active" : ""}`}
          onClick={() => setCaseSensitive((v) => !v)}
          title="区分大小写 (Aa)"
          aria-pressed={caseSensitive}
        >
          Aa
        </button>
        <button
          type="button"
          className={`search-bar__toggle${wholeWord ? " search-bar__toggle--active" : ""}`}
          onClick={() => setWholeWord((v) => !v)}
          title="整词匹配 (\b)"
          aria-pressed={wholeWord}
        >
          \b
        </button>
        <div className="search-bar__sep" />
        <button
          type="button"
          className="search-bar__btn"
          onClick={handlePrev}
          title="上一个 (Shift+Enter)"
          disabled={!info || info.matches.length === 0}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          className="search-bar__btn"
          onClick={handleNext}
          title="下一个 (Enter)"
          disabled={!info || info.matches.length === 0}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          className="search-bar__btn search-bar__btn--close"
          onClick={onClose}
          title="关闭 (Esc)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
