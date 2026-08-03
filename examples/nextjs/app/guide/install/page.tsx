/* ============================================================
   指南 · 安装
   ============================================================ */

const PACKAGES = [
  {
    name: "@qingwu/calendar",
    desc: "日历 + 农历引擎：农历 / 节气 / 节日 / 黄历宜忌 / 休假表 / 禁用规则",
  },
  { name: "@qingwu/button", desc: "药丸风格按钮，四变体，零依赖" },
  { name: "@qingwu/search", desc: "搜索框 / 命令面板：打字机占位、类别筛选、全键盘导航" },
  { name: "@qingwu/upload", desc: "图片上传：拖拽、WebP / AVIF 客户端压缩" },
  { name: "@qingwu/toast", desc: "轻提示：ARIA live region、Promise 链、队列管理" },
  { name: "@qingwu/skeleton", desc: "骨架屏：运行时 DOM 测量、SSR 感知" },
  { name: "@qingwu/text-layout", desc: "文字排版引擎：截断 / 分栏 / 虚拟滚动" },
  { name: "@qingwu/ai-editor", desc: "AI 辅助 Markdown / WYSIWYG 编辑器" },
];

export default function InstallPage() {
  return (
    <article className="docs-article">
      <h2 id="packages">组件包</h2>
      <p>
        青梧 UI 采用<b>按包分发</b>：每个组件是独立的 npm 包，只引入你需要的代码。
        所有包均零运行时依赖、纯 TypeScript 编写、ESM / CJS 双格式输出，React / Vue / 原生 HTML
        通用。
      </p>
      <table>
        <thead>
          <tr>
            <th>包名</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {PACKAGES.map((p) => (
            <tr key={p.name}>
              <td>
                <code>{p.name}</code>
              </td>
              <td>{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="install">安装</h2>
      <p>任选包管理器，安装你需要的组件包：</p>
      <pre>
        <code>{`# npm
npm install @qingwu/calendar

# pnpm
pnpm add @qingwu/calendar

# bun
bun add @qingwu/calendar`}</code>
      </pre>

      <h2 id="usage">快速使用</h2>
      <p>
        组件是<b>框架无关</b>的：实例化时传入挂载节点与配置即可。以日历为例：
      </p>
      <pre>
        <code>{`import { Calendar } from "@qingwu/calendar";
import "@qingwu/calendar/style.css";

const el = document.querySelector("#root");
const cal = new Calendar(el, {
  placeholder: "选择日期",
  onChange: (date) => console.log(date),
});

// 卸载时释放资源
cal.destroy();`}</code>
      </pre>

      <p>
        在 React 中，通过 <code>useEffect</code> 管理生命周期：
      </p>
      <pre>
        <code>{`import { useEffect, useRef } from "react";
import { Calendar } from "@qingwu/calendar";
import "@qingwu/calendar/style.css";

function CalendarPicker() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const cal = new Calendar(el, { placeholder: "选择日期" });
    return () => cal.destroy();
  }, []);

  return <div ref={rootRef} />;
}`}</code>
      </pre>

      <h2 id="cdn">CDN 引入</h2>
      <p>
        无需构建工具，直接通过 <code>unpkg</code> 在浏览器使用：
      </p>
      <pre>
        <code>{`<script type="module">
  import { Calendar } from "https://unpkg.com/@qingwu/calendar";
</script>
<link rel="stylesheet" href="https://unpkg.com/@qingwu/calendar/style.css" />`}</code>
      </pre>

      <h2 id="support">浏览器支持</h2>
      <p>
        所有组件基于现代浏览器标准（原生 DOM、CSS 自定义属性、ES2020+）， 不兼容 IE。推荐使用最新版
        Chrome / Edge / Firefox / Safari。
      </p>
    </article>
  );
}
