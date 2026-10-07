/**
 * 从 37b311e 恢复被 CRLF 文本转换损坏的二进制文件（0.5.0 事故修复）。
 * 遍历 37b311e..HEAD 的 diff raw 记录，对每个二进制变更（扩展名命中二进制
 * 白名单）用 37b311e 的 blob 覆盖当前工作区文件。
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const EXEC_OPTS = { maxBuffer: 512 * 1024 * 1024 };

const BINARY_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "ico",
  "bmp",
  "wasm",
  "ttf",
  "otf",
  "pfb",
  "bcmap",
  "woff",
  "woff2",
  "eot",
  "pdf",
  "zip",
  "gz",
  "tgz",
  "bin",
  "7z",
  "jar",
  "xlsx",
  "docx",
  "pptx",
]);

const raw = execSync("git diff --raw -M1% 37b311e HEAD", { encoding: "utf8" }).trim();
let restored = 0;
let skipped = 0;

for (const line of raw.split("\n")) {
  // 格式: :oldmode newmode oldsha newsha status\toldpath\tnewpath(仅 rename)
  const m = line.match(/^:\S+ \S+ (\S+) (\S+) (\S+)\t(\S+?)(?:\t(\S+))?$/);
  if (!m) continue;
  const [, , newSha, , oldPath, newPath] = m;
  if (newSha === "0".repeat(newSha.length)) continue; // 文件被删除
  const target = newPath ?? oldPath;
  const ext = target.split(".").pop()?.toLowerCase() ?? "";
  if (!BINARY_EXT.has(ext)) continue;
  // 内容一致则跳过（可能已手动修复）
  let oldBlob;
  try {
    oldBlob = execSync(`git show 37b311e:${oldPath}`, { encoding: "buffer", ...EXEC_OPTS });
  } catch {
    // 未被 rename 配对（相似度低于阈值）：回退映射 ai-editor → editor
    oldBlob = execSync(
      `git show 37b311e:${oldPath.replace(/^packages\/ai-editor\//, "packages/editor/")}`,
      { encoding: "buffer", ...EXEC_OPTS },
    );
  }
  const curBlob = execSync(`git cat-file blob ${newSha}`, { encoding: "buffer", ...EXEC_OPTS });
  if (oldBlob.equals(curBlob)) {
    skipped++;
    continue;
  }
  writeFileSync(target, oldBlob);
  console.log("restored", target, `(${curBlob.length} -> ${oldBlob.length}B)`);
  restored++;
}
console.log(`\nrestored: ${restored}, already-identical: ${skipped}`);
