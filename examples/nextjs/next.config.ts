import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    // 编辑器 README.md 以原始字符串导入（等价 Vite ?raw）
    config.module.rules.push({
      test: /packages[\\/]ai-editor[\\/].*\.md$/,
      type: "asset/source",
    });
    // icon/ 目录别名
    config.resolve.alias = {
      ...config.resolve.alias,
      "@icon": require("path").resolve(__dirname, "../../icon"),
    };
    return config;
  },
};

export default nextConfig;
