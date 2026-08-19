import { enUS } from "./en-US";
import { zhCN } from "./zh-CN";

export type Locale = "zh-CN" | "en-US";
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type I18nDict = Record<string, unknown>;

const dicts: Record<Locale, I18nDict> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

let currentLocale: Locale = "zh-CN";

export function setLocale(locale: Locale) {
  currentLocale = locale;
  // 同步 <html lang>，让屏幕阅读器按正确语言朗读
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(path: string): string {
  const dict = dicts[currentLocale];
  const keys = path.split(".");
  let result: unknown = dict;

  for (const key of keys) {
    if (result && typeof result === "object" && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }

  return typeof result === "string" ? result : path;
}

export function tf(
  path: string,
  ...args: Array<string | number | Record<string, string | number>>
): string {
  let template = t(path);
  if (args.length === 0) return template;

  // 支持命名占位符: tf("key", { count: 100 })
  if (args.length === 1 && typeof args[0] === "object") {
    const obj = args[0] as Record<string, string | number>;
    for (const [key, val] of Object.entries(obj)) {
      template = template.replaceAll(`{${key}}`, String(val));
    }
    return template;
  }

  // 支持位置占位符: tf("key", 100) → replaces {0}
  for (let i = 0; i < args.length; i++) {
    template = template.replaceAll(`{${i}}`, String(args[i]));
  }
  // 单命名占位符且单参数时直接替换
  if (args.length === 1 && /\{\w+\}/.test(template)) {
    template = template.replace(/\{\w+\}/, String(args[0]));
  }
  return template;
}
