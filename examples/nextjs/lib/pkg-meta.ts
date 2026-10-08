/**
 * 组件包元数据 —— 全站 demo 的 import 路径 / CSS 路径 / CDN 版本唯一事实源。
 * 新增组件时在此登记，禁止在各 demo 页手写包名或 CDN 地址。
 *
 * 注意：unpkg 不会按 package.json exports 的 `import` 条件解析裸包 URL，
 * 裸 URL 会落到 dist/index.cjs（无 ESM 命名导出）。因此 CDN 必须显式
 * 指定 ESM 入口文件（entry，如 dist/index.mjs / dist/index.js）。
 */
export interface PkgMeta {
  /** npm 包名（打包器 import 用） */
  pkg: string;
  /** 已发布版本号（用于 unpkg CDN） */
  version: string;
  /** 样式的包内导入路径；null 表示该包不发布样式（纯逻辑/函数包） */
  css: string | null;
  /** ESM 入口文件（包内相对路径），用于 CDN 显式加载 */
  entry: string;
  /** 打包器用 CSS 导入路径 */
  get cssImport(): string | null;
  /** ESM CDN 入口 URL（显式指向 entry） */
  get cdnJs(): string;
  /** CDN 上的样式 URL；无样式包不应访问 */
  get cdnCssUrl(): string;
}

function define(
  pkg: string,
  version: string,
  opts: { css?: string | null; entry?: string } = {},
): PkgMeta {
  const { css = "./style.css", entry = "dist/index.mjs" } = opts;
  const cdnBase = `https://unpkg.com/${pkg}@${version}`;
  return {
    pkg,
    version,
    css: css === null ? null : css.replace(/^\.\//, ""),
    entry,
    get cssImport() {
      return css === null ? null : `${pkg}/${css.replace(/^\.\//, "")}`;
    },
    get cdnJs() {
      return `${cdnBase}/${entry}`;
    },
    get cdnCssUrl() {
      if (css === null) throw new Error(`${pkg} 不发布样式，无 CDN CSS URL`);
      return `${cdnBase}/${css.replace(/^\.\//, "")}`;
    },
  };
}

export const PKG = {
  select: define("@qingwu-ui/select", "0.9.0-beta.5"),
  button: define("@qingwu-ui/button", "0.9.0-beta.1"),
  upload: define("@qingwu-ui/upload", "0.9.0-beta.1"),
  calendar: define("@qingwu-ui/calendar", "0.9.1-beta.1"),
  search: define("@qingwu-ui/search", "0.9.1-beta.1"),
  actionMenu: define("@qingwu-ui/action-menu", "0.9.0-beta.1"),
  notifications: define("@qingwu-ui/notifications", "0.9.0-beta.3"),
  carousel: define("@qingwu-ui/carousel", "0.9.2-beta.1"),
  confirm: define("@qingwu-ui/confirm", "0.9.0-beta.1"),
  skeleton: define("@qingwu-ui/skeleton", "0.9.0-beta.1"),
  toast: define("@qingwu-ui/toast", "0.9.0-beta.1"),
  tagInput: define("@qingwu-ui/tag-input", "0.9.0-beta.1"),
  avatar: define("@qingwu-ui/avatar", "0.9.0-beta.3"),
  scrollFab: define("@qingwu-ui/scroll-fab", "0.9.0-beta.4"),
  aiEditor: define("@qingwu-ui/ai-editor", "0.9.0-beta.26", {
    css: "./styles",
    entry: "dist/index.js",
  }),
  textLayout: define("@qingwu-ui/text-layout", "0.9.0-beta.1", { css: null }),
} as const;

export type PkgKey = keyof typeof PKG;
