import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type FestivalRecord,
  type HolidayData,
  type HolidayYear,
  isISODate,
  validateHolidayData,
  validateHolidayYear,
} from "../src/schema";

const root = fileURLToPath(new URL("../", import.meta.url));
const today = new Date().toISOString().slice(0, 10);
const rawBase = "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master";
const currentYear = new Date().getFullYear();
const checkOnly = process.argv.includes("--check");

async function getJSON(url: string, unpublished = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (response.status === 404 && unpublished) return null;
  if (!response.ok) throw new Error(`节假日源返回 HTTP ${response.status}`);
  return response.json();
}

// 先完成所有抓取、验证，再写文件；空占位不覆盖已有的有效年份。
// 2007 年以前使用人工核实的官方公报文件，自动同步不覆盖它们。
const localYears: HolidayYear[] = [];
for (const file of await readdir(join(root, "years"))) {
  if (!/^\d{4}\.json$/.test(file)) continue;
  const item = JSON.parse(await readFile(join(root, "years", file), "utf8"));
  validateHolidayYear(item);
  localYears.push(item);
}
const years: HolidayYear[] = [];
let changed = false;
for (let year = 2007; year <= currentYear + 1; year++) {
  const raw = await getJSON(`${rawBase}/${year}.json`, year > currentYear);
  if (!raw) continue;
  if (raw.year !== year || !Array.isArray(raw.papers) || !Array.isArray(raw.days))
    throw new Error(`上游 ${year} 格式不正确`);
  if (!raw.papers.length || !raw.days.length) continue;
  if (
    !raw.papers.every(
      (url: unknown) =>
        typeof url === "string" &&
        ["https:", "http:"].includes(new URL(url).protocol) &&
        new URL(url).hostname.endsWith(".gov.cn"),
    )
  )
    throw new Error("缺少有效官方公告来源");
  const path = join(root, "years", `${year}.json`);
  let previous: HolidayYear | undefined;
  try {
    previous = JSON.parse(await readFile(path, "utf8"));
  } catch {
    /* 首次同步 */
  }
  const sources = raw.papers.map((url: string) => ({
    title: `${year} 年部分节假日安排公告`,
    publisher: "国务院办公厅",
    url,
    accessedAt: today,
  }));
  const days = [...raw.days].sort((a, b) => a.date.localeCompare(b.date));
  const same =
    previous &&
    JSON.stringify(previous.days) === JSON.stringify(days) &&
    JSON.stringify(previous.sources.map((s) => s.url)) === JSON.stringify(raw.papers);
  const item: HolidayYear =
    same && previous ? previous : { schemaVersion: 1, year, updatedAt: today, sources, days };
  validateHolidayYear(item);
  years.push(item);
  if (!same) changed = true;
}
// 上游暂时删空文件时保留本地记录。
let previousData: HolidayData | undefined;
try {
  previousData = JSON.parse(await readFile(join(root, "data.json"), "utf8"));
} catch {
  /* 首次同步 */
}
for (const year of localYears) if (!years.some((item) => item.year === year.year)) years.push(year);
years.sort((a, b) => a.year - b.year);
if (!years.length) throw new Error("未获取到任何已公布年份");
const festivals: FestivalRecord[] = JSON.parse(
  await readFile(join(root, "festivals.json"), "utf8"),
);
if (JSON.stringify(previousData?.festivals) !== JSON.stringify(festivals)) changed = true;
const data = {
  schemaVersion: 1 as const,
  updatedAt: changed ? today : (previousData?.updatedAt ?? today),
  years,
  festivals,
  coverage: {
    startYear: 1998,
    endYear: Math.max(currentYear, ...years.map((year) => year.year)),
    missingYears: [] as number[],
  },
};
for (let year = data.coverage.startYear; year <= data.coverage.endYear; year++)
  if (!years.some((item) => item.year === year)) data.coverage.missingYears.push(year);
if (
  JSON.stringify(previousData?.years) !== JSON.stringify(years) ||
  JSON.stringify(previousData?.coverage) !== JSON.stringify(data.coverage)
)
  changed = true;
if (changed) data.updatedAt = today;
validateHolidayData(data);
if (!isISODate(data.updatedAt)) throw new Error("无效更新时间");
if (checkOnly) {
  if (changed) throw new Error("节假日数据有更新，请运行 sync");
} else if (changed) {
  // 保留未变化文件的字节格式，避免格式化器缩进差异触发定时任务误发版。
  await mkdir(join(root, "years"), { recursive: true });
  for (const year of years)
    await writeFile(join(root, "years", `${year.year}.json`), `${JSON.stringify(year, null, 2)}\n`);
  await writeFile(join(root, "data.json"), `${JSON.stringify(data, null, 2)}\n`);
}
console.log(changed ? `已更新 ${years.map((y) => y.year).join("、")} 年数据` : "节假日数据无变化");
