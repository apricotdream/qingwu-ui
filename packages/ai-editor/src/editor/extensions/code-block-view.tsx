import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isDeleteConfirmActive, setDeleteConfirmActive } from "../utils/delete-confirm";
import { DeleteConfirmDialog } from "../utils/delete-confirm-dialog";
import { sanitizeSvg } from "../utils/sanitize";

// 语言图标依赖可选 peer 依赖 devicon 样式（宿主 import "devicon/devicon.min.css"）；未引入时图标位留空

type BeautifulMermaid = typeof import("beautiful-mermaid");
let beautifulMermaidModule: BeautifulMermaid | null = null;

async function renderBeautifulMermaid(text: string): Promise<string> {
  if (!beautifulMermaidModule) {
    beautifulMermaidModule = await import("beautiful-mermaid");
  }
  const render = beautifulMermaidModule.renderMermaidSVG;
  return render(text);
}

interface LangItem {
  value: string;
  label: string;
  deviconClass?: string;
  color: string;
}

const LANGUAGES: LangItem[] = [
  {
    value: "javascript",
    label: "JavaScript",
    deviconClass: "devicon-javascript-plain",
    color: "#f0db4f",
  },
  {
    value: "typescript",
    label: "TypeScript",
    deviconClass: "devicon-typescript-plain",
    color: "#3178c6",
  },
  { value: "python", label: "Python", deviconClass: "devicon-python-plain", color: "#306998" },
  { value: "java", label: "Java", deviconClass: "devicon-java-plain", color: "#b07219" },
  { value: "go", label: "Go", deviconClass: "devicon-go-plain", color: "#00add8" },
  { value: "rust", label: "Rust", deviconClass: "devicon-rust-plain", color: "#dea584" },
  { value: "c", label: "C", deviconClass: "devicon-c-plain", color: "#555555" },
  { value: "cpp", label: "C++", deviconClass: "devicon-cplusplus-plain", color: "#f34b7d" },
  { value: "csharp", label: "C#", deviconClass: "devicon-csharp-plain", color: "#178600" },
  { value: "html", label: "HTML", deviconClass: "devicon-html5-plain", color: "#e34c26" },
  { value: "css", label: "CSS", deviconClass: "devicon-css3-plain", color: "#563d7c" },
  { value: "json", label: "JSON", deviconClass: "devicon-json-plain", color: "#292929" },
  { value: "sql", label: "SQL", deviconClass: "devicon-mysql-plain", color: "#00758f" },
  { value: "bash", label: "Bash", deviconClass: "devicon-bash-plain", color: "#3dbb58" },
  { value: "sh", label: "Shell (sh)", deviconClass: "devicon-bash-plain", color: "#3dbb58" },
  {
    value: "shell",
    label: "PowerShell",
    deviconClass: "devicon-powershell-plain",
    color: "#3dbb58",
  },
  { value: "yaml", label: "YAML", deviconClass: "devicon-yaml-plain", color: "#cb171e" },
  { value: "php", label: "PHP", deviconClass: "devicon-php-plain", color: "#4f5d95" },
  { value: "ruby", label: "Ruby", deviconClass: "devicon-ruby-plain", color: "#701516" },
  { value: "swift", label: "Swift", deviconClass: "devicon-swift-plain", color: "#f05138" },
  { value: "kotlin", label: "Kotlin", deviconClass: "devicon-kotlin-plain", color: "#a97bff" },
  {
    value: "dockerfile",
    label: "Dockerfile",
    deviconClass: "devicon-docker-plain",
    color: "#0db7ed",
  },
  { value: "vue", label: "Vue", deviconClass: "devicon-vuejs-plain", color: "#42b883" },
  { value: "react", label: "React", deviconClass: "devicon-react-plain", color: "#61dafb" },
  {
    value: "markdown",
    label: "Markdown",
    deviconClass: "devicon-markdown-plain",
    color: "#083fa1",
  },
  { value: "mermaid", label: "Mermaid", color: "#ff3670" },
  { value: "txt", label: "Plain Text", color: "#6b7280" },
];

const LANG_EXT: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  java: "java",
  go: "go",
  rust: "rs",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  html: "html",
  css: "css",
  json: "json",
  sql: "sql",
  bash: "sh",
  shell: "sh",
  yaml: "yml",
  php: "php",
  ruby: "rb",
  swift: "swift",
  kotlin: "kt",
  dockerfile: "",
  markdown: "md",
  txt: "txt",
  vue: "vue",
  react: "jsx",
};

// 语言缩写 -> 规范名（显示归一化，与 lowlight 别名对应）
const LANG_ALIAS: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  kt: "kotlin",
  cs: "csharp",
  "c++": "cpp",
  "c#": "csharp",
  golang: "go",
  yml: "yaml",
  ps1: "shell",
  jsx: "javascript",
  tsx: "typescript",
};

function isCodeContentEventTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(".cb-code-area"));
}

export function CodeBlockView({
  node,
  updateAttributes,
  editor,
  getPos,
  deleteNode,
  selected,
}: any) {
  const isEditable = editor?.isEditable ?? true;
  const isReadonly = !isEditable;
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // mermaid 渲染
  const [mermaidSvg, setMermaidSvg] = useState<string | null>(null);
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [mermaidRendering, setMermaidRendering] = useState(false);
  // 每条逻辑行折行后的真实像素高度（由隐藏镜像测量得出），用于让行号与代码逐行对齐
  const [lineHeights, setLineHeights] = useState<number[]>([]);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  // 保存触发删除时的选区范围，避免确认框交互破坏 ProseMirror 选区
  const deleteSelectionRef = useRef<{ from: number; to: number } | null>(null);

  const lang: string = node.attrs.language || "";
  const currentLang = LANGUAGES.find((l) => l.value === (LANG_ALIAS[lang] ?? lang));
  const isDiagram = lang === "mermaid";

  const stopChromeEvent = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (isCodeContentEventTarget(event.target)) return;
    event.stopPropagation();
  }, []);

  const getCodeBlockRange = useCallback(() => {
    if (!editor || typeof getPos !== "function") return null;
    const pos = getPos();
    if (typeof pos !== "number") return null;
    return { from: pos, to: pos + node.nodeSize };
  }, [editor, getPos, node.nodeSize]);

  const openDeleteConfirm = useCallback(() => {
    if (!isEditable) return;
    if (isDeleteConfirmActive()) return;
    deleteSelectionRef.current = getCodeBlockRange();
    window.getSelection()?.removeAllRanges();
    setDeleteConfirmActive(true);
    setShowDeleteConfirm(true);
  }, [getCodeBlockRange, isEditable]);

  // 行号
  const lineTexts = useMemo<string[]>(
    () => (node.textContent ? node.textContent.split("\n") : [""]),
    [node.textContent],
  );
  const lineCount = lineTexts.length;
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount],
  );

  // 搜索过滤
  const filteredLangs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) => l.label.toLowerCase().includes(q) || l.value.toLowerCase().includes(q),
    );
  }, [search]);

  // 打开下拉时聚焦搜索框
  useEffect(() => {
    if (langOpen) {
      setSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [langOpen]);

  // 点击外部关闭
  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [langOpen]);

  // ESC 关闭
  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [langOpen]);

  // Backspace/Delete 键删除代码块（选中时触发，共享标志防多选重复弹框）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (!isEditable) return;
      if (!selected) return;
      if (isDeleteConfirmActive()) return;
      e.preventDefault();
      e.stopPropagation();
      if (editor) {
        const { from, to } = editor.state.selection;
        deleteSelectionRef.current = { from, to };
      }
      // 清除浏览器选区（删除范围已存入 ref），防止确认框文字被全选高亮
      window.getSelection()?.removeAllRanges();
      setDeleteConfirmActive(true);
      setShowDeleteConfirm(true);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selected, editor, isEditable]);

  // 行号与代码逐行对齐：代码软换行后"逻辑行≠可视行"，
  // 用隐藏镜像复刻折行，测量每条逻辑行真实高度赋给对应行号。
  const setHeightsIfChanged = useCallback((next: number[]) => {
    setLineHeights((prev) => {
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
  }, []);

  const measureLineHeights = useCallback(() => {
    const pre = preRef.current;
    const mirror = mirrorRef.current;
    if (!pre || !mirror) return;
    // 让镜像内容宽度等于真实 <pre> 的内容宽度，折行点才会完全一致
    mirror.style.width = `${pre.clientWidth}px`;
    const kids = mirror.children;
    const heights = new Array<number>(kids.length);
    for (let i = 0; i < kids.length; i++) {
      heights[i] = (kids[i] as HTMLElement).offsetHeight;
    }
    setHeightsIfChanged(heights);
  }, [setHeightsIfChanged]);

  useLayoutEffect(() => {
    measureLineHeights();
  }, [measureLineHeights, lineTexts]);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    // 容器宽度变化（折行点随之变化）时重测
    const ro = new ResizeObserver(() => measureLineHeights());
    ro.observe(pre);
    window.addEventListener("resize", measureLineHeights);
    // Web 字体延迟加载会改变度量，字体就绪后再测一次
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    fonts?.ready?.then(() => measureLineHeights());
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureLineHeights);
    };
  }, [measureLineHeights]);

  const selectLang = useCallback(
    (value: string) => {
      updateAttributes({ language: value || null });
      setLangOpen(false);
    },
    [updateAttributes],
  );

  const triggerAI = useCallback(() => {
    if (!isEditable) return;
    if (editor && getPos) {
      const pos = getPos();
      editor.chain().focus().setNodeSelection(pos).run();
    }
    setLangOpen(false);
    // 通过 editor.storage.qingwuUI 触发写作助手面板（多实例安全）
    const storage = editor?.storage?.qingwuUI as { openAI?: () => void } | undefined;
    storage?.openAI?.();
  }, [editor, getPos, isEditable]);

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(node.textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [node.textContent]);

  const downloadCode = useCallback(() => {
    const ext = LANG_EXT[lang] || "txt";
    const filename = ext ? `code.${ext}` : "code.txt";
    const blob = new Blob([node.textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [node.textContent, lang]);

  // mermaid 图表渲染 - 按需加载库
  const renderMermaid = useCallback(async () => {
    if (mermaidSvg || mermaidRendering) {
      setMermaidSvg(null);
      setMermaidError(null);
      setMermaidRendering(false);
      return;
    }
    setMermaidRendering(true);
    setMermaidError(null);
    setMermaidSvg(null);
    try {
      const text = (node.textContent || "").trim();
      if (!text) {
        setMermaidError("代码块内容为空");
        return;
      }
      const svg = await renderBeautifulMermaid(text);
      const cleaned = sanitizeSvg(svg);
      setMermaidSvg(cleaned);
    } catch (e) {
      setMermaidError(e instanceof Error ? e.message : "Mermaid 渲染失败");
    } finally {
      setMermaidRendering(false);
    }
  }, [node.textContent, mermaidSvg, mermaidRendering]);

  // 语言显示图标+名称（可编辑和只读模式共用）
  const langDisplay = (
    <>
      {currentLang ? (
        currentLang.deviconClass ? (
          <i
            className={`${currentLang.deviconClass} colored cb-lang-icon`}
            style={{ color: currentLang.color }}
          />
        ) : (
          <span className="cb-lang-icon cb-lang-icon--auto">Tx</span>
        )
      ) : (
        <span className="cb-lang-icon cb-lang-icon--auto">?</span>
      )}
      <span className="cb-lang-label">{currentLang?.label || "自动"}</span>
    </>
  );

  return (
    <NodeViewWrapper
      as="div"
      className="code-block-node-view group/cb"
      onMouseDown={stopChromeEvent}
      onTouchStart={stopChromeEvent}
    >
      {/* 顶部栏 - 语言始终可见，操作按钮 hover 显示 */}
      <div className="cb-header" contentEditable={false}>
        <div className="cb-lang-wrap" ref={langDropdownRef} contentEditable={false}>
          {isReadonly ? (
            <span className="cb-lang-trigger cb-lang-trigger--static">{langDisplay}</span>
          ) : (
            <button
              type="button"
              className="cb-lang-trigger"
              onClick={() => setLangOpen(!langOpen)}
            >
              {langDisplay}
              <svg
                className={`cb-lang-chevron${langOpen ? " cb-lang-chevron--open" : ""}`}
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}

          {isEditable && langOpen && (
            <div className="cb-lang-dropdown">
              {/* 搜索框 */}
              <div className="cb-lang-search-wrap">
                <svg
                  className="cb-lang-search-icon"
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
                  ref={searchInputRef}
                  className="cb-lang-search"
                  type="text"
                  placeholder="搜索语言..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="cb-lang-list">
                <button
                  type="button"
                  className={`cb-lang-option${!lang ? " cb-lang-option--active" : ""}`}
                  onClick={() => selectLang("")}
                >
                  <span className="cb-lang-icon cb-lang-icon--auto">?</span>
                  <span>自动检测</span>
                </button>
                {filteredLangs.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    className={`cb-lang-option${lang === l.value ? " cb-lang-option--active" : ""}`}
                    onClick={() => selectLang(l.value)}
                  >
                    {l.deviconClass ? (
                      <i
                        className={`${l.deviconClass} colored cb-lang-icon`}
                        style={{ color: l.color }}
                      />
                    ) : (
                      <span className="cb-lang-icon cb-lang-icon--auto">Tx</span>
                    )}
                    <span>{l.label}</span>
                  </button>
                ))}
                {filteredLangs.length === 0 && <div className="cb-lang-empty">无匹配语言</div>}
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 - hover 时显示 */}
        <div className="cb-actions">
          <button
            type="button"
            className="cb-btn"
            onClick={() => setCollapsed(!collapsed)}
            contentEditable={false}
            title={collapsed ? "展开" : "折叠"}
          >
            <svg
              className="cb-btn-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
              )}
            </svg>
          </button>
          <button
            type="button"
            className="cb-btn"
            onClick={copyCode}
            contentEditable={false}
            title="复制"
          >
            {copied ? (
              <svg
                className="cb-btn-icon cb-btn-icon--check"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                className="cb-btn-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="cb-btn"
            onClick={downloadCode}
            contentEditable={false}
            title="下载"
          >
            <svg
              className="cb-btn-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
          {isEditable && (
            <>
              <button
                type="button"
                className="cb-btn cb-btn--ai"
                onClick={triggerAI}
                contentEditable={false}
                title="写作助手"
              >
                <svg
                  className="cb-btn-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="cb-btn cb-btn--del"
                onClick={openDeleteConfirm}
                contentEditable={false}
                title="删除代码块"
              >
                <svg
                  className="cb-btn-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </>
          )}
          {isDiagram && (
            <button
              type="button"
              className="cb-btn cb-btn--diagram"
              onClick={renderMermaid}
              contentEditable={false}
              title={mermaidSvg || mermaidRendering ? "取消渲染" : "渲染图表"}
              disabled={mermaidRendering}
            >
              <svg
                className="cb-btn-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className={`cb-code-area${collapsed ? " cb-code-area--collapsed" : ""}`}>
        {/* 行号 */}
        <div className="cb-line-numbers" contentEditable={false} aria-hidden="true">
          {lineNumbers.map((n, i) => (
            <span
              key={n}
              className="cb-line-num"
              style={lineHeights[i] ? { height: lineHeights[i] } : undefined}
            >
              {n}
            </span>
          ))}
        </div>
        <pre className="cb-code-pre" ref={preRef}>
          <NodeViewContent<"code"> as="code" />
        </pre>
        {/* 隐藏镜像：复刻代码区折行，逐行测量逻辑行的真实高度（不触碰可编辑 DOM） */}
        <div ref={mirrorRef} className="cb-code-mirror" contentEditable={false} aria-hidden="true">
          {lineTexts.map((t, i) => (
            <span key={i} className="cb-mirror-line">
              {t.length ? t : " "}
            </span>
          ))}
        </div>
      </div>

      {/* Mermaid 图表渲染结果 */}
      {(mermaidSvg || mermaidError || mermaidRendering) && (
        <div className="cb-diagram-output" contentEditable={false}>
          {mermaidRendering && <div className="cb-diagram-loading">渲染图表中…</div>}
          {mermaidError && (
            <div className="cb-diagram-error">
              <span className="cb-diagram-error-icon">!</span>
              {mermaidError}
            </div>
          )}
          {mermaidSvg && (
            <div className="cb-diagram-svg" dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
          )}
        </div>
      )}

      {/* 删除确认对话框 - select-none 防止 Ctrl+A 全选时把弹框文字也选中 */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title="确认删除代码块"
        message="此操作不可撤销。"
        onCancel={() => {
          setDeleteConfirmActive(false);
          setShowDeleteConfirm(false);
        }}
        onConfirm={async () => {
          // 本地删除：给「删除中」动画一个最小展示时长
          await new Promise((r) => setTimeout(r, 300));
          setDeleteConfirmActive(false);
          if (editor) {
            const range = deleteSelectionRef.current ?? getCodeBlockRange();
            if (range) {
              editor.chain().focus().setTextSelection(range).deleteSelection().run();
            } else {
              deleteNode();
            }
          } else {
            deleteNode();
          }
        }}
      />
    </NodeViewWrapper>
  );
}
