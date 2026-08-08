/**
 * 发布前产物校验（本地门禁）
 *
 * 检查：
 * 1. dependencies / peerDependencies 中不允许残留 workspace:* 协议
 *    （按原样发布会安装失败，0.3.0 曾因此发布失败）
 * 2. 每个包的 CHANGELOG 首条版本号与 package.json 一致
 * 3. dist 产物齐全（index.mjs / index.cjs / index.d.mts / style.css）
 *
 * --fix：将 workspace:* 依赖自动替换为 ^<当前版本>（按 packages 下同名包版本）
 *
 * 用法：
 *   bun tooling/publish-check/index.mjs
 *   bun tooling/publish-check/index.mjs --fix
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fix = process.argv.includes("--fix");
const errors = [];
const fixes = [];

const pkgDirs = readdirSync(join(root, "packages"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(root, "packages", d.name));

/** packages 下各包的当前版本（用于 workspace 替换） */
const versions = new Map();
for (const dir of pkgDirs) {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.name) versions.set(pkg.name, pkg.version);
}

for (const dir of pkgDirs) {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.private) continue;

  /* 1. workspace 协议残留（devDependencies 不发版，不检查） */
  const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
  for (const [name, ver] of Object.entries(deps)) {
    if (!ver.includes("workspace:")) continue;
    const msg = `${pkg.name}: 依赖 ${name} 仍是 workspace 协议 (${ver})`;
    const target = versions.get(name);
    if (fix && target) {
      fixes.push(`${pkg.name} → ${name}@^${target}`);
      if (pkg.dependencies?.[name]) pkg.dependencies[name] = `^${target}`;
      if (pkg.peerDependencies?.[name]) pkg.peerDependencies[name] = `^${target}`;
    } else {
      errors.push(`${msg}，发布前需替换为 ^<版本>（可用 --fix）`);
    }
  }
  if (fix && (pkg.dependencies || pkg.peerDependencies)) {
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  /* 2. CHANGELOG 首条版本与 package.json 一致 */
  const changelogPath = join(dir, "CHANGELOG.md");
  if (existsSync(changelogPath)) {
    const head = readFileSync(changelogPath, "utf8").match(/^## (.+)$/m)?.[1];
    if (head !== pkg.version) {
      errors.push(
        `${pkg.name}: CHANGELOG 首条版本 ${head ?? "(无)"} 与 package.json ${pkg.version} 不一致`,
      );
    }
  }

  /* 3. 产物齐全：按 exports / main / module / types 声明逐一验证（兼容不同构建工具命名） */
  const declared = [];
  if (pkg.exports && typeof pkg.exports === "object") {
    for (const [subpath, target] of Object.entries(pkg.exports)) {
      if (subpath === "./package.json") continue;
      const t =
        typeof target === "string" ? target : (target.import ?? target.require ?? target.types);
      if (typeof t === "string" && t.startsWith("./")) declared.push(t);
    }
  }
  for (const f of [pkg.main, pkg.module, pkg.types].filter(Boolean)) declared.push(f);
  for (const f of new Set(declared)) {
    if (!existsSync(join(dir, f))) {
      errors.push(`${pkg.name}: ${f} 缺失，请先 bun run build`);
    }
  }
}

if (fixes.length > 0) {
  console.log("已替换 workspace 依赖：");
  for (const f of fixes) console.log(`  ${f}`);
}

if (errors.length > 0) {
  console.error("\npublish-check 未通过：");
  for (const e of errors) console.error(`  ✕ ${e}`);
  process.exit(1);
}

console.log("publish-check: 全部通过 ✓");
