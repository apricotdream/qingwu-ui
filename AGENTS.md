# AGENTS.md — qingwu-ui 项目级 AI 协作入口

> 跨工具标准：Codex / OpenCode / Claude Code 进入项目均自动读取项目根的 `AGENTS.md`。

## 一、项目信息

- 项目名称：qingwu-ui（青梧UI）
- 项目类型：前端工具库（开源组件库）
- 技术栈：TypeScript 7 · tsdown (Rolldown) · Bun + Turborepo · 原生 DOM 渲染 · 原生 CSS + design tokens · vitest · changesets
- 仓库地址：https://github.com/apricotdream/qingwu-ui

## 二、AI 协作通则

- 所有回复、思考、任务清单使用中文。
- 遵循 KISS：非必要不过度设计，实现简单可维护，不堆砌防御性边界条件。
- 第一性原理分析问题，从最本质角度切入。
- 设计/实现前充分调研；要求不明确先确认再继续。
- 尊重事实甚于尊重作者；作者有误请直接指正。
- 先展示文字方案，获确认后再实施；简单任务可跳过。
- 按需加载相关文件保证任务完成。
- 涉及文件位置用 Markdown link：`[文件:行](绝对路径:行)`。
- 不主动创建冗余文档；能用代码+注释表达的就不写文档。
- 完成后简洁总结，不啰嗦、不复杂化。

## 三、项目记忆（自动）

会话开始时自动执行项目记忆管理：

1. 以当前工作目录为起点向上最多 3 级定位项目根（含 `package.json` / `.git` / `README.md`）。
2. 检测项目根 `.project-memory.md`：存在则绑定为专属记忆文件；不存在则按六章节结构创建并绑定。
3. 后续涉及项目决策、技术选型、踩坑、进度时，主动更新对应章节：追加到章节末尾不覆盖、同条信息去重、重要条目标注日期。
4. 读取优先返回「架构约定」「技术选型」「踩坑记录」；超 500 行默认只返前三章。
5. 禁止在记忆文件存储密钥 / 密码 / Token。

## 四、工程约定

- 代码风格：遵循 biome.json（2 空格缩进、100 字符宽、双引号、尾逗号）
- 目录结构：monorepo，`packages/` 为可发布包，`tooling/` 为内部工具，`demo/` 为开发演示
- 命名规范：包名 `@qingwu/*`，类名 PascalCase，文件名 kebab-case，CSS 类名前缀 `qs-`
- 注释规范：中文注释，关键逻辑说明意图而非复述代码
- 提交规范：使用 changesets 管理版本和 changelog

## 五、安全约束

- 不在代码 / 记忆 / 日志中存储密钥、密码、Token。
- 敏感配置走环境变量或密钥管理服务。
- 危险操作（`rm -rf` / `git reset --hard` 等）执行前向用户确认。

## 六、项目私有扩展

- 发布使用 changesets + npm provenance
- **版本策略：五包统一版本号**（对齐惯例）——每次发版所有包 bump 到同一版本，无实际变更的包也创建「版本统一对齐」changeset（参考 0.3.0）。`bun run version-packages` 后新包若未对齐需手动同步（changesets 只能升一位）。
- **发版前门禁**：`bun run publish-check`（tooling/publish-check）——校验 dist 无 `workspace:*` 依赖残留（changeset publish 不会替换，0.3.0 曾踩坑）、CHANGELOG 首条版本与 package.json 一致、exports 声明产物齐全；残留依赖用 `bun run publish-check:fix` 自动替换。私有 Nexus 发布：`npm_config_registry=http://192.168.3.8:8081/repository/npm-hosted/ bunx changeset publish --no-git-tag`。
- `@qingwu/calendar`：自渲染 DOM 组件，CSS 为副作用，`"sideEffects": ["./dist/style.css"]`
- `@qingwu/search`：纯 DOM 组件，CSS 为副作用，`"sideEffects": ["./dist/style.css"]`
- `@qingwu/upload`：`dist/style.css` 由构建脚本合并 `@qingwu/button` 样式（按钮触发形态无需单独引入按钮样式）
- 构建设计目标：calendar ≤ 30 kB gzip，search ≤ 12 kB gzip
