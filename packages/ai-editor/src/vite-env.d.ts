/// <reference types="vite/client" />

// 使本文件成为模块（ESM），让下面的 declare module 起到"模块增强"而非"模块声明"作用；
// 否则会覆盖 @tiptap/core 原有导出，导致 Editor/Node/Extension 等类型全部丢失。
export {};

// Tiptap 命令类型扩展 - 搜索高亮扩展新增的命令
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearch: (
        keyword: string,
        opts?: {
          caseSensitive?: boolean;
          wholeWord?: boolean;
        },
      ) => ReturnType;
      nextMatch: () => ReturnType;
      prevMatch: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}
