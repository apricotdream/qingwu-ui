// README.md 以原始字符串导入（webpack asset/source），提供类型声明
declare module "@editor-root/*.md" {
  const content: string;
  export default content;
}
