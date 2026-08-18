# Qingwu UI (青梧UI)

> A component library built for Chinese users: **from a lunar-calendar date picker to an AI-rich-text editor**.

Solar terms, lunar dates, almanac advice, and official holiday scheduling — the Chinese-specific scenarios most component libraries gloss over are first-class citizens in Qingwu's calendar. Chinese-first AI writing (DeepSeek / Qwen / OpenAI), Obsidian-style Markdown, and runtime zh/en switching — the high-frequency needs of Chinese users — ship as a ready-to-use AI editor. Around them sits a **zero-dependency, framework-agnostic** component matrix.

## Highlights

- 🪶 **Zero dependencies** — every light component is pure TypeScript + native DOM, framework-agnostic; a thin React / Vue wrapper is all it takes
- 🧠 **AI flagship** — `@qingwu-ui/ai-editor`, a Chinese-first AI rich-text editor, bundled with a browser clipper extension (Web Clipper)
- ♿ **Accessibility built-in** — ARIA dialog / combobox / listbox / live-region semantics, fully keyboard-navigable
- 🌗 **Motion restraint** — every component honors `prefers-reduced-motion`
- 📦 **On-demand imports** — ESM + CJS dual builds, precise `sideEffects` annotations, fully tree-shakable

---

## Flagship: @qingwu-ui/ai-editor — Chinese-first AI rich-text editor

Built on Tiptap + React 19 with the Vercel AI SDK, one component gets you a full writing workbench:

- **AI writing assistant** — continue, polish, condense, expand, fix, translate, or follow custom instructions
- **Browser clipper extension** — the companion Qingwu Web Clipper (Chrome / Edge / Firefox) turns any web page into Markdown and pushes it back to the editor, with AI-generated summaries and tags
- **Rich media embedding** — images, video (Bilibili / direct links / Xiaohongshu), audio, and attachments; **206+ formats previewable online** (Office / PDF / CAD / archives)
- **Markdown paste** — Obsidian-style `[[link]]` / `![[image]]` syntax
- **Multiple storage backends** — local / Aliyun OSS / Tencent COS / S3-compatible, with persisted configuration
- **Bilingual** — switch between zh/en at runtime, no page reload

```tsx
import { QingWuAIEditor } from "@qingwu-ui/ai-editor";
import "@qingwu-ui/ai-editor/styles";

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
| [`@qingwu-ui/ai-editor`](./packages/ai-editor/README.md) | AI rich-text editor (Tiptap + React 19) + Web Clipper extension | 0.9.0-beta |
| [`@qingwu-ui/calendar`](./packages/calendar/ui/README.md) | Self-rendering calendar: lunar dates / solar terms / holidays / almanac | 0.9.0-beta |
| [`@qingwu-ui/search`](./packages/search/README.md) | Search box / command palette: typewriter placeholders, keyboard nav, categories | 0.9.0-beta |
| [`@qingwu-ui/select`](./packages/select/README.md) | Dropdown select: accordion stagger animation, adaptive flip | 0.9.0-beta |
| [`@qingwu-ui/toast`](./packages/toast/README.md) | Toast notifications: ARIA live region, promise chaining, queue management | 0.9.0-beta |
| [`@qingwu-ui/upload`](./packages/upload/README.md) | Image upload: drag & drop / button trigger, client-side compression (original / WebP / AVIF) | 0.9.0-beta |
| [`@qingwu-ui/button`](./packages/button/README.md) | Pill-shaped button: default / primary / amber / icon | 0.9.0-beta |
| [`@qingwu-ui/tag-input`](./packages/tag-input/README.md) | Quick tag insertion: shortcut bar + controlled / uncontrolled modes | 0.9.0-beta |
| [`@qingwu-ui/notifications`](./packages/notifications/README.md) | Notification bell: unread red-dot badge, accordion stagger panel, unread bell-ring swing | 0.9.0-beta |
| [`@qingwu-ui/action-menu`](./packages/action-menu/README.md) | Radial action menu: fan-out reveal, FAB / custom trigger | 0.9.0-beta |
| [`@qingwu-ui/skeleton`](./packages/skeleton/README.md) | Runtime-measured auto skeleton, snapshot-to-static-HTML (SSR) | 0.9.0-beta |
| [`@qingwu-ui/text-layout`](./packages/text-layout/README.md) | Text layout engine: Canvas measurement, virtual scroll heights, multi-line truncation | 0.9.0-beta |
| [`@qingwu-ui/carousel`](./packages/carousel/README.md) | Carousel / hero: layered two-image entrance (background slides in first, character fades up after), staggered text lines, thumbnail nav | 0.9.0-beta |

> **Versioning**: all `@qingwu-ui/*` packages share one version (currently **0.9.0-beta**); packages with no changes just align their version number, keeping family-wide dependency consistency.

## Install

All packages are published to the public npm registry; install on demand:

```bash
# One-shot flagship combo
npm install @qingwu-ui/ai-editor @qingwu-ui/calendar @qingwu-ui/search

# Pick any subset
npm install @qingwu-ui/toast @qingwu-ui/select @qingwu-ui/upload @qingwu-ui/carousel
```

---

## Quick start: @qingwu-ui/calendar

A self-rendering calendar: input trigger → popover panel → lunar / solar-term / holiday / almanac details, ready on mount.

```ts
import { Calendar } from "@qingwu-ui/calendar";
import "@qingwu-ui/calendar/style.css"; // style is a separate subpath export

const cal = new Calendar(document.getElementById("calendar")!, {
  selected: "2026-07-29",
  onChange: (date) => console.log("picked:", date),
});
```

> Full API (options / instance methods / provider extension) in [`@qingwu-ui/calendar`](./packages/calendar/ui/README.md).

---

## Quick start: @qingwu-ui/carousel

Carousel / hero component: the left visual is built from two layers — a **background image** that slides in from left to right first, then a **transparent character image** that fades up; right-column text lines slide in one by one from right to left; the bottom thumbnail rail is right-aligned to the left image's right edge and switches on click.

```ts
import { Carousel } from "@qingwu-ui/carousel";
import "@qingwu-ui/carousel/style.css"; // style is a separate subpath export

const carousel = new Carousel(document.getElementById("hero")!, {
  items: [
    {
      value: "01",
      title: "Morning Light",
      background: "/hero-01-bg.png",  // background layer: enters first
      image: "/hero-01-char.png",     // transparent character layer: enters second
    },
  ],
  autoplay: true,
  interval: 3800,
});

// carousel.next() / prev() / goTo(i) / update(...) / destroy()
```

> Full API (options / data model / entrance timing) in [`@qingwu-ui/carousel`](./packages/carousel/README.md).

---

## Usage in frameworks

Light components are native DOM, so React / Vue need only a thin lifecycle wrapper:

```tsx
import { useEffect, useRef } from "react";
import { SearchBox, type SearchOptions } from "@qingwu-ui/search";
import "@qingwu-ui/search/style.css";

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
import { SearchBox } from "@qingwu-ui/search";
import "@qingwu-ui/search/style.css";

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

> Official thin wrappers `@qingwu-ui/calendar-react` / `@qingwu-ui/calendar-vue` are on the roadmap (below).

---

## Repository layout

```
qingwu-ui/
├── packages/
│   ├── ai-editor/       # @qingwu-ui/ai-editor —— AI rich-text editor + Web Clipper extension
│   ├── calendar/ui/     # @qingwu-ui/calendar —— self-rendering calendar
│   ├── search/          # @qingwu-ui/search —— search box / command palette
│   ├── select/          # @qingwu-ui/select —— dropdown select
│   ├── toast/           # @qingwu-ui/toast —— toast notifications
│   ├── upload/          # @qingwu-ui/upload —— image upload / client-side compression
│   ├── button/          # @qingwu-ui/button —— pill-shaped button
│   ├── tag-input/       # @qingwu-ui/tag-input —— quick tag insertion
│   ├── notifications/   # @qingwu-ui/notifications —— notification bell
│   ├── action-menu/     # @qingwu-ui/action-menu —— radial action menu
│   ├── skeleton/        # @qingwu-ui/skeleton —— auto skeleton
│   ├── carousel/        # @qingwu-ui/carousel —— carousel / hero (layered entrance, thumbnail nav)
│   └── text-layout/     # @qingwu-ui/text-layout —— text layout engine
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

### Dual-remote push (gitee + github)

The source repo lives on both gitee (`origin`) and github. One command pushes the current branch to both:

```bash
bun run push:all   # equivalent to git push origin HEAD && git push github HEAD
```

The `github` remote is already configured in this repo; for fresh clones:

```bash
git remote add github git@github.com:apricotdream/qingwu-ui.git
```

## Roadmap

- [x] 0.1.0 – 0.8.0 —— light component matrix matured; `@qingwu-ui/ai-editor` + Web Clipper joined the family
- [x] 0.9.0-beta —— `@qingwu-ui/calendar` adds `dateOnly` mode; all 13 packages aligned to 0.9.0-beta (including the new `@qingwu-ui/carousel`) and published publicly
- [ ] 1.0.0 —— API freeze, official React / Vue wrappers, docs site

## License

[Apache-2.0](./LICENSE) © Qingwu UI Contributors — applies to every package (root and per-package `LICENSE` files are all Apache-2.0).
