/**
 * CI 发版执行器（npm trusted publishing / OIDC）
 *
 * 逻辑：逐包比对「package.json 的版本是否已在 npmjs 发布」，未发布的才
 * `npm publish --provenance`——所以重复触发安全（已发的自动跳过），
 * 日常发版只需本地对齐版本号 + push，然后到 Actions 点一次 Run workflow。
 *
 * tag 规则：版本含 -beta → beta，否则 latest。
 * 前置：每个包在 npmjs 网页配好 Trusted Publisher（owner=apricotdream,
 * repo=qingwu-ui, workflow=publish.yml），否则 publish 会被 registry 拒绝。
 *
 * 用法：
 *   bun tooling/ci-publish/index.mjs                  # 全部包，自动 diff
 *   bun tooling/ci-publish/index.mjs skeleton select  # 指定包目录名（或全名）
 *   bun tooling/ci-publish/index.mjs --dry-run        # 只列将要发布，不真发
 */
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REGISTRY = "https://registry.npmjs.org";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const requested = args.filter((a) => !a.startsWith("--"));

/** packages/ 下发现全部真实包（兼容 calendar 这类嵌套 ui/ 的包） */
function discoverPackages() {
  const found = [];
  for (const dir of readdirSync(join(process.cwd(), "packages"), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const rel of [join(dir.name, "package.json"), join(dir.name, "ui", "package.json")]) {
      const p = join(process.cwd(), "packages", rel);
      if (!existsSync(p)) continue;
      const { name, version } = JSON.parse(readFileSync(p, "utf8"));
      if (name && version) found.push({ name, version, dir: p.slice(0, -"package.json".length) });
    }
  }
  return found;
}

const all = discoverPackages();
const targets = [];
for (const arg of requested) {
  const hit = all.find((p) => p.name === arg || p.name === `@qingwu-ui/${arg}`);
  if (!hit) {
    console.error(`未知包：${arg}（packages/ 下不存在）`);
    process.exit(1);
  }
  targets.push(hit);
}
if (!requested.length) targets.push(...all);

function publishedVersions(name) {
  const res = spawnSync(
    "npm",
    ["view", name, "versions", "--json", `--registry=${REGISTRY}`],
    { encoding: "utf8" },
  );
  if (res.status === 0) {
    let v;
    try {
      v = JSON.parse(res.stdout);
    } catch {
      return null;
    }
    return Array.isArray(v) ? v : [v];
  }
  // 新包首发：registry 404 视作"未发布过"；其他错误必须停下来
  if (/E404|not found/i.test(res.stderr || "")) return [];
  console.error(`查询 ${name} 失败：${(res.stderr || "").trim().split("\n")[0]}`);
  return null;
}

const toPublish = [];
let skipped = 0;
for (const { name, version, dir } of targets) {
  const published = publishedVersions(name);
  if (published === null) process.exit(1);
  if (published.includes(version)) {
    skipped++;
    continue;
  }
  const tag = version.includes("-beta") ? "beta" : "latest";
  toPublish.push({ name, version, dir, tag });
}

if (!toPublish.length) {
  console.log(`无版本差异，${skipped} 个包均已是最新（registry 已有当前版本）`);
}
for (const { name, version, dir, tag } of toPublish) {
  if (dryRun) {
    console.log(`DRY ${name}@${version} → npm publish --tag ${tag} --provenance`);
    continue;
  }
  console.log(`\n▶ PUBLISH ${name}@${version} (tag=${tag})`);
  const pub = spawnSync(
    "npm",
    ["publish", "--provenance", "--access", "public", `--tag=${tag}`, `--registry=${REGISTRY}`],
    { cwd: dir, stdio: "inherit" },
  );
  if (pub.status !== 0) {
    console.error(`\n✗ ${name}@${version} 发布失败，中止（已发布的包不受影响，重跑会自动跳过）`);
    process.exit(1);
  }
  console.log(`✓ ${name}@${version} 已上线（provenance 签名）`);
}

if (dryRun) console.log(`\n[dry-run] 计划发布 ${toPublish.length} 个，跳过 ${skipped} 个`);
else console.log(`\n完成：发布 ${toPublish.length} 个，跳过 ${skipped} 个`);

// 供 workflow 下一步 npmmirror-sync 使用（短名空格分隔）
if (process.env.GITHUB_OUTPUT && toPublish.length) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `published=${toPublish.map((p) => p.name.replace(/^@qingwu-ui\//, "")).join(" ")}\n`,
  );
}
process.exit(0);
