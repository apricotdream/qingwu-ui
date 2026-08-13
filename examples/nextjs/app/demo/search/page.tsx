"use client";

import { SearchBox } from "@apricotdream/search";
import "@apricotdream/button/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";

const ITEMS = [
  { title: "中秋节", sub: "农历八月十五 · 团圆赏月", kind: "节日", glyph: "秋" },
  { title: "春节", sub: "农历正月初一 · 丙午马年", kind: "节日", glyph: "春" },
  { title: "端午节", sub: "农历五月初五 · 龙舟竞渡", kind: "节日", glyph: "端" },
  { title: "霜降", sub: "秋季最后一个节气", kind: "节气", glyph: "霜" },
  { title: "立春", sub: "二十四节气之首 · 东风解冻", kind: "节气", glyph: "立" },
  { title: "冬至", sub: "阴极之至 · 阳气始生", kind: "节气", glyph: "冬" },
  { title: "丙午马年", sub: "2026 农历干支", kind: "干支", glyph: "午" },
  { title: "区间选择", sub: "mode = range", kind: "功能", glyph: "区" },
  { title: "多选模式", sub: "mode = multiple", kind: "功能", glyph: "多" },
  { title: "休假表插件", sub: "createHolidayPlugin()", kind: "功能", glyph: "休" },
  { title: "键盘导航", sub: "方向键 Home End PgUp PgDn Enter", kind: "功能", glyph: "⌨" },
];

/** 异步服务端模式：模拟远端数据（sub 为正文命中片段），350ms 延迟、支持 abort、含 "err" 时失败 */
const REMOTE_ITEMS = [
  {
    id: "r1",
    title: "React 并发模型",
    sub: "…useTransition 让低优先级更新让出主线程，渲染中断可恢复…",
    kind: "文章",
    glyph: "R",
  },
  {
    id: "r2",
    title: "Postgres 全文检索",
    sub: "…pg_jieba 分词 + tsvector GIN 索引，中文搜索的性价比之选…",
    kind: "文章",
    glyph: "P",
  },
  {
    id: "r3",
    title: "滚动驱动的 GSAP 动效",
    sub: "…ScrollTrigger 将页面滚动进度映射为时间线播放位置…",
    kind: "文章",
    glyph: "G",
  },
  {
    id: "r4",
    title: "Go 服务端改造笔记",
    sub: "…Gin + GORM 迁走 Node 服务，全文检索的取舍与索引设计…",
    kind: "文章",
    glyph: "G",
  },
  { id: "r5", title: "端午安康", sub: "农历五月初五 · 龙舟竞渡", kind: "节日", glyph: "端" },
];

function mockRemoteSearch(q: string, signal: AbortSignal): Promise<typeof REMOTE_ITEMS> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const kw = q.toLowerCase();
      if (kw.includes("err")) {
        reject(new Error("mock failure"));
        return;
      }
      resolve(
        REMOTE_ITEMS.filter((it) => `${it.title} ${it.sub ?? ""}`.toLowerCase().includes(kw)),
      );
    }, 350);
    signal.addEventListener("abort", () => clearTimeout(timer));
  });
}

const DEFAULT_PLACEHOLDERS = "搜索节日 · 如「中秋节」";

/** props 面板字段定义 */
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "select" | "boolean";
  defaultValue: string;
  options?: { label: string; value: string }[];
}

const FIELDS: FieldDef[] = [
  { key: "placeholders", label: "占位文本", type: "text", defaultValue: DEFAULT_PLACEHOLDERS },
  {
    key: "categories",
    label: "类别筛选",
    type: "select",
    defaultValue: "全部,节日,节气,功能",
    options: [
      { label: "无", value: "" },
      { label: "全部,节日,节气", value: "全部,节日,节气" },
      { label: "全部,节日,节气,功能", value: "全部,节日,节气,功能" },
      { label: "全部,节日,节气,功能,干支", value: "全部,节日,节气,功能,干支" },
    ],
  },
  {
    key: "typewriter",
    label: "打字机动效",
    type: "boolean",
    defaultValue: "true",
    options: [
      { label: "开启", value: "true" },
      { label: "关闭", value: "false" },
    ],
  },
  {
    key: "mode",
    label: "搜索模式",
    type: "select",
    defaultValue: "local",
    options: [
      { label: "本地筛选（items）", value: "local" },
      { label: "异步服务端（search）", value: "async" },
    ],
  },
  {
    key: "loadingSpriteUrl",
    label: "加载精灵图 URL",
    type: "text",
    defaultValue: "",
  },
];

export default function SearchPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sbRef = useRef<SearchBox | null>(null);

  const [props, setProps] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.defaultValue])),
  );

  const [log, setLog] = useState<string[]>([]);
  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const renderSearch = useCallback(
    (currentProps: Record<string, string>) => {
      const el = rootRef.current;
      if (!el) return;

      if (sbRef.current) {
        sbRef.current.destroy();
        sbRef.current = null;
      }
      el.textContent = "";

      const opts: Record<string, unknown> = {};

      const ph = currentProps.placeholders?.trim();
      if (ph)
        opts.placeholders = ph
          .split("·")
          .map((s) => s.trim())
          .filter(Boolean);

      const cats = currentProps.categories?.trim();
      if (cats) opts.categories = cats.split(",").map((s) => s.trim());

      opts.typewriter = currentProps.typewriter === "true";

      if (currentProps.mode === "async") {
        opts.search = (q: string, signal: AbortSignal) =>
          mockRemoteSearch(q, signal).then((rows) => {
            addLog(`异步「${q}」返回 ${rows.length} 条`);
            return rows;
          });
        opts.debounceMs = 300;
        opts.onQueryChange = (q: string) => addLog(`输入变化：${q || "（空）"}`);
      } else {
        opts.items = ITEMS;
      }
      const sprite = currentProps.loadingSpriteUrl?.trim();
      if (sprite) opts.loadingSpriteUrl = sprite;
      opts.onSelect = (item: { title: string; id?: string }) =>
        addLog(`选择了「${item.title}」${item.id ? ` · id=${item.id}` : ""}`);

      sbRef.current = new SearchBox(el, opts);
      addLog(`搜索渲染完成（${currentProps.mode === "async" ? "异步服务端" : "本地筛选"}模式）`);
    },
    [addLog],
  );

  useEffect(() => {
    renderSearch(props);
    return () => {
      if (sbRef.current) sbRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = () => {
    renderSearch(props);
  };

  /* 构建公共 opts 配置行 */
  const buildOptsLines = () => {
    const lines: string[] = [];
    const ph = props.placeholders?.trim();
    if (ph) {
      const phArr = ph
        .split("·")
        .map((s) => `"${s.trim()}"`)
        .filter(Boolean);
      lines.push(`  placeholders: [${phArr.join(", ")}],`);
    }
    const cats = props.categories?.trim();
    if (cats) {
      lines.push(
        `  categories: [${cats
          .split(",")
          .map((s) => `"${s.trim()}"`)
          .join(", ")}],`,
      );
    }
    if (props.typewriter === "false") {
      lines.push("  typewriter: false,");
    }
    if (props.mode === "async") {
      lines.push(
        "  search: async (q, signal) =>",
        "    fetch(`/api/search?q=${q}`, { signal }).then((r) => r.json()),",
      );
      lines.push("  debounceMs: 300,");
      const sprite = props.loadingSpriteUrl?.trim();
      if (sprite) lines.push(`  loadingSpriteUrl: "${sprite}",`);
    } else {
      lines.push("  items: [ /* ... 搜索条目 */ ],");
    }
    lines.push("  onSelect: (item) => console.log(item),");
    return lines;
  };

  /* 多格式代码 */
  const snippets = (() => {
    const optsLines = buildOptsLines();
    const optsBlock = optsLines.length > 0 ? ["{", ...optsLines, "}"].join("\n    ") : "{}";

    const react = [
      'import { SearchBox } from "@apricotdream/search";',
      'import "@apricotdream/search/style.css";',
      "",
      "function CommandPalette() {",
      "  const rootRef = useRef<HTMLDivElement>(null);",
      "  const sbRef = useRef<SearchBox | null>(null);",
      "",
      "  useEffect(() => {",
      "    const el = rootRef.current;",
      "    if (!el) return;",
      `    sbRef.current = new SearchBox(el, ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines,
      optsLines.length > 0 ? "    });" : "    {});",
      "    return () => sbRef.current?.destroy();",
      "  }, []);",
      "",
      "  return <div ref={rootRef} />;",
      "}",
    ].join("\n");

    const html = [
      "<!DOCTYPE html>",
      '<html lang="zh-CN">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <script type="module">',
      '    import { SearchBox } from "https://unpkg.com/@apricotdream/search";',
      "  </script>",
      '  <link rel="stylesheet" href="https://unpkg.com/@apricotdream/search/style.css" />',
      "</head>",
      "<body>",
      '  <div id="root"></div>',
      "  <script>",
      `    const sb = new SearchBox(document.querySelector("#root"), ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines.map((l) => `    ${l}`),
      optsLines.length > 0 ? "    });" : "    {});",
      "  </script>",
      "</body>",
      "</html>",
    ].join("\n");

    const vue = [
      "<template>",
      '  <div ref="rootRef"></div>',
      "</template>",
      "",
      '<script setup lang="ts">',
      'import { ref, onMounted, onUnmounted } from "vue";',
      'import { SearchBox } from "@apricotdream/search";',
      'import "@apricotdream/search/style.css";',
      "",
      "const rootRef = ref<HTMLDivElement>();",
      "let sb: SearchBox | null = null;",
      "",
      "onMounted(() => {",
      "  if (!rootRef.value) return;",
      `  sb = new SearchBox(rootRef.value, ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines,
      optsLines.length > 0 ? "  });" : "  {});",
      "});",
      "",
      "onUnmounted(() => sb?.destroy());",
      "</script>",
    ].join("\n");

    return { react, html, vue };
  })();

  return (
    <div className="demo-grid">
      <DemoCard
        title="Search 搜索"
        desc="打字机轮播占位提示 + @property 三色流光边框 + 类别筛选轮转 + 全键盘导航。按 / 或 Ctrl+K 打开面板；支持异步服务端搜索（search 选项：防抖 + 竞态取消 + 加载/错误态）。"
        full
        snippets={snippets}
      >
        {/* props 面板 */}
        <div className="cal-props-panel">
          <div className="cal-props-grid">
            {FIELDS.map((field) => (
              <label key={field.key} className="cal-props-field">
                <span className="cal-props-label">{field.label}</span>
                {field.type === "boolean" ? (
                  <select
                    className="cal-props-input"
                    value={props[field.key]}
                    onChange={(e) => setProps((p) => ({ ...p, [field.key]: e.target.value }))}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="cal-props-input"
                    type={field.type === "text" ? "text" : field.type}
                    value={props[field.key]}
                    onChange={(e) => setProps((p) => ({ ...p, [field.key]: e.target.value }))}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="cal-props-actions">
            <button className="qw-btn qw-btn-primary" type="button" onClick={handleConfirm}>
              应用配置
            </button>
          </div>
        </div>

        {/* 搜索挂载点 + 日志 */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div ref={rootRef} />
          <div className="cal-log-panel">
            <div className="cal-log-title">操作日志</div>
            <div className="cal-log-list">
              {log.length === 0 ? (
                <div className="cal-log-empty">暂无日志，操作搜索后将在此显示</div>
              ) : (
                log.map((msg, i) => (
                  <div key={i} className="cal-log-item">
                    {msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DemoCard>
    </div>
  );
}
