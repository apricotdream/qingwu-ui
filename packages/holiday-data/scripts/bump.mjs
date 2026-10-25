import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(await readFile(path, "utf8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);
pkg.version = `${major}.${minor}.${patch + 1}`;
await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`);
