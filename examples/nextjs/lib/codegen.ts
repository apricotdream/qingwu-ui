/**
 * 三框架代码生成器 —— 统一 demo 代码风味。
 *
 * - React：useEffect mount-once + cleanup destroy()
 * - Vue：<script setup> + onMounted / onBeforeUnmount
 * - HTML：unpkg ESM CDN + link CSS，存成 .html 可直接打开
 *
 * 各 demo 页只需提供：导入的符号名（ClassName）与实例化语句片段。
 */
import type { PkgMeta } from "./pkg-meta";

export interface CodegenInput {
  meta: PkgMeta;
  /** 从包中导入的符号名，如 "Select"；多个用 ["a", "b"] */
  symbol: string | string[];
  /**
   * 实例化语句（不含 import），如
   * `const sel = new Select(host, {\n  placeholder: "请选择"\n});`
   * HTML 片段中 host 变量名固定为 `el`，React/Vue 中固定为 `host`。
   */
  stmt: string;
  /** 卸载语句；默认 `instance.destroy()`，无实例组件可自定义 */
  destroy?: string;
  /** React/Vue 模板里挂载点元素的变量名与 ref 声明（默认 elRef/host） */
  hostName?: string;
  /**
   * HTML 片段中需要通过 import map 解析的裸包依赖（包 dist ESM 内部 import 了兄弟包时）。
   * 形如 { "@qingwu-ui/button": "https://unpkg.com/.../dist/index.mjs" }。
   */
  importMap?: Record<string, string>;
}

const symbols = (s: string | string[]) => (Array.isArray(s) ? s.join(", ") : s);

/** 是否需要从包中导入值（纯 CSS / 纯函数外部传参场景可能为空） */
const hasSymbols = (s: string | string[]) =>
  Array.isArray(s) ? s.length > 0 : s.trim().length > 0;

/** 缩进每一行（用于把 stmt 嵌入 effect/mounted 回调） */
function indent(block: string, pad: string): string {
  return block
    .split("\n")
    .map((l) => (l.length ? pad + l : l))
    .join("\n");
}

export function genReact({ meta, symbol, stmt, destroy, hostName = "el" }: CodegenInput): string {
  const cleanup = destroy ?? deriveDestroy(stmt);
  const cssImport = meta.css ? `\nimport "${meta.cssImport}";` : "";
  const valueImport = hasSymbols(symbol) ? `\nimport { ${symbols(symbol)} } from "${meta.pkg}";` : "";
  return `import { useEffect, useRef } from "react";${valueImport}${cssImport}

export default function Demo() {
  const ${hostName}Ref = useRef(null);

  useEffect(() => {
    const ${hostName} = ${hostName}Ref.current;
${indent(stmt, "    ")}
    return () => {
      ${cleanup};
    };
  }, []);

  return <div ref={${hostName}Ref} />;
}`;
}

export function genVue({ meta, symbol, stmt, destroy }: CodegenInput): string {
  const cleanup = destroy ?? deriveDestroy(stmt);
  const cssImport = meta.css ? `\nimport "${meta.cssImport}";` : "";
  const valueImport = hasSymbols(symbol) ? `\nimport { ${symbols(symbol)} } from "${meta.pkg}";` : "";
  return `<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";${valueImport}${cssImport}

const host = ref(null);
let instance;

onMounted(() => {
  const el = host.value;
${indent(stmt, "  ")}
});

onBeforeUnmount(() => {
  ${cleanup};
});
</script>

<template>
  <div ref="host"></div>
</template>`;
}

export function genHtml({ meta, symbol, stmt, destroy, importMap }: CodegenInput): string {
  const cleanup = destroy ?? deriveDestroy(stmt);
  const cssLink = meta.css ? `\n  <link rel="stylesheet" href="${meta.cdnCssUrl}" />` : "";
  const importMapTag =
    importMap && Object.keys(importMap).length
      ? `\n  <script type="importmap">\n${JSON.stringify({ imports: importMap }, null, 2).split("\n").map((l) => `  ${l}`).join("\n")}\n  </script>`
      : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />${cssLink}${importMapTag}
</head>
<body>
  <div id="host"></div>

  <script type="module">${hasSymbols(symbol) ? `\n    import { ${symbols(symbol)} } from "${meta.cdnJs}";` : ""}

    const el = document.querySelector("#host");
${indent(stmt, "    ")}
  </script>
</body>
</html>`;
}

/** 默认从 `const xxx = new X(...)` 中取实例名拼 destroy() */
function deriveDestroy(stmt: string): string {
  const m = stmt.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s/);
  return m ? `${m[1]}.destroy()` : "// 组件无需手动卸载";
}

export function genAll(input: CodegenInput): Record<string, string> {
  return {
    react: genReact(input),
    html: genHtml(input),
    vue: genVue(input),
  };
}
