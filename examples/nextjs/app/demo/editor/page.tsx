"use client";

import dynamic from "next/dynamic";

// 编辑器为纯客户端应用（依赖 localStorage / window / fullscreen 等浏览器 API），
// 关闭 SSR 预渲染，避免服务器端执行浏览器代码。
const EditorApp = dynamic(() => import("./App"), { ssr: false });

export default function EditorPage() {
  return <EditorApp />;
}
