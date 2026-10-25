/** 数据协议独立于运行时与农历算法；calendar/core 构建时内联本文件。 */
export interface DataSource {
  title: string;
  publisher: string;
  url: string;
  accessedAt: string;
}

export interface HolidayDay {
  date: string;
  name: string;
  isOffDay: boolean;
}

export interface HolidayYear {
  schemaVersion: 1;
  year: number;
  updatedAt: string;
  sources: DataSource[];
  days: HolidayDay[];
  /** 非空时表示仅部分收录；未列出的日期不能据此认定为工作日。 */
  missingHolidays?: string[];
}

export interface SourcedText {
  text: string;
  sources: DataSource[];
}

export interface FestivalRecord {
  id: string;
  name: string;
  rule: {
    calendar: "lunar" | "solar" | "solar-term" | "lunar-eve";
    month?: number;
    day?: number;
    term?: string;
  };
  description: SourcedText;
  origin: SourcedText;
  customs: SourcedText;
}

export interface HolidayData {
  schemaVersion: 1;
  updatedAt: string;
  years: HolidayYear[];
  festivals: FestivalRecord[];
  coverage?: { startYear: number; endYear: number; missingYears: number[] };
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function source(value: unknown): boolean {
  if (
    !object(value) ||
    typeof value.title !== "string" ||
    typeof value.publisher !== "string" ||
    !isISODate(value.accessedAt) ||
    typeof value.url !== "string"
  )
    return false;
  try {
    return ["https:", "http:"].includes(new URL(value.url).protocol);
  } catch {
    return false;
  }
}

function sources(value: unknown): boolean {
  return Array.isArray(value) && value.every(source);
}

function sourcedText(value: unknown): boolean {
  return (
    object(value) &&
    typeof value.text === "string" &&
    sources(value.sources) &&
    Array.isArray(value.sources) &&
    value.sources.length > 0
  );
}

export function validateHolidayYear(value: unknown): asserts value is HolidayYear {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !Number.isInteger(value.year) ||
    Number(value.year) < 1000 ||
    Number(value.year) > 9999 ||
    !isISODate(value.updatedAt) ||
    !sources(value.sources) ||
    !Array.isArray(value.days)
  ) {
    throw new TypeError("年度节假日 JSON 格式不正确");
  }
  if (
    value.missingHolidays !== undefined &&
    (!Array.isArray(value.missingHolidays) ||
      !value.missingHolidays.every((name) => typeof name === "string" && name.length > 0))
  )
    throw new TypeError("缺失节假日说明格式不正确");
  const dates = new Set<string>();
  for (const day of value.days) {
    if (
      !object(day) ||
      !isISODate(day.date) ||
      typeof day.name !== "string" ||
      typeof day.isOffDay !== "boolean" ||
      Math.abs(Number(day.date.slice(0, 4)) - Number(value.year)) > 1 ||
      dates.has(day.date)
    ) {
      throw new TypeError("节假日日期无效、重复或放假/补班冲突");
    }
    dates.add(day.date);
  }
}

export function validateHolidayData(value: unknown): asserts value is HolidayData {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !isISODate(value.updatedAt) ||
    !Array.isArray(value.years) ||
    !Array.isArray(value.festivals)
  )
    throw new TypeError("节假日 JSON 格式不正确");
  const years = new Set<number>();
  for (const year of value.years) {
    validateHolidayYear(year);
    if (years.has(year.year)) throw new TypeError("节假日年份重复");
    years.add(year.year);
  }
  if (value.coverage !== undefined) {
    const coverage = value.coverage;
    if (
      !object(coverage) ||
      !Number.isInteger(coverage.startYear) ||
      !Number.isInteger(coverage.endYear) ||
      Number(coverage.startYear) < 1000 ||
      Number(coverage.endYear) > 9999 ||
      Number(coverage.endYear) < Number(coverage.startYear) ||
      !Array.isArray(coverage.missingYears)
    )
      throw new TypeError("年份覆盖范围格式不正确");
    const missing = [];
    for (let year = Number(coverage.startYear); year <= Number(coverage.endYear); year++)
      if (!years.has(year)) missing.push(year);
    if (JSON.stringify(missing) !== JSON.stringify(coverage.missingYears))
      throw new TypeError("缺失年份与年度数据不一致");
  }
  const ids = new Set<string>();
  for (const festival of value.festivals) {
    if (
      !object(festival) ||
      typeof festival.id !== "string" ||
      ids.has(festival.id) ||
      typeof festival.name !== "string" ||
      !object(festival.rule) ||
      !sourcedText(festival.description) ||
      !sourcedText(festival.origin) ||
      !sourcedText(festival.customs)
    ) {
      throw new TypeError("节日资料必须包含介绍、渊源、习俗及各自来源");
    }
    const rule = festival.rule;
    if (rule.calendar === "lunar" || rule.calendar === "solar") {
      const maxDay = rule.calendar === "lunar" ? 30 : 31;
      if (
        !Number.isInteger(rule.month) ||
        Number(rule.month) < 1 ||
        Number(rule.month) > 12 ||
        !Number.isInteger(rule.day) ||
        Number(rule.day) < 1 ||
        Number(rule.day) > maxDay
      )
        throw new TypeError("节日日期规则无效");
    } else if (rule.calendar === "solar-term") {
      if (typeof rule.term !== "string" || !rule.term) throw new TypeError("节气规则无效");
    } else if (rule.calendar !== "lunar-eve") throw new TypeError("未知节日日期规则");
    ids.add(festival.id);
  }
}

/** 接受 JSON.parse 后的对象，也接受年度文件；年度输入不会替换其他年份。 */
export function parseHolidayData(value: unknown): HolidayData {
  if (object(value) && "year" in value) {
    validateHolidayYear(value);
    return { schemaVersion: 1, updatedAt: value.updatedAt, years: [value], festivals: [] };
  }
  validateHolidayData(value);
  return value;
}

export function mergeHolidayData(
  base: HolidayData,
  custom: HolidayData | HolidayYear,
): HolidayData {
  const input = parseHolidayData(custom);
  const years = new Map(base.years.map((year) => [year.year, year]));
  const festivals = new Map(base.festivals.map((festival) => [festival.id, festival]));
  for (const year of input.years) years.set(year.year, year);
  for (const festival of input.festivals) festivals.set(festival.id, festival);
  const range = input.coverage ?? base.coverage;
  const coverage = range
    ? {
        ...range,
        missingYears: Array.from(
          { length: range.endYear - range.startYear + 1 },
          (_, index) => range.startYear + index,
        ).filter((year) => !years.has(year)),
      }
    : undefined;
  return {
    schemaVersion: 1,
    updatedAt: input.updatedAt,
    years: [...years.values()].sort((a, b) => a.year - b.year),
    festivals: [...festivals.values()],
    ...(coverage ? { coverage } : {}),
  };
}
