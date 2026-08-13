# Qingwu UI (青梧UI)

> A component library built for Chinese users: **from a lunar-calendar date picker to an AI-rich-text editor**.

Solar terms, lunar dates, almanac advice, and official holiday scheduling — the Chinese-specific scenarios most component libraries gloss over are first-class citizens in Qingwu's calendar. Chinese-first AI writing (DeepSeek / Qwen / OpenAI), Obsidian-style Markdown, and runtime zh/en switching — the high-frequency needs of Chinese users — ship as a ready-to-use AI editor. Around them sits a **zero-dependency, framework-agnostic** component matrix.

## Highlights

- 🪶 **Zero dependencies** — every light component is pure TypeScript + native DOM, framework-agnostic; a thin React / Vue wrapper is all it takes
- 🧠 **AI flagship** — `@apricotdream/ai-editor`, a Chinese-first AI rich-text editor, bundled with a browser clipper extension (Web Clipper)
- ♿ **Accessibility built-in** — ARIA dialog / combobox / listbox / live-region semantics, fully keyboard-navigable
- 🌗 **Motion restraint** — every component honors `prefers-reduced-motion`
- 📦 **On-demand imports** — ESM + CJS dual builds, precise `sideEffects` annotations, fully tree-shakable

---

## Flagship: @apricotdream/ai-editor — Chinese-first AI rich-text editor

Built on Tiptap + React 19 with the Vercel AI SDK, one component gets you a full writing workbench:

- **AI writing assistant** — continue, polish, condense, expand, fix, translate, or follow custom instructions
- **Browser clipper extension** — the companion Qingwu Web Clipper (Chrome / Edge / Firefox) turns any web page into Markdown and pushes it back to the editor, with AI-generated summaries and tags
- **Rich media embedding** — images, video (Bilibili / direct links / Xiaohongshu), audio, and attachments; **206+ formats previewable online** (Office / PDF / CAD / archives)
- **Markdown paste** — Obsidian-style `[[link]]` / `![[image]]` syntax
- **Multiple storage backends** — local / Aliyun OSS / Tencent COS / S3-compatible, with persisted configuration
- **Bilingual** — switch between zh/en at runtime, no page reload

```tsx
import { QingWuAIEditor } from "@apricotdream/ai-editor";
import "@apricotdream/ai-editor/styles";

<QingWuAIEditor
  placeholder="Start writing…"
  onChange={(html) => console.log(html)}
/>
```

Full docs (install / props / AI providers / clipper extension) in [`packages/ai-editor/README.md`](./packages/ai-editor/README.md).

---

## Package overview

| Package | What it is | Version |
|---|---|---|
| [`@apricotdream/ai-editor`](./packages/ai-editor/README.md) | AI rich-text editor (Tiptap + React 19) + Web Clipper extension | 0.9.0-beta |
| [`@apricotdream/calendar`](./packages/calendar/ui/README.md) | Self-rendering calendar: lunar dates / solar terms / holidays / almanac | 0.9.0-beta |
| [`@apricotdream/search`](./packages/search/README.md) | Search box / command palette: typewriter placeholders, keyboard nav, categories | 0.9.0-beta |
| [`@apricotdream/select`](./packages/select/README.md) | Dropdown select: accordion stagger animation, adaptive flip | 0.9.0-beta |
| [`@apricotdream/toast`](./packages/toast/README.md) | Toast notifications: ARIA live region, promise chaining, queue management | 0.9.0-beta |
| [`@apricotdream/upload`](./packages/upload/README.md) | Image upload: drag & drop / button trigger, client-side compression (original / WebP / AVIF) | 0.9.0-beta |
| [`@apricotdream/button`](./packages/button/README.md) | Pill-shaped button: default / primary / amber / icon | 0.9.0-beta |
| [`@apricotdream/tag-input`](./packages/tag-input/README.md) | Quick tag insertion: shortcut bar + controlled / uncontrolled modes | 0.9.0-beta |
| [`@apricotdream/notifications`](./packages/notifications/README.md) | Notification bell: unread red-dot badge, accordion stagger panel | 0.9.0-beta |
| [`@apricotdream/action-menu`](./packages/action-menu/README.md) | Radial action menu: fan-out reveal, FAB / custom trigger | 0.9.0-beta |
| [`@apricotdream/skeleton`](./packages/skeleton/README.md) | Runtime-measured auto skeleton, snapshot-to-static-HTML (SSR) | 0.9.0-beta |
| [`@apricotdream/text-layout`](./packages/text-layout/README.md) | Text layout engine: Canvas measurement, virtual scroll heights, multi-line truncation | 0.9.0-beta |

> **Versioning**: all `@apricotdream/*` packages share one version (currently **0.9.0-beta**); packages with no changes just align their version number, keeping family-wide dependency consistency.

## Install

All packages are published to the public npm registry; install on demand:

```bash
# One-shot flagship combo
npm install @apricotdream/ai-editor @apricotdream/calendar @apricotdream/search

# Pick any subset
npm install @apricotdream/toast @apricotdream/select @apricotdream/upload
```

---

## Quick start: @apricotdream/calendar

A self-rendering calendar: input trigger → popover panel → lunar / solar-term / holiday / almanac details, ready on mount.

```ts
import { Calendar } from "@apricotdream/calendar";
import "@apricotdream/calendar/style.css"; // style is a separate subpath export

const cal = new Calendar(document.getElementById("calendar")!, {
  selected: "2026-07-29",
  onChange: (date) => console.log("picked:", date),
});
```

> Full API (options / instance methods / provider extension) in [`@apricotdream/calendar`](./packages/calendar/ui/README.md).

---

## Usage in frameworks

Light components are native DOM, so React / Vue need only a thin lifecycle wrapper:

```tsx
import { useEffect, useRef } from "react";
import { SearchBox, type SearchOptions } from "@apricotdream/search";
import "@apricotdream/search/style.css";

export function QingwuSearch(props: SearchOptions) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const box = new SearchBox(ref.current, props);
    return () => box.destroy();
  }, []);

  return <div ref={ref} />;
}
```

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { SearchBox } from "@apricotdream/search";
import "@apricotdream/search/style.css";

const root = ref<HTMLElement>();
let box: SearchBox | undefined;

onMounted(() => {
  box = new SearchBox(root.value!, {
    items: [{ title: "Mid-Autumn", kind: "festival" }],
    onSelect: (item) => console.log(item.title),
  });
});
onUnmounted(() => box?.destroy());
</script>

<template>
  <div ref="root" />
</template>
```

> Official thin wrappers `@apricotdream/calendar-react` / `@apricotdream/calendar-vue` are on the roadmap (below).

---

## Repository layout

```
qingwu-ui/
├── packages/
│   ├── ai-editor/       # @apricotdream/ai-editor —— AI rich-text editor + Web Clipper extension
│   ├── calendar/ui/     # @apricotdream/calendar —— self-rendering calendar
│   ├── search/          # @apricotdream/search —— search box / command palette
│   ├── select/          # @apricotdream/select —— dropdown select
│   ├── toast/           # @apricotdream/toast —— toast notifications
│   ├── upload/          # @apricotdream/upload —— image upload / client-side compression
│   ├── button/          # @apricotdream/button —— pill-shaped button
│   ├── tag-input/       # @apricotdream/tag-input —— quick tag insertion
│   ├── notifications/   # @apricotdream/notifications —— notification bell
│   ├── action-menu/     # @apricotdream/action-menu —— radial action menu
│   ├── skeleton/        # @apricotdream/skeleton —— auto skeleton
│   └── text-layout/     # @apricotdream/text-layout —— text layout engine
├── examples/nextjs/     # Next.js demo site
├── tooling/
│   ├── tsconfig/        # shared TS7 config
│   └── publish-check/   # pre-release checks (workspace deps / versions / artifacts)
└── REFACTOR_PLAN.md     # full refactor plan
```

## Local development

Requirements: [Bun](https://bun.sh) ≥ 1.3, Node ≥ 20.

```bash
bun install        # install dependencies
bun run ci         # lint + build + typecheck + test + size
bun run build      # build all packages
bun run test       # run vitest tests
```

Tech baseline: TypeScript 7 · tsdown (Rolldown) · Bun + Turborepo · Biome · vitest · size-limit.

## Release

Semantic versioning, manually maintained. **All packages share one version** (packages without changes simply align their version).

```bash
# 1) bump each package version (package.json + CHANGELOG head)
# 2) build all + run publish-check
bun run release
```

`bun run publish-check` validates: no `workspace:*` dependencies left in dist (`publish-check:fix` rewrites them), CHANGELOG head matches package.json, and all exports artifacts exist.

## Roadmap

- [x] 0.1.0 – 0.8.0 —— light component matrix matured; `@apricotdream/ai-editor` + Web Clipper joined the family
- [x] 0.9.0-beta —— `@apricotdream/calendar` adds `dateOnly` mode; all 12 packages aligned to 0.9.0-beta and published publicly
- [ ] 1.0.0 —— API freeze, official React / Vue wrappers, docs site

## License

[Apache-2.0](./LICENSE) © Qingwu UI Contributors — applies to every package (root and per-package `LICENSE` files are all Apache-2.0).
