# 青梧 · QingWu Editor
  <img src="./public/logo.png" width="80" alt="QingWu Logo" />
  
> 一款面向中文用户的智能富文本编辑器，基于 Tiptap + React 构建，支持 DeepSeek、通义千问、OpenAI 等大模型接入。



---

## 特性

- **智能辅助写作** - 续写、润色、精简、扩写、修正、翻译、自定义指令，基于 Vercel AI SDK 统一接口
- **丰富的媒体嵌入** - 图片、视频（B站 / 直链 / 小红书）、音频、附件（支持 206+ 格式在线预览）
- **Markdown 粘贴** - Obsidian 风格的 `[[链接]]` 和 `![[图片]]` 语法支持
- **多存储后端** - 本地存储 / 阿里云 OSS / 腾讯云 COS / S3 兼容存储，配置持久化
- **中英双语** - 运行时可切换，无需刷新页面
- **斜杠命令** - `/` 快速插入标题、列表、图片、视频等
- **代码高亮** - 支持 30+ 编程语言语法高亮（lowlight），Mermaid 图表渲染
- **视频播放** - [xgplayer](https://h5player.bytedance.com/)
- **文件预览** - 基于 @file-viewer/react-full，支持 Office / PDF / CAD / 压缩包等 206+ 格式
- **导出** - HTML / Markdown / JSON / 纯文本 / PDF
- **可编辑** - readonly 模式用于纯展示场景

## 安装

```bash
npm install @qingwu/editor
```

> **包名说明：** 对外发布的 npm 包名是 scoped 名 **`@qingwu/editor`**，`npm install` 与所有 `import` 都用它（含样式子路径 `@qingwu/editor/styles`）。历史版本曾用 unscoped 名 `qingwu-ai-editor`，现已统一为 `@qingwu/editor`；若你在旧文档/示例里看到 `qingwu-ai-editor`，请替换为 `@qingwu/editor`。

或直接克隆仓库（qingwu-ui monorepo，位于 `packages/editor`）：

```bash
git clone https://github.com/qingwu-team/qingwu-ui.git
cd qingwu-ui/packages/editor
bun install
bun run dev
```

## 快速开始

### 作为 npm 依赖使用

```tsx
import { QingWuEditor, t, setLocale } from "@qingwu/editor";

function App() {
  return (
    <QingWuEditor
      placeholder="开始写作吧…"
      onChange={(html, json) => console.log(html)}
      // 附件上传限制（必填）：单文件 50MB，文档附件总大小 100MB
      maxAttachmentSize={50 * 1024 * 1024}
      maxTotalAttachmentSize={100 * 1024 * 1024}
    />
  );
}
```

### 引入样式

> **必需且不会自动加载。** 本库打包时把 CSS 抽成独立文件 `dist/styles.css`，`import { QingWuEditor }` 只含 JS，**不会**注入任何样式。漏引样式的典型症状：编辑器排版/边框/配色异常，并且**在桌面端错误出现「移动端」的悬浮目录按钮或目录抽屉**（桌面/移动的显隐依赖样式表里的响应式断点 class，样式没加载就会全部裸露）。一旦看到这些现象，先检查下面这行 `import` 是否存在、是否生效。

```tsx
// 编辑器核心样式（必需，放在入口文件顶层，且必须在组件 import 之后能被打包器收集到）
import "@qingwu/editor/styles";

// 代码块语言图标（可选：先 npm i devicon，未安装时图标位留空、不影响功能）
import "devicon/devicon.min.css";
// 视频播放器样式（用到视频嵌入时按需引入）
import "xgplayer/dist/index.min.css";
```

> **不要依赖引用方自己的 Tailwind 来「顺带」生成样式。** 编辑器的 class 在编译后已固化进 `dist/styles.css`，而 Tailwind 默认不扫描 `node_modules`，所以宿主项目即使也用了 Tailwind，也不会为库里的断点/工具类生成规则——必须引入上面的 `styles`。

> **TypeScript 类型：** 本包已为样式子路径提供类型声明（`styles.d.ts`，经 `exports` 的 `./styles` 暴露），`import "@qingwu/editor/styles"` 通常**无需**额外配置即可通过类型检查。若你的 TS 仍报 `2307 找不到模块`，可在项目任意 `.d.ts` 补一行兜底，**不要**因此删掉样式 `import`：
> ```ts
> declare module "@qingwu/editor/styles";
> ```

### Next.js / SSR 集成

编辑器依赖浏览器环境，Next.js 等 SSR 场景需用 `dynamic` 关闭 SSR，并传 `immediatelyRender` 以避免 hydration 警告：

```tsx
import dynamic from "next/dynamic";

const Editor = dynamic(
  () => import("@qingwu/editor").then((m) => m.QingWuEditor),
  { ssr: false }
);

export default function Page() {
  return <Editor immediatelyRender={true} placeholder="开始写作…" />;
}
```

### Peer 依赖

依赖按角色分层：内部实现库（dompurify、lowlight、xgplayer、cmdk 等）声明在 `dependencies`，安装本包时自动带入；与宿主共享实例的库声明为 peerDependencies（npm 7+ 会自动安装必需项）。

**必需**（不装无法运行）：

- `react` / `react-dom` `^19`
- `@tiptap/*` `^3.28.0`
- `ai` `^7`

> 若项目已直接使用 @tiptap，请确保版本落在上述范围内，避免多份实例导致 `Adding different instances of a keyed plugin` 冲突。

**可选**（`peerDependenciesMeta` 已标记 optional，不装不影响其他功能）：

| 依赖 | 影响的功能 | 不装时的行为 |
|---|---|---|
| `@ai-sdk/openai` | `createAILanguageModelProvider()` 默认 provider | 调用该函数时报错并提示安装；用 `setAIProvider()` 自定义 provider 则完全不需要 |
| `@file-viewer/react`、`@file-viewer/preset-office`、`@file-viewer/renderer-archive`、`@file-viewer/renderer-text` | 附件在线预览（206+ 格式） | 附件块无法预览（需同时配置 worker/wasm 资源，见下节） |
| `devicon` | 代码块语言图标 | 图标位留空，语言选择与高亮正常 |

### 附件预览资源

附件预览（PDF / Word / Excel / 压缩包等）依赖 `@file-viewer` 的 worker / wasm 资源，需保证 `/file-viewer/vendor/...` 路径可访问（默认配置见 `FILE_VIEWER_OPTIONS`）。Vite 项目可用 `@file-viewer/vite-plugin` 的 `copyAssets: { mode: "dev", baseDir: "file-viewer" }` 自动生成；其他环境需手动将资源放置到静态目录。

### 配置写作助手服务

```ts
import {
  setAIProvider,
  createAILanguageModelProvider,
} from "@qingwu/editor";

// 通用接口 - 支持任意 OpenAI 兼容 API
const provider = await createAILanguageModelProvider({
  apiKey: "sk-xxx",
  baseURL: "https://api.deepseek.com/v1",  // DeepSeek
  model: "deepseek-chat",
});
setAIProvider(provider);

// 切换为通义千问只需改 baseURL 和 model：
// baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
// model: "qwen-plus"
```

### 配置云存储

```ts
import { setStorageProvider, createOSSStorage } from "@qingwu/editor";

setStorageProvider(
  createOSSStorage({
    region: "oss-cn-hangzhou",
    bucket: "my-bucket",
    accessKeyId: "xxx",
    accessKeySecret: "xxx",
  })
);
```

### 中英切换

```ts
import { setLocale } from "@qingwu/editor";

setLocale("en-US"); // 切换到英文
setLocale("zh-CN"); // 切换到中文
```

## 浏览器扩展（青梧 Web Clipper）

[青梧 Web Clipper](./extension) 是配套的浏览器剪藏扩展，一键把网页内容剪藏到青梧编辑器，支持 Chrome / Edge / Firefox。

### 功能

- **多模式剪藏** - 整页 / 选区 / 链接书签 / 图片地址
- **AI 摘要与标签** - 自动生成摘要和标签（需配置 AI）
- **模板渲染** - 自定义 Markdown 模板，支持变量
- **历史管理** - 本地 IndexedDB 存储剪藏记录，支持搜索 / 收藏 / 删除
- **推送编辑器** - 通过本地接收器或浏览器通道把剪藏推送到青梧编辑器
- **多种触发** - 悬浮球、右键菜单、快捷键

### 安装

```bash
# 一键构建全部浏览器扩展包（Windows / Linux / Mac）
cd extension
./build-extension.bat   # Windows
./build-extension.sh    # Linux / Mac
```

构建产物在 `extension/dist/`：

- `qingwu-clipper-chrome-v*.zip` / `edge` / `firefox` - 可上传商店的打包
- `dist/chrome` / `edge` / `firefox` - 可直接「加载已解压扩展」调试

#### 加载已解压扩展（开发调试）

| 浏览器 | 步骤 |
|--------|------|
| **Chrome** | 访问 `chrome://extensions` -> 打开「开发者模式」->「加载已解压」-> 选 `extension/dist/chrome` |
| **Edge** | 访问 `edge://extensions` -> 打开「开发人员模式」->「加载解压缩的扩展」-> 选 `extension/dist/edge` |
| **Firefox** | 访问 `about:debugging#/runtime/this-firefox` ->「临时载入附加组件」-> 选 `extension/dist/firefox/manifest.json` |

加载成功后浏览器工具栏出现青梧扩展图标。

### 使用

#### 快捷入口

| 操作 | 入口 |
|------|------|
| 剪藏当前页面 | 快捷键 `Alt+Shift+C` / 右键菜单 / 悬浮球 |
| 剪藏选区 | 选中文本后右键菜单 |
| 打开侧边栏 | 快捷键 `Alt+Shift+P` / 点击扩展图标 |

#### 首次使用教程

1. **加载扩展** - 按上方「加载已解压扩展」步骤把构建产物加载到浏览器
2. **触发剪藏** - 打开任意网页，鼠标移到右侧边缘出现悬浮球（或按 `Alt+Shift+C`），点击后自动提取正文
3. **编辑草稿** - 剪藏后内容进入侧边栏草稿，可编辑标题 / 路径 / 标签
4. **保存与推送** - 点「保存」后可「推送到编辑器」（需编辑器开启接收器）或「下载 Markdown」

> 推送到编辑器需在编辑器侧开启「接收剪藏」开关（首页横幅 -> 了解扩展），扩展通过本地接收器 `http://127.0.0.1:7321` 或浏览器通道推送。

### 与编辑器对接

编辑器侧启动接收器，接收扩展推送的剪藏：

> **Node / 桌面壳专用子入口：** `startClipperReceiver` / `stopClipperReceiver` 依赖 `node:http`，已从浏览器主入口移除，请从 `@qingwu/editor/clipper` 导入，避免把 Node 模块打进浏览器 / SSR 客户端产物。纯浏览器场景仍从主入口用 `startBrowserClipperReceiver`（见下文）。

```ts
import { startClipperReceiver } from "@qingwu/editor/clipper";

await startClipperReceiver({
  port: 7321,
  onClip: (clip) => {
    editor.commands.setContent(clip.markdown);
  },
});
```

HTTP 接口 `POST http://127.0.0.1:7321/clip`，请求体（`IncomingClip`）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `markdown` | string | 是 | 剪藏的 Markdown 正文 |
| `title` | string | 是 | 标题 |
| `path` | string | 否 | 笔记路径 |
| `tags` | string[] | 否 | 标签 |
| `sourceUrl` | string | 否 | 来源 URL |
| `capturedAt` | string | 否 | 捕获时间（ISO） |

**统一响应格式**（消除旧版字段冗余 / 错误码不一致）：

- 成功：`{ ok: true, data?: { at: string } }`
- 失败：`{ ok: false, error: { code: ClipperErrorCode; message: string } }`

错误码（稳定不变，扩展侧可据此精确处理）：

| code | HTTP | 说明 |
|------|------|------|
| `UNAUTHORIZED` | 401 | token 校验失败 |
| `INVALID_JSON` | 400 | 请求体不是合法 JSON |
| `MARKDOWN_REQUIRED` | 422 | 缺少 `markdown` 字段 |
| `NOT_FOUND` | 404 | 路由不存在 |
| `INTERNAL` | 500 | 内部错误 |

纯浏览器场景（无 Node 运行时）使用 `startBrowserClipperReceiver`，通过 `window.postMessage` 接收，无需 HTTP：

```ts
import { startBrowserClipperReceiver } from "@qingwu/editor";

startBrowserClipperReceiver({
  onClip: (clip) => editor.commands.setContent(clip.markdown),
});
```

### 配置

在扩展侧边栏「设置」中：

- **推送方式** — HTTP（默认，推送到本地接收器）/ 文件（下载 Markdown 到指定目录）
- **HTTP endpoint** — 默认 `http://127.0.0.1:7321/clip`
- **编辑器页面 URL** — HTTP 不可达时降级打开的编辑器地址（默认 `http://localhost:5173`）

## API

### `<QingWuEditor>` Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `initialContent` | `string` | `""` | 初始 HTML 内容（自动安全清洗） |
| `onChange` | `(html: string, json: object) => void` | - | 内容变化回调 |
| `placeholder` | `string` | `"输入 '/' 打开菜单…"` | 占位文本 |
| `mode` | `"edit" \| "view"` | `"edit"` | 编辑模式；`"view"` 为只读查看 |
| `readonly` | `boolean` | `false` | **已废弃**，请用 `mode="view"` |
| `maxLength` | `number` | - | 最大字符限制 |
| `maxAttachmentSize` | `number` | **必填** | 单文件上传大小上限（字节）；超限文件被拦截并 toast 提示 |
| `maxTotalAttachmentSize` | `number` | **必填** | 文档内所有附件总大小上限（字节）；超限拒绝新附件上传 |
| `className` | `string` | `""` | 自定义样式类名 |
| `style` | `React.CSSProperties` | - | 容器自定义样式 |
| `borderless` | `boolean` | `false` | 隐藏编辑器外边框 |
| `showToolbar` | `boolean` | `true` | 显示顶部工具栏（导出） |
| `showToc` | `boolean` | `true` | 显示目录侧栏 |
| `showSearch` | `boolean` | `true` | 启用全文搜索（Ctrl+F） |
| `onEditorReady` | `(editor: Editor) => void` | - | 编辑器实例就绪回调 |
| `immediatelyRender` | `boolean` | - | 是否立即渲染编辑器；SSR/Next.js 配合 `dynamic` ssr:false 传 `true` |

### 写作助手相关

```ts
setAIProvider(provider: AIProvider): void
getAIProvider(): AIProvider
createAILanguageModelProvider(config: AILanguageModelConfig): Promise<AIProvider>
```

### 存储相关

```ts
setStorageProvider(provider: StorageProvider, config?: StorageConfig): void
getStorageProvider(): StorageProvider
getStorageInfo(): { name, type, config } | null
loadStorageConfig(): StorageConfig | null

// 内置 Provider
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
tf(path: string, ...args): string  // 命名 / 位置占位符插值
```

### 扩展相关

```ts
getEditorExtensions(config?: EditorExtensionsConfig): Extension[]
createSlashCommandExtension(getItems: () => SlashCommandItem[]): Extension
getDefaultSlashCommands(t: (key: string) => string): SlashCommandItem[]
getBubbleMenuActions(t: (key: string) => string): BubbleMenuAction[]
setSearchEngine(template: string): void
getSearchEngine(): string
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build

# 测试
npm test
```

## 技术栈

| 层面 | 技术 |
|------|------|
| 编辑器核心 | [Tiptap](https://tiptap.dev/) (ProseMirror) |
| UI 框架 | React 19 |
| 命令面板 | [cmdk](https://cmdk.paco.me/) |
| AI 接口 | [Vercel AI SDK](https://sdk.vercel.ai/) |
| 代码高亮 | [lowlight](https://github.com/wooorm/lowlight) |
| 数学公式 | [KaTeX](https://katex.org/) |
| 视频播放 | [xgplayer](https://h5player.bytedance.com/) |
| 文件预览 | [FileViewer](https://doc.file-viewer.app/) |
| 动画 | [Framer Motion](https://www.framer.com/motion/) |
| 构建 | [Vite](https://vitejs.dev/) |
| 样式 | [Tailwind CSS](https://tailwindcss.com/) |

## License

[Apache-2.0](./LICENSE) © 2026 QingWu Contributors

---

<p align="center">
  <sub>致敬 <a href="https://github.com/steven-tey/novel">Novel</a> (steven-tey/novel)，青梧编辑器受其启发而构建。</sub>
</p>

