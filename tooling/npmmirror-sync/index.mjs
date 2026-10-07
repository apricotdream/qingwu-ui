/**
 * 发布后 npmmirror（阿里源）同步触发
 *
 * 背景：npmmirror 不是全量镜像，是「变更驱动 + 惰性拉取」——上游发新版会经
 * changes feed 自动同步，但从未被镜像碰过的零下载长尾包不会主动入库（404）。
 * 因此每次 npm publish 之后，应对涉及的包各打一发 sync，否则国内用户经
 * registry.npmmirror.com 安装会 404。
 *
 * 用法：
 *   bun tooling/npmmirror-sync/index.mjs                      # packages/ 下全部包
 *   bun tooling/npmmirror-sync/index.mjs ai-editor scroll-fab # 指定包（目录名或全名）
 *   bun tooling/npmmirror-sync/index.mjs --check              # 只查同步状态不触发
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIRROR = "https://registry.npmmirror.com";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;
const REQUEST_TIMEOUT_MS = 20000;

const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check");
const requested = argv.filter((a) => !a.startsWith("--"));

/** packages/ 下收集真实包名（兼容 calendar 这类嵌套在 ui/ 子目录的包） */
function discoverPackages() {
  const names = [];
  for (const dir of readdirSync(join(process.cwd(), "packages"), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const rel of [join(dir.name, "package.json"), join(dir.name, "ui", "package.json")]) {
      const p = join(process.cwd(), "packages", rel);
      if (!existsSync(p)) continue;
      const { name } = JSON.parse(readFileSync(p, "utf8"));
      if (name) names.push(name);
    }
  }
  return names;
}

const all = discoverPackages();
const targets = (requested.length ? requested : all).map((arg) =>
  arg.startsWith("@") ? arg : `@qingwu-ui/${arg}`,
);
const unknown = targets.filter((t) => !all.includes(t));
if (unknown.length) {
  console.error(`未知包名：${unknown.join(", ")}（packages/ 下不存在）`);
  process.exit(1);
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
}

/** 轮询直到包元数据在镜像可读，返回 dist-tags 摘要 */
async function pollLive(encName) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { status, body } = await fetchJson(`${MIRROR}/${encName}`);
    if (status === 200 && body?.["dist-tags"])
      return Object.entries(body["dist-tags"])
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

let failed = 0;
for (const name of targets) {
  const encName = encodeURIComponent(name);
  if (checkOnly) {
    const { status, body } = await fetchJson(`${MIRROR}/${encName}`);
    const tags =
      status === 200 && body?.["dist-tags"]
        ? Object.entries(body["dist-tags"])
            .map(([k, v]) => `${k}=${v}`)
            .join(" ")
        : "-";
    console.log(`${status === 200 ? "LIVE" : "MISS"} ${name}  ${tags}`);
    if (status !== 200) failed++;
    continue;
  }
  const put = await fetchJson(`${MIRROR}/${encName}/sync`, { method: "PUT" });
  if (![200, 201, 202, 204].includes(put.status)) {
    console.error(
      `FAIL ${name}  sync 触发失败 HTTP ${put.status} ${JSON.stringify(put.body ?? "")}`,
    );
    failed++;
    continue;
  }
  const logId = put.body?.logId ?? "-";
  console.log(`SYNC ${name}  已入队 logId=${logId}，等待镜像拉取…`);
  const tags = await pollLive(encName);
  if (tags) console.log(`OK   ${name}  ${tags}`);
  else {
    console.error(`FAIL ${name}  ${POLL_TIMEOUT_MS / 1000}s 内镜像仍不可读`);
    failed++;
  }
}

console.log(
  failed ? `\n${failed}/${targets.length} 个包未通过` : `\n全部 ${targets.length} 个包已同步`,
);
process.exit(failed ? 1 : 0);
