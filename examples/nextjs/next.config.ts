import { resolve } from "node:path";
import type { NextConfig } from "next";

// GitHub Pages 静态导出模式：由 pages-export.mjs 以 PAGES_EXPORT=1 触发
const isPagesExport = process.env.PAGES_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  ...(isPagesExport
    ? {
        // 静态导出：GitHub Pages 只托管静态文件；仓库页地址 https://apricotdream.github.io/qingwu-ui/
        output: "export" as const,
        basePath: "/qingwu-ui",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  webpack: (config) => {
    // 编辑器 README.md 以原始字符串导入（等价 Vite ?raw）
    config.module.rules.push({
      test: /packages[\\/]ai-editor[\\/].*\.md$/,
      type: "asset/source",
    });
    // icon/ 目录别名
    config.resolve.alias = {
      ...config.resolve.alias,
      "@icon": resolve(process.cwd(), "../../icon"),
    };
    return config;
  },
};

export default nextConfig;
