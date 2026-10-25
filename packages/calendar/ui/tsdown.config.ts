import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/core.ts"],
  // 保留可选依赖为外部引用；core 入口不打入任何默认数据。
  deps: { neverBundle: ["@qingwu-ui/holiday-data"] },
  format: ["esm", "cjs"],
  dts: { generator: "oxc" },
  clean: true,
  outDir: "dist",
});
