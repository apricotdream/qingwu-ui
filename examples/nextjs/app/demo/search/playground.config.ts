import { SearchBox, type SearchItem, type SearchOptions } from "@qingwu-ui/search";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

export const LOCAL_ITEMS: SearchItem[] = [
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
const REMOTE_ITEMS: SearchItem[] = [
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

export function mockRemoteSearch(q: string, signal: AbortSignal): Promise<SearchItem[]> {
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

/** 生成代码用：自包含 items 字面量（抄走即跑，禁止引用外部变量） */
const LOCAL_ITEMS_LITERAL = JSON.stringify(LOCAL_ITEMS, null, 2)
  .split("\n")
  .map((l, i) => (i === 0 ? l : `  ${l}`))
  .join("\n");

const DEFAULT_PLACEHOLDERS = "搜索节日 · 如「中秋节」";

export const SEARCH_FIELDS: FieldDef[] = [
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

export function createSearch(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  const opts: SearchOptions = {
    typewriter: v.typewriter !== false,
    onSelect: (item: SearchItem) =>
      log(`选择了「${item.title}」${item.id ? ` · id=${item.id}` : ""}`),
  };

  const ph = String(v.placeholders ?? "").trim();
  if (ph)
    opts.placeholders = ph
      .split("·")
      .map((s) => s.trim())
      .filter(Boolean);

  const cats = String(v.categories ?? "").trim();
  if (cats) opts.categories = cats.split(",").map((s) => s.trim());

  if (v.mode === "async") {
    opts.search = (q, signal) =>
      mockRemoteSearch(q, signal).then((rows) => {
        log(`异步「${q}」返回 ${rows.length} 条`);
        return rows;
      });
    opts.debounceMs = 300;
    opts.onQueryChange = (q) => log(`输入变化：${q || "（空）"}`);
  } else {
    opts.items = LOCAL_ITEMS;
  }

  const sprite = String(v.loadingSpriteUrl ?? "").trim();
  if (sprite) opts.loadingSpriteUrl = sprite;

  const sb = new SearchBox(host, opts);
  log(`SearchBox 渲染完成（${v.mode === "async" ? "异步服务端" : "本地筛选"}模式）`);

  return {
    destroy: () => sb.destroy(),
  };
}

export function searchToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = [];

  const ph = String(v.placeholders ?? "").trim();
  if (ph) {
    const phArr = ph
      .split("·")
      .map((s) => `"${s.trim()}"`)
      .filter(Boolean);
    lines.push(`  placeholders: [${phArr.join(", ")}],`);
  }

  const cats = String(v.categories ?? "").trim();
  if (cats) {
    lines.push(
      `  categories: [${cats
        .split(",")
        .map((s) => `"${s.trim()}"`)
        .join(", ")}],`,
    );
  }

  if (v.typewriter === false) lines.push("  typewriter: false,");

  if (v.mode === "async") {
    lines.push(
      "  search: async (q, signal) =>",
      "    fetch(`/api/search?q=${q}`, { signal }).then((r) => r.json()),",
    );
    lines.push("  debounceMs: 300,");
    const sprite = String(v.loadingSpriteUrl ?? "").trim();
    if (sprite) lines.push(`  loadingSpriteUrl: "${sprite}",`);
  } else {
    lines.push(`  items: ${LOCAL_ITEMS_LITERAL},`);
  }

  lines.push("  onSelect: (item) => console.log(item),");

  const stmt = `const sb = new SearchBox(el, {
${lines.join("\n")}
});`;

  return { meta: PKG.search, symbol: "SearchBox", stmt };
}
