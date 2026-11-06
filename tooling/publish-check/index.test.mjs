import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./index.mjs", import.meta.url));
let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "qingwu-publish-check-"));
  for (const name of ["holiday-data", "ai-editor"]) {
    const dir = join(root, "packages", name);
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: `@qingwu-ui/${name}`, version: "1.0.1", main: "dist/index.mjs" }),
    );
    writeFileSync(join(dir, "dist/index.mjs"), "export {};\n");
    writeFileSync(join(dir, "CHANGELOG.md"), `## ${name === "ai-editor" ? "1.0.0" : "1.0.1"}\n`);
  }
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

function check(...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
}

test("全量发布仍检查其他包的版本记录", () => {
  const result = check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /@qingwu-ui\/ai-editor: CHANGELOG/);
});

for (const name of ["holiday-data", "@qingwu-ui/holiday-data"]) {
  test(`指定 ${name} 时无关包不阻断发布`, () => {
    const result = check(name);
    assert.equal(result.status, 0, result.stderr);
  });
}

test("指定包自己的产物缺失仍阻断发布", () => {
  rmSync(join(root, "packages/holiday-data/dist/index.mjs"));
  const result = check("holiday-data");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /@qingwu-ui\/holiday-data: dist\/index.mjs 缺失/);
});

test("拒绝未知包，避免空检查被当成成功", () => {
  const result = check("unknown-package");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /未知包/);
});
