// 资源路径助手：GitHub Pages 静态导出部署在 /qingwu-ui/ 子路径（next.config basePath），
// 但代码中的裸字符串路径（如 "/logo.png"）不会被自动加前缀，必须经此函数处理。
// Pages 构建时注入 NEXT_PUBLIC_BASE_PATH=/qingwu-ui；本地开发未设置时返回原始路径。
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE}${path}`;
}
