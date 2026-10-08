"use client";

import { useEffect, useState } from "react";
import CodeTabs from "@/components/CodeTabs";
import { PKG } from "@/lib/pkg-meta";

/* ============================================================
   AI 编辑器「用法代码」入口
   编辑器是独立全屏 App（App.tsx），这里从 page.tsx 注入一个
   不打扰的悬浮按钮 + 弹层卡片，展示 React/HTML/Vue 三端用法。
   ============================================================ */

const META = PKG.aiEditor;

const reactCode = `import { QingWuAIEditor } from "${META.pkg}";
import "${META.pkg}/styles";

// Next.js / SSR 项目：用 dynamic(() => import("./Editor"), { ssr: false })
// 包裹后再渲染本组件（编辑器依赖 localStorage / window）
export default function EditorPage() {
  return (
    <QingWuAIEditor
      initialContent="# 你好，青梧"
      mode="edit"
      showToc
      maxAttachmentSize={50 * 1024 * 1024}
      maxTotalAttachmentSize={100 * 1024 * 1024}
      onEditorReady={(editor) => {
        console.log("编辑器就绪", editor); // editor.commands.insertContent(...)
      }}
      onToast={(message, type) => {
        // 可选：转发给宿主自己的 Toast；不传时使用内置 @qingwu-ui/toast
      }}
    />
  );
}`;

const htmlCode = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <!-- 注意：${META.pkg} 仅发布 React 组件（内部基于 TipTap/React），
       没有原生 JS API。这里通过 React createRoot 挂载为「React 孤岛」，
       并用 import map 解析 react / react-dom。 -->
  <link rel="stylesheet" href="${META.cdnCssUrl}" />
</head>
<body>
  <div id="editor"></div>

  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.3.1",
      "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
      "react-dom": "https://esm.sh/react-dom@18.3.1",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client"
    }
  }
  </script>

  <script type="module">
    import { createElement } from "react";
    import { createRoot } from "react-dom/client";
    import { QingWuAIEditor } from "${META.cdnJs}";

    createRoot(document.querySelector("#editor")).render(
      createElement(QingWuAIEditor, {
        initialContent: "# Hello",
        mode: "edit",
        showToc: true,
        maxAttachmentSize: 50 * 1024 * 1024,
        maxTotalAttachmentSize: 100 * 1024 * 1024,
        onEditorReady: (editor) => console.log("ready", editor),
      }),
    );
  </script>
</body>
</html>`;

const vueCode = `<script setup>
// 注意：${META.pkg} 是 React-only 组件（内部基于 TipTap/React），
// 没有 Vue 封装。这里用 createRoot 把它挂载为一个 React 孤岛。
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { QingWuAIEditor } from "${META.pkg}";
import "${META.pkg}/styles";

const host = ref(null);
let root;

onMounted(() => {
  root = createRoot(host.value);
  root.render(
    createElement(QingWuAIEditor, {
      initialContent: "# 你好，青梧",
      mode: "edit",
      showToc: true,
      maxAttachmentSize: 50 * 1024 * 1024,
      maxTotalAttachmentSize: 100 * 1024 * 1024,
      onEditorReady: (editor) => console.log("ready", editor),
    }),
  );
});

onBeforeUnmount(() => root?.unmount());
</script>

<template>
  <div ref="host" />
</template>`;

export default function EditorUsage() {
  const [open, setOpen] = useState(false);

  // Esc 关闭；打开期间锁定背景滚动
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="fixed bottom-5 left-5 z-[9997] flex items-center gap-1.5 rounded-full bg-qingwu-600 px-4 py-2 text-xs font-medium text-white shadow-2xl transition-colors hover:bg-qingwu-700"
        onClick={() => setOpen(true)}
        title="查看 React / HTML / Vue 用法代码"
      >
        {"</>"} 用法代码
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-default-200 bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-default-100 px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">用法代码</h2>
              <button
                type="button"
                className="text-xl leading-none text-default-400 hover:text-default-600"
                onClick={() => setOpen(false)}
                title="关闭"
              >
                ×
              </button>
            </div>
            <div className="overflow-auto p-5">
              <p className="mb-3 text-xs leading-relaxed text-default-500">
                {META.pkg} 仅发布 React 组件（内部基于 TipTap/React）。React
                项目可直接使用；Vue / 原生 HTML 项目请以 React 孤岛（createRoot
                挂载）方式集成，如下所示。
              </p>
              <CodeTabs
                snippets={{ react: reactCode, html: htmlCode, vue: vueCode }}
                defaultFmt="react"
                defaultOpen
                bare
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
