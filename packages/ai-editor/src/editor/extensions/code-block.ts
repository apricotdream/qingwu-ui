import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Fragment, type Schema } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";
// common 预设未包含 dockerfile，单独注册
import dockerfile from "highlight.js/lib/languages/dockerfile";
import { common, createLowlight } from "lowlight";
import { CodeBlockView } from "./code-block-view";

// 可选语言列表（UI 语言下拉 / 外部引用）
export const CODE_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "html", label: "HTML/XML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "yaml", label: "YAML" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "vue", label: "Vue" },
  { value: "react", label: "React" },
  { value: "markdown", label: "Markdown" },
  { value: "mermaid", label: "Mermaid" },
];

// 创建 lowlight 实例：注册常用语言（highlight.js 自带 js/ts/py/sh/yml/rb/rs/kt/cs 等别名识别）
const lowlight = createLowlight(common);
lowlight.register({ dockerfile });
// 补充 highlight.js 未内置的别名
lowlight.registerAlias("xml", ["vue", "html"]); // html 已是别名，补充 vue
lowlight.registerAlias("javascript", ["react", "jsx"]);
lowlight.registerAlias("typescript", ["tsx"]);

// 高亮由 CodeBlockLowlight 内置 lowlight 插件处理（指定语言高亮，未指定则自动检测）；
// 自定义 NodeView 仅负责工具栏（语言选择/复制/下载/mermaid）
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
  parseHTML() {
    /* 兼容 Obsidian 等来源把代码行逐行包在 <div>（.code-block-line / .cm-line）里：
       ProseMirror 对 content: text* 的 codeBlock 遇到嵌套块级 div 时只保留首行文本，
       后续行全部丢失（表现为「代码块只包住第一句」）。
       用 getContent 强制提取全部文本：若 <pre> 内有行级 div 则按行拼接 \n，否则取 textContent。 */
    return (this.parent?.() ?? []).map((rule) => ({
      ...rule,
      getContent: (node: Node, schema: Schema) => {
        const el = node as Element;
        const code = el.querySelector(':scope > code');
        const lineDivs = Array.from((code ?? el).querySelectorAll(':scope > div'));
        if (lineDivs.length > 0) {
          const text = lineDivs.map((d) => d.textContent ?? '').join('\n');
          return text ? Fragment.from(schema.text(text)) : Fragment.empty;
        }
        const text = el.textContent ?? '';
        return text ? Fragment.from(schema.text(text)) : Fragment.empty;
      },
    }));
  },
}).configure({ lowlight });
