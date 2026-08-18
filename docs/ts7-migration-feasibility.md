# 青梧UI「JS → TypeScript 7」可行性分析与严格化门槛落地报告

> 生成方式：`/grill-me` 四轮盘问（前提 → 动机 → 完成标准 → 落地机制）后收敛。
> 日期：本会话。范围：qingwu-ui monorepo（bun + turbo + biome + TS7）。

---

## 1. 结论（TL;DR）

1. **「从 JS 改成 TS7」在字面上已经完成**：全部包源码已是 TypeScript（260+ 文件，0 个 `.js/.jsx` 源文件），全仓库 16 个包已声明 `typescript@^7.0.2`（Go 原生编译器）并通过 typecheck。
2. **「typecheck 慢」是 TS5 时代的记忆**：TS7 原生编译器下，16 包全量 `tsc --noEmit` 实测 **4.6 秒**（最重的 ai-editor 仅 0.82s）。
3. **剩余真实工作 = 类型严格化的新代码门槛**：把 biome 的 `noExplicitAny` / `noImplicitAnyLet` / `noNonNullAssertion` 提升为 error，目录级豁免收窄为 **40 个债务文件的文件级豁免**，并落地 pre-commit 钩子只查暂存文件。
4. **存量债务（77 处 `any` + 412 处 `!`）按决策永久豁免**，不强制清理，记录在案供后续排期。

---

## 2. 现状核查（全部实测，非推测）

| 事实 | 证据 |
|---|---|
| 源码 100% TS | `git ls-files`：254 个 `.ts/.tsx`（含未跟踪的新包共 260）；`packages/*/src` 下 0 个 `.js/.jsx` |
| TS7 已装且在用 | root + 全部包 `typescript: ^7.0.2`；`tsc --version` → `Version 7.0.2`（原生版，`lib/` 仅启动器 + `getExePath`） |
| 16 包 typecheck 全绿 | 逐个 `tsc --noEmit -p <pkg>`：0 失败，总计 **4.6s** |
| 构建链已跑 TS7 | tsdown/rolldown 输出 `Emit types with typescript@7.0.2`（附一行 experimental 警告，见 §7.3） |
| 剩余 JS 仅 3 类 | ① `.mjs` 工具脚本（publish-check / restore-binaries / 扩展构建）② service worker ③ `public/file-viewer/vendor/` 预编译第三方产物（**不应迁移**） |
| 例外 | `examples/nextjs/package.json` 仍是 `typescript ^5.8.3`（示例站未切 TS7） |
| lint 基线（改造前） | `biome check .`：**1041 errors / 1608 warnings**——几乎全部来自未被 gitignore 的 `examples/nextjs/.next-session-bak/` 构建垃圾目录 |

**改造前 lint 的真实分布**（剔除垃圾目录后，`packages` 内）：
- 1 个真实 lint 错误：`lint/a11y/noAutofocus`（ai-editor.tsx:1209，已修复）
- 25 个格式错误：混合换行符（CRLF/LF）文件（存量，未动，见 §7.2）
- 74 个警告：含 2 `noExplicitAny`、27 `noNonNullAssertion` 等（非致命）

---

## 3. 目标定义（盘问结论）

| 项 | 决策 |
|---|---|
| 迁移前提 | 意识到「源码已是 TS、TS7 已生效」——目标是**严格化改造**而非迁移 |
| 动机 | 「typecheck/构建慢」已被 TS7 解决（4.6s）；严格化是顺带推进 |
| 完成标准 | 不再依赖不存在的 CI（仓库无任何 CI 配置）；**本地 `biome check` lint 错误清零 + typecheck 全绿 + 新代码被门槛拦截** |
| 存量处置 | **永久豁免**（只拦新代码） |
| 门槛机制 | `biome check --staged` 挂 pre-commit 钩子（零新依赖，biome 已开 vcs） |
| 交付物 | 本文档 + 门槛落地 |

---

## 4. 已落地内容（本次变更清单）

### 4.1 `biome.json` — 门槛核心
- 全局规则提升为 `error`（preset recommended 之上）：
  - `lint/suspicious/noExplicitAny`
  - `lint/suspicious/noImplicitAnyLet`
  - `lint/style/noNonNullAssertion`
- **目录级豁免 → 文件级豁免**：删除 `packages/ai-editor/extension/**` 与 `packages/ai-editor/src/** + tests/**` 两条 override 中的三规则豁免（其余 a11y 等豁免保留），改为新增 **40 个债务文件**的点名豁免 override（名单见 §6）。
- 测试文件豁免扩展：`**/*.test.ts` → 增加 `**/*.test.tsx`、`**/*.spec.ts`、`**/*.spec.tsx`（仅 `noNonNullAssertion` off——断言惯用法；`any` 在测试中仍被拦截）。

> 效果：新文件、新写入的 `any`/`!` 立即报错；40 个存量债务文件及其未来修改不再新增报错；测试里用 `!` 是合法习惯。

### 4.2 `.githooks/pre-commit` — 新代码门槛
- 空暂存区（如 `git commit --amend`）直接放行；
- 否则运行 `bun run lint:staged`（=`biome check --staged`），失败即中止提交并提示。

### 4.3 `package.json` — 脚本
- `"lint:staged": "biome check --staged"`
- `"hooks:install": "git config core.hooksPath .githooks"`

### 4.4 `.gitignore`
- 新增 `.next-session-bak/`：消除 1041 个垃圾 lint 错误的来源（Next.js 构建备份目录，未跟踪、未被忽略，此前被 biome 全量扫描）。

### 4.5 `packages/ai-editor/src/editor/ai-editor.tsx`
- 删除链接插入输入框的 `autoFocus`（`lint/a11y/noAutofocus` 唯一真实错误；该输入框仅在用户点击后出现，无需自动聚焦；无测试依赖此行为）。

---

## 5. 实测验证结果

| 验证项 | 结果 |
|---|---|
| 16 包 TS7 typecheck | ✅ 全绿（0/16 失败，4.6s） |
| `biome check packages` lint 错误 | ✅ 清零（剩余 25 个为格式错误，存量） |
| `biome check .`（全仓库） | ✅ 1041 → 33 错误（全部为存量格式错误，§7.2），lint 错误为 0 |
| 钩子 T1：暂存含 `any` 文件 | ✅ 被拦截（exit 1） |
| 钩子 T2：暂存格式合规干净文件 | ✅ 放行（exit 0） |
| 钩子 T3：暂存债务文件（豁免名单内） | ✅ 放行（存量豁免生效） |
| 钩子 T4：未暂存的脏文件 | ✅ 不检查（只守暂存区） |
| 钩子守卫：空暂存区 | ✅ 放行（`git diff --cached --quiet` 判定） |
| ai-editor 测试套件 | ⚠️ 沙箱内 vitest spawn 子进程被拒（EPERM），未能运行；本地 `bun run test`（packages/ai-editor）可补跑；已确认无测试断言 autoFocus |

> 注：pre-commit 钩子本机由 Git 自带的 sh 执行；沙箱内 msys bash 受限无法演示完整提交，但钩子内每一条命令均已单独实测。

---

## 6. 债务地图与豁免名单（2025 现状）

### 6.1 `any`（77 处，84% 集中在 ai-editor）
- **ai-editor src（20 文件，65 处）**：`resolve-local-media.ts`(13)、`image-upload.ts`(9)、`ai-editor.tsx`(8)、`slash-command.tsx`(6)、`image-view.tsx`(5)、`ai-selector.tsx`(4) 等——集中在 Tiptap 扩展与媒体层
- **ai-editor tests（3 文件，6 处）**：full-stack-image-swap / local-media / relative-media-extension
- **extension（2 文件，4 处）**：service-worker.ts、sidepanel/App.tsx
- **其余**：calendar/search 的 demo-entry.ts 各 1

### 6.2 非空断言 `!`（412 处）
- **~380 处（93%）在测试文件**（search.test 40、auto-skeleton.test 38、upload.test 37、action-menu.test 36、select.test 35、calendar.test 34…）——测试豁免覆盖
- **src 内 ~32 处（13 文件）**：lunar.ts(11)、upload.ts(7)、engine.ts(4)、auto-skeleton.ts(2)、demo 页 3 个、各入口 main.tsx 等

### 6.3 豁免机制
- 测试文件 → `noNonNullAssertion` 豁免（glob）
- 40 个 src/测试债务文件 → 三规则点名豁免（biome.json `overrides` 末尾清单）
- **新增文件、非豁免文件 → 三规则为 error，立即拦截**

---

## 7. 遗留债务（Phase-2 处理结果）

### ✅ 已处理：33 个混合换行符格式错误 → 2
- 已对 30 个非 WIP 文件执行 `biome check --write`（机械修复，每文件 diff 仅几行）。
- `biome check .` 错误：**1041 → 33 → 2**。
- 剩余 2 个为你的 **WIP 文件**（`examples/nextjs/app/page.tsx`、`examples/nextjs/docs.config.ts`），改完跑一次 `bun run lint:fix` 即全绿。

### ✅ 已处理：examples/nextjs 无 typecheck 脚本
- 新增 `"typecheck": "tsc --noEmit"`（TS 5.9.3 下实测通过，exit 0），`turbo typecheck` 现在真正覆盖全仓库。

### ❌ 判定为「暂不可行」：示例站切 TS7
- **Next.js 15.5.22 构建期通过 `require('typescript')` 加载 `typescript/lib/typescript.js`（完整编译器 API）做类型检查**（源码：`next/dist/lib/verify-typescript-setup.js:101`）。
- 而 `typescript@7.0.2` 原生包的 `exports["."]` 指向 `lib/version.cjs`（一个版本号字符串），**不提供编译器库 API、无 `lib/ts.js`**——`next build` 会直接崩。
- 另：TS7 原生对副作用 CSS 导入报新错误 TS2882（`noUncheckedSideEffectImports` 行为），5.9.3 无此问题。
- **结论**：等 Next.js 官方支持 TS7（或 TS7 提供稳定库 API）后再迁移；示例站维持 TS 5.9.3 是正确选择。

### 未处理（上游/环境）
1. **tsdown 的 experimental 警告**：`TypeScript 7.0 does not yet have a stable API`——TS7 类型发射 API 仍实验性，上游状态。
2. **存量 `any`/`!` 消债**：按决策豁免；若未来排期，优先级建议 ai-editor 媒体层（resolve-local-media / image-upload / image-view）→ 各包 src 的 `!` → 测试文件可保持豁免。
3. **`.next-session-bak/` 目录本体**：已 gitignore（不再污染 lint）；如确认无用可自行删除。

---

## 8. 使用说明（团队约定）

```bash
# 一次性安装钩子（每个 clone 执行一次；hooksPath 不随 git clone 传递）
bun run hooks:install

# 日常提交：钩子自动只查本次暂存文件
git add ... && git commit

# 紧急跳过（不推荐）
git commit --no-verify
```

- 新代码写 `any` / 非空断言 `!` / 不符合格式 → 提交被拦，修复后重试。
- 存量债务文件：不要为了过 lint 去改动其类型标注（豁免名单兜底）；新增债务请走正常修复。
- `biome check .` 全量 lint 与 `turbo typecheck` 是本地验收基线；仓库当前无 CI，如需 CI 可另行搭建（gitea-cicd 技能可参考）。
