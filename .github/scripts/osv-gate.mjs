#!/usr/bin/env node
/**
 * 漏洞门禁脚本：读取 osv-scanner 的 JSON 输出，CVSS ≥ 阈值 的漏洞使 CI 失败。
 * 用法: node osv-gate.mjs <osv.json> [threshold]   (threshold 默认 7.0 = High)
 */
import fs from "node:fs";

const [, , jsonPath, thresholdArg = "7.0"] = process.argv;
const threshold = Number(thresholdArg);

if (!jsonPath || !fs.existsSync(jsonPath)) {
  console.error(`[osv-gate] 扫描结果文件不存在: ${jsonPath ?? "(未提供)"} —— 视为扫描失败`);
  process.exit(1);
}

const raw = fs.readFileSync(jsonPath, "utf8").replace(/^\uFEFF/, "");
const data = JSON.parse(raw);
const packages = (data.results ?? []).flatMap((r) => r.packages ?? []);

const blocking = packages
  .map((p) => ({
    name: p.package?.name ?? "?",
    version: p.package?.version ?? "?",
    maxCvss: Math.max(
      0,
      ...(p.groups ?? []).map((g) => Number(g.max_severity)).filter(Number.isFinite),
    ),
    ids: (p.groups ?? []).flatMap((g) => g.ids ?? []),
  }))
  .filter((p) => p.maxCvss >= threshold);

for (const p of blocking) {
  console.log(
    `[BLOCK] ${p.name}@${p.version}  CVSS ${p.maxCvss.toFixed(1)} (阈值 ${threshold})  ${p.ids.join(", ")}`,
  );
}
console.log(`漏洞包 ${packages.length} 个 | 阻断 ${blocking.length} 个 (CVSS >= ${threshold})`);
if (blocking.length > 0) process.exit(1);
