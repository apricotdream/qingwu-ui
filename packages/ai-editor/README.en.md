# 青梧 · QingWu Editor

> A smart rich-text editor for Chinese users, built on Tiptap + React, with DeepSeek, Qwen, OpenAI and other LLM integrations.

<p align="center">
  <img src="./public/logo.png" width="80" alt="QingWu Logo" />
</p>

---

## Features

- **AI writing assistant** - continue, polish, condense, expand, fix, translate, custom prompts, via the unified Vercel AI SDK interface
- **Rich media embeds** - images, video (Bilibili / direct link / Xiaohongshu), audio, attachments (206+ formats online preview)
- **Markdown paste** - Obsidian-style `[[link]]` and `![[image]]` syntax
- **Multiple storage backends** - local / Alibaba Cloud OSS / Tencent Cloud COS / S3-compatible storage, with persisted config
- **Bilingual (ZH/EN)** - switchable at runtime, no reload
- **Slash commands** - `/` to insert headings, lists, images, video, etc.
- **Code highlighting** - 30+ languages via lowlight
- **Math formulas** - [KaTeX](https://katex.org/)
- **Video playback** - [xgplayer](https://h5player.bytedance.com/)
- **File preview** - based on @file-viewer/react-full, supports Office / PDF / CAD / archives and 206+ formats
- **Export** - HTML / Markdown / JSON / plain text / PDF
- **Editable** - readonly mode for pure display scenarios

## Install

```bash
npm install @qingwu/ai-editor
```

Or clone the repo (qingwu-ui monorepo, in `packages/ai-editor`):

```bash
git clone https://github.com/apricotdream/qingwu-ui.git
cd qingwu-ui/packages/ai-editor
bun install
bun run dev
```

## Quick Start

### Use as an npm dependency

```tsx
import { QingWuAIEditor, t, setLocale } from "@qingwu/ai-editor";

function App() {
  return (
    <QingWuAIEditor
      placeholder="Start writing…"
      onChange={(html, json) => console.log(html)}
      // Attachment upload limits (required): 50MB per file, 100MB total
      maxAttachmentSize={50 * 1024 * 1024}
      maxTotalAttachmentSize={100 * 1024 * 1024}
    />
  );
}
```

### Configure the writing assistant

```ts
import {
  setAIProvider,
  createAILanguageModelProvider,
} from "@qingwu/ai-editor";

// Generic interface - supports any OpenAI-compatible API
const provider = await createAILanguageModelProvider({
  apiKey: "sk-xxx",
  baseURL: "https://api.deepseek.com/v1",  // DeepSeek
  model: "deepseek-chat",
});
setAIProvider(provider);

// To switch to Qwen, just change baseURL and model:
// baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
// model: "qwen-plus"
```

### Configure cloud storage

```ts
import { setStorageProvider, createOSSStorage } from "@qingwu/ai-editor";

setStorageProvider(
  createOSSStorage({
    region: "oss-cn-hangzhou",
    bucket: "my-bucket",
    accessKeyId: "xxx",
    accessKeySecret: "xxx",
  })
);
```

### Switch language

```ts
import { setLocale } from "@qingwu/ai-editor";

setLocale("en-US"); // switch to English
setLocale("zh-CN"); // switch to Chinese
```

## Browser extension (QingWu Web Clipper)

[QingWu Web Clipper](./extension) is the companion browser clipping extension. Clip web content into QingWu Editor with one click. Supports Chrome / Edge / Firefox.

### Features

- **Multi-mode clipping** - full page / selection / link bookmark / image URL
- **AI summary & tags** - auto-generate summary and tags (requires AI config)
- **Template rendering** - custom Markdown templates with variables
- **History management** - local IndexedDB storage, with search / favorite / delete
- **Push to editor** - push clips to QingWu Editor via local receiver or browser channel
- **Multiple triggers** - floating ball, context menu, keyboard shortcuts

### Install

```bash
# One-click build for all browser extension packages (Windows / Linux / Mac)
cd extension
./build-extension.bat   # Windows
./build-extension.sh    # Linux / Mac
```

Build artifacts are in `extension/dist/`:

- `qingwu-clipper-chrome-v*.zip` / `edge` / `firefox` - packaged for store upload
- `dist/chrome` / `edge` / `firefox` - load directly as "unpacked extension" for debugging

#### Load unpacked extension (dev debugging)

| Browser | Steps |
|--------|------|
| **Chrome** | Open `chrome://extensions` -> enable "Developer mode" -> "Load unpacked" -> select `extension/dist/chrome` |
| **Edge** | Open `edge://extensions` -> enable "Developer mode" -> "Load unpacked" -> select `extension/dist/edge` |
| **Firefox** | Open `about:debugging#/runtime/this-firefox` -> "Load Temporary Add-on" -> select `extension/dist/firefox/manifest.json` |

After loading, the QingWu extension icon appears in the browser toolbar.

### Usage

#### Quick entry points

| Action | Entry |
|------|------|
| Clip current page | Shortcut `Alt+Shift+C` / context menu / floating ball |
| Clip selection | Select text, then context menu |
| Open sidebar | Shortcut `Alt+Shift+P` / click the extension icon |

#### First-use tutorial

1. **Load the extension** - follow the "Load unpacked extension" steps above to load the build artifacts into the browser
2. **Trigger a clip** - open any page, hover the right edge to show the floating ball (or press `Alt+Shift+C`); click it to auto-extract the main content
3. **Edit the draft** - after clipping, content enters the sidebar draft; edit title / path / tags
4. **Save & push** - click "Save", then "Push to editor" (receiver must be enabled in the editor) or "Download Markdown"

> Pushing to the editor requires enabling the "Receive clips" toggle on the editor side (homepage banner -> About the extension). The extension pushes via the local receiver `http://127.0.0.1:7321` or the browser channel.

### Connect to the editor

Start a receiver on the editor side to accept clips pushed by the extension:

```ts
import { startClipperReceiver } from "@qingwu/ai-editor";

await startClipperReceiver({
  port: 7321,
  onClip: (clip) => {
    editor.commands.setContent(clip.markdown);
  },
});
```

HTTP endpoint `POST http://127.0.0.1:7321/clip`, request body (`IncomingClip`):

| Field | Type | Required | Description |
|------|------|------|------|
| `markdown` | string | yes | Clipped Markdown body |
| `title` | string | yes | Title |
| `path` | string | no | Note path |
| `tags` | string[] | no | Tags |
| `sourceUrl` | string | no | Source URL |
| `capturedAt` | string | no | Capture time (ISO) |

**Unified response format** (eliminates legacy field redundancy / inconsistent error codes):

- Success: `{ ok: true, data?: { at: string } }`
- Failure: `{ ok: false, error: { code: ClipperErrorCode; message: string } }`

Error codes (stable, so the extension can handle them precisely):

| code | HTTP | Description |
|------|------|------|
| `UNAUTHORIZED` | 401 | token verification failed |
| `INVALID_JSON` | 400 | request body is not valid JSON |
| `MARKDOWN_REQUIRED` | 422 | missing `markdown` field |
| `NOT_FOUND` | 404 | route not found |
| `INTERNAL` | 500 | internal error |

For pure browser scenarios (no Node runtime), use `startBrowserClipperReceiver`, which receives via `window.postMessage` without HTTP:

```ts
import { startBrowserClipperReceiver } from "@qingwu/ai-editor";

startBrowserClipperReceiver({
  onClip: (clip) => editor.commands.setContent(clip.markdown),
});
```

### Configuration

In the extension sidebar "Settings":

- **Push method** - HTTP (default, push to local receiver) / File (download Markdown to a specified directory)
- **HTTP endpoint** - default `http://127.0.0.1:7321/clip`
- **Editor page URL** - fallback editor URL when HTTP is unreachable (default `http://localhost:5173`)

## API

### `<QingWuAIEditor>` Props

| Prop | Type | Default | Description |
|------|------|--------|------|
| `initialContent` | `string` | `""` | Initial HTML content (auto-sanitized) |
| `onChange` | `(html: string, json: object) => void` | - | Content change callback |
| `placeholder` | `string` | `"Type '/' for menu…"` | Placeholder text |
| `mode` | `"edit" \| "view"` | `"edit"` | Editor mode; `"view"` for read-only |
| `readonly` | `boolean` | `false` | **Deprecated**, use `mode="view"` instead |
| `maxLength` | `number` | - | Max character limit |
| `maxAttachmentSize` | `number` | **required** | Max size of a single uploaded file (bytes); oversize files are blocked and reported via `onToast` |
| `maxTotalAttachmentSize` | `number` | **required** | Max total size of all attachments in the document (bytes); new uploads rejected when exceeded |
| `onToast` | `(message: string, type: `"success"` \| `"error"` \| `"info"`) => void` | - | Global toast callback (attachment limit blocks / document oversize warnings). Wire it to your own toast component; **messages are silently dropped when omitted** |
| `className` | `string` | `""` | Custom class name |
| `style` | `React.CSSProperties` | - | Custom container style |
| `borderless` | `boolean` | `false` | Hide editor outer border |
| `showToolbar` | `boolean` | `true` | Show top toolbar (export) |
| `showToc` | `boolean` | `true` | Show TOC sidebar |
| `showSearch` | `boolean` | `true` | Enable full-text search (Ctrl+F) |
| `onEditorReady` | `(editor: Editor) => void` | - | Editor instance ready callback |

### Writing assistant

```ts
setAIProvider(provider: AIProvider): void
getAIProvider(): AIProvider
createAILanguageModelProvider(config: AILanguageModelConfig): Promise<AIProvider>
```

### Storage

```ts
setStorageProvider(provider: StorageProvider, config?: StorageConfig): void
getStorageProvider(): StorageProvider
getStorageInfo(): { name, type, config } | null
loadStorageConfig(): StorageConfig | null

// Built-in providers
createLocalStorage(): StorageProvider
createOSSStorage(config: OSSStorageConfig): StorageProvider
createCOSStorage(config: COSStorageConfig): StorageProvider
createS3Storage(config: S3StorageOptions): StorageProvider
```

### i18n

```ts
setLocale(locale: "zh-CN" | "en-US"): void
getLocale(): Locale
t(path: string): string
tf(path: string, ...args): string  // named / positional placeholder interpolation
```

### Extension helpers

```ts
getEditorExtensions(config?: EditorExtensionsConfig): Extension[]
createSlashCommandExtension(getItems: () => SlashCommandItem[]): Extension
getDefaultSlashCommands(t: (key: string) => string): SlashCommandItem[]
getBubbleMenuActions(t: (key: string) => string): BubbleMenuAction[]
setSearchEngine(template: string): void
getSearchEngine(): string
```

## Development

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Type check
npm run typecheck

# Build
npm run build

# Test
npm test
```

## Tech stack

| Layer | Tech |
|------|------|
| Editor core | [Tiptap](https://tiptap.dev/) (ProseMirror) |
| UI framework | React 19 |
| Command palette | [cmdk](https://cmdk.paco.me/) |
| AI SDK | [Vercel AI SDK](https://sdk.vercel.ai/) |
| Code highlighting | [lowlight](https://github.com/wooorm/lowlight) |
| Math formulas | [KaTeX](https://katex.org/) |
| Video playback | [xgplayer](https://h5player.bytedance.com/) |
| File preview | [FileViewer](https://doc.file-viewer.app/) |
| Animation | [Framer Motion](https://www.framer.com/motion/) |
| Build | [Vite](https://vitejs.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |

## License

[Apache-2.0](./LICENSE) © 2026 QingWu Contributors

---

<p align="center">
  <sub>Tribute to <a href="https://github.com/steven-tey/novel">Novel</a> (steven-tey/novel); QingWu Editor is built inspired by it.</sub>
</p>

