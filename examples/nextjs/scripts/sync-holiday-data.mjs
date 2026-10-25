import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = new URL("../../../packages/holiday-data/", import.meta.url);
const output = new URL("../public/holiday-data/", import.meta.url);
await mkdir(output, { recursive: true });
for (const file of ["data.json", "festivals.json", "schema.json"]) {
  await copyFile(fileURLToPath(new URL(file, source)), fileURLToPath(new URL(file, output)));
}
