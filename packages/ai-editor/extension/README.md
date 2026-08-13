# 青梧 Web Clipper · 浏览器扩展

> 面向青梧 AI 编辑器的现代化网页剪藏插件 · Chrome / Edge / Firefox 通用

<p align="center">
  <img src="../public/favicon.svg" width="64" alt="QingWu Logo" />
</p>

---

## 为什么再造一个？

调研 Obsidian Web Clipper 后，我们发现以下痛点：

| Obsidian Web Clipper 痛点 | 青梧 Web Clipper 解法 |
|---|---|
| AI 失败静默无反馈 | 所有 AI 错误结构化（code + 用户可读 message + retryable），Toast 显示，附重试按钮 |
| DeepSeek 请求路径 404 | 自动补全 `/v1/chat/completions`，识别常见 Provider 一键预设 |
| 热键剪藏产生空笔记 | 提取在 background 通过 `chrome.scripting.executeScript` 注入，多策略兜底 |
| 高亮功能在某些站点失效 | 提供站点规则覆盖 + 全页 DOM 兜底 + warnings 透传 |
| 模板切换后 `published` 变量失效 | 变量每次从 `content` 重新求值，不缓存；未识别变量警告 |
| DayJS 无法解析中文日期 | 不用 DayJS，直接 `new Date()` + ISO 输出 |
| 文件夹路径无自动补全 | 路径输入框带最近使用下拉，标签输入框带 AI 标签建议 |
| 长笔记名挤压对话框 | 全部界面用 Flex / Grid + 截断，标题超出省略号 |
| 移动端 iOS 按钮无响应 | 桌面优先 + 适配 MV3 sidePanel |
| 无 Chrome 内置 AI 支持 | 支持 `chrome-built-in`（Gemini Nano）Provider |

---

## 特性

- **多策略正文提取** — Readability 算法 + 站点规则 + 选区模式 + 整页 DOM 兜底
- **AI 智能化** — 摘要 / 标签 / 翻译 / 重命名，支持 OpenAI / DeepSeek / 通义千问 / Chrome 内置 AI
- **错误透明** — 每一次失败都给出原因、原始错误、是否可重试
- **模板系统** — 变量插值 + 实时预览 + URL 触发器 + 未知变量警告
- **多浏览器** — Chrome / Edge 共用 manifest，Firefox 独立适配（`manifest.firefox.json`）
- **现代化 UI** — React 19 + Tailwind + Framer Motion，深浅主题 + 4 种强调色
- **侧边栏** — SidePanel 模式，编辑 / 预览 / AI 操作一站式
- **历史记录** — IndexedDB 持久化，支持搜索、收藏、标签筛选
- **路径 & 标签自动补全** — 基于最近使用，标签还接受 AI 建议
- **推送青梧编辑器** — HTTP / 文件下载 / 复制 Markdown
- **快捷键** — `Alt+Shift+C` 剪藏页面，`Alt+Shift+S` 剪藏选区，`Alt+Shift+P` 打开侧边栏
- **右键菜单** — 页面 / 选区 / 链接 / 图片 各自的剪藏入口
- **浮动按钮** — 鼠标靠近右边沿时显现，不干扰浏览

---

## 快速开始

### 安装依赖

```bash
cd extension
npm install
```

### 开发构建

```bash
# 构建 Chrome 版本（默认）
npm run build:chrome

# 构建 Firefox 版本
npm run build:firefox

# 构建 Edge 版本
npm run build:edge

# 打包为 zip
npm run package
```

构建产物在 `extension/dist/<browser>/`。

### 加载到浏览器

#### Chrome / Edge

1. 打开 `chrome://extensions`（或 `edge://extensions`）
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/dist/chrome/` 目录

#### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时加载附加组件」
3. 选择 `extension/dist/firefox/manifest.json`

---

## 配置 AI

进入「设置 → AI」，选择服务商并填写：

| 服务商 | baseURL | 模型示例 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-5.6-luna` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3.7-plus` |
| Moonshot | `https://api.moonshot.ai/v1` | `kimi-k2.6` |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.2` |
| Chrome 内置 | （留空） | Gemini Nano |

插件会自动补全 `/chat/completions`，**不会出现 Obsidian Web Clipper 的 404 问题**。

点击「测试连接」会发送一条 `pong` 请求，立即看到结果或失败原因。

---

## 配置青梧编辑器推送

### 方式一：HTTP（推荐）

1. 在青梧编辑器中启动 Clipper 接收器：

```ts
import { QingWuAIEditor, startClipperReceiver } from "@apricotdream/ai-editor";

const editor = ...; // 编辑器实例

await startClipperReceiver({
  port: 7321,
  onClip: async (clip) => {
    // clip.markdown 是剪藏的 Markdown 内容
    // 把它写入编辑器
    editor.commands.setContent(clip.markdown);
  },
});
```

2. 在扩展设置中：
   - 推送方式：HTTP
   - 端点：`http://127.0.0.1:7321/clip`
   - 剪藏后自动推送：可选

3. 点击「测试连接」验证。

### 方式二：文件下载

- 推送方式：文件
- 目录：`Clippings`（相对下载目录）
- 每次剪藏会下载一个 `.md` 文件

### 方式三：复制 Markdown

- 在侧边栏点击「复制」按钮即可

---

## 模板变量

| 变量 | 说明 |
|---|---|
| `{{title}}` | 页面标题 |
| `{{url}}` | 原始 URL |
| `{{finalUrl}}` | 跳转后最终 URL |
| `{{author}}` | 作者 |
| `{{siteName}}` | 站点名 |
| `{{published}}` | 发布时间（ISO） |
| `{{captured}}` | 剪藏时间（ISO） |
| `{{description}}` | meta description |
| `{{excerpt}}` | 正文前 200 字 |
| `{{content}}` | 正文 HTML |
| `{{markdown}}` | 正文 Markdown |
| `{{tags}}` | 标签列表（逗号分隔） |
| `{{aiSummary}}` | AI 摘要 |
| `{{aiTags}}` | AI 标签 |
| `{{wordCount}}` | 字数 |
| `{{readingMinutes}}` | 阅读时长（分钟） |
| `{{YYYY}}` `{{MM}}` `{{DD}}` `{{HH}}` `{{mm}}` `{{ss}}` | 当前时间各部分 |

模板可设置 `pathPattern`（glob）实现「特定站点自动选用此模板」。

---

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Alt+Shift+C` | 剪藏当前页面 |
| `Alt+Shift+S` | 剪藏选中文本 |
| `Alt+Shift+P` | 打开侧边栏 |

可在 `chrome://extensions/shortcuts` 自定义。

---

## 项目结构

```
extension/
├── manifest.json                # Chrome / Edge MV3
├── manifest.firefox.json        # Firefox MV3
├── vite.config.ts               # 多入口构建
├── tailwind.config.js
├── scripts/
│   └── build.mjs                # 多浏览器打包
├── public/icons/
└── src/
    ├── background/
    │   └── service-worker.ts    # 消息中枢 + AI + 推送
    ├── content/
    │   ├── content-script.ts    # 浮动按钮 + 选区响应
    │   └── content.css
    ├── popup/                   # 工具栏弹窗（380x520）
    ├── sidepanel/               # 侧边栏（编辑 / 历史 / 设置）
    ├── options/                 # 完整设置页
    ├── styles/global.css
    └── shared/
        ├── ai/provider.ts       # AI Provider 统一接口
        ├── storage/db.ts        # IndexedDB
        ├── extract/readability.ts  # 多策略正文提取
        ├── templates/engine.ts  # 模板引擎
        ├── errors.ts            # 错误透明化
        ├── messages.ts          # 强类型消息协议
        ├── messaging.ts         # 消息客户端（超时 + 重试）
        ├── types.ts             # 类型定义
        ├── i18n/index.ts        # zh-CN / en-US
        └── ui/                  # React UI 组件库
            ├── Button.tsx
            ├── Modal.tsx
            ├── Toast.tsx
            ├── Input.tsx
            ├── Icon.tsx
            └── ThemeProvider.tsx
```

---

## 与 Obsidian Web Clipper 的对比

| 维度 | Obsidian Web Clipper | 青梧 Web Clipper |
|---|---|---|
| 浏览器支持 | Chrome / Firefox / Safari | Chrome / Edge / Firefox |
| AI Provider | OpenAI / DeepSeek 等 | OpenAI / DeepSeek / Qwen / Chrome 内置 |
| 错误处理 | 静默失败 | 结构化 + Toast + 重试 |
| 提取策略 | Readability + 模板 | Readability + 站点规则 + 选区 + DOM 兜底 |
| 路径补全 | 无 | 最近使用下拉 |
| 标签补全 | 无 | 输入补全 + AI 建议 |
| 模板预览 | 切换后才能看 | 实时预览 |
| 主题 | 跟随 Obsidian 主题 | 4 种强调色 + 深浅 + 自动 |
| 侧边栏 | Popup-only | SidePanel + Popup 双形态 |
| 存储目标 | Obsidian Vault | 青梧编辑器（HTTP / 文件 / 复制） |
| 历史搜索 | 无 | IndexedDB 全文搜索 |

---

## 开发

```bash
# 类型检查
npm run typecheck

# 开发模式（vite watch）
npm run dev

# 构建 + 打包
npm run build
npm run package
```

### 添加新的 AI Provider

在 `src/shared/ai/provider.ts` 中：

1. 在 `AIProviderConfig.kind` 联合类型添加新值
2. 在 `runAI` 中添加调用分支
3. 在 Options 页的下拉选项里加入

### 添加新的提取策略

在 `src/shared/extract/readability.ts` 的 `extractContent` 中：

1. 在站点规则之后、Readability 之前添加分支
2. 在 `ExtractStrategy` 类型加新值
3. 在 `warnings` 中说明降级原因

---

## License

[Apache-2.0](../LICENSE) © 2026 QingWu Contributors
