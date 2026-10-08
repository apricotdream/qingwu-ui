import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

type Variant = "glow" | "simple";

const CLASS_OF: Record<Variant, string> = {
  glow: "qw-input",
  simple: "qw-input-simple",
};

const PLACEHOLDER_OF: Record<Variant, string> = {
  glow: "流光边框...",
  simple: "简约经典...",
};

export const INPUT_FIELDS: FieldDef[] = [
  {
    key: "type",
    label: "输入类型",
    type: "select",
    defaultValue: "text",
    live: true,
    options: [
      { label: "文本 text", value: "text" },
      { label: "密码 password", value: "password" },
      { label: "邮箱 email", value: "email" },
    ],
  },
  {
    key: "variant",
    label: "样式变体",
    type: "select",
    defaultValue: "glow",
    live: true,
    options: [
      { label: "流光边框", value: "glow" },
      { label: "简约经典", value: "simple" },
    ],
  },
  {
    key: "disabled",
    label: "禁用",
    type: "boolean",
    defaultValue: "false",
    live: true,
  },
  {
    key: "readOnly",
    label: "只读",
    type: "boolean",
    defaultValue: "false",
    live: true,
  },
  {
    key: "placeholder",
    label: "占位文本",
    type: "text",
    defaultValue: "",
    live: true,
  },
];

/** 把面板值同步到一个已存在的 input 元素上 */
function applyToInput(input: HTMLInputElement, v: Record<string, unknown>): void {
  const variant = (v.variant === "simple" ? "simple" : "glow") as Variant;
  input.className = CLASS_OF[variant];
  input.type = String(v.type ?? "text");
  const ph = String(v.placeholder ?? "").trim();
  input.placeholder = ph || PLACEHOLDER_OF[variant];
  input.disabled = v.disabled === true;
  input.readOnly = v.readOnly === true;
}

export function createInput(host: HTMLElement, v: Record<string, unknown>, log: LogFn): PlaygroundHandle {
  // 纯 CSS 组件：没有 JS 类，只需一个带对应 className 的原生 <input>
  const input = document.createElement("input");
  applyToInput(input, v);
  host.appendChild(input);
  log("纯 CSS 输入框渲染完成（样式来自 @qingwu-ui/calendar/style.css）");

  return {
    destroy: () => input.remove(),
    update: (values, changedKey) => {
      applyToInput(input, values);
      log(`实时更新字段：${changedKey}`);
    },
  };
}

export function inputToCode(v: Record<string, unknown>): CodegenInput {
  const variant = (v.variant === "simple" ? "simple" : "glow") as Variant;
  const className = CLASS_OF[variant];
  const ph = String(v.placeholder ?? "").trim() || PLACEHOLDER_OF[variant];

  const attrs: string[] = [`class: "${className}"`, `type: "${v.type ?? "text"}"`, `placeholder: "${ph}"`];
  if (v.disabled === true) attrs.push("disabled: true");
  if (v.readOnly === true) attrs.push("readOnly: true");

  // 无 JS 类可实例化：语句演示「创建原生 input → 挂上 CSS class」的真实用法，
  // 在三框架的 effect / mounted / module 作用域内均成立。
  const stmt = `// 纯 CSS 组件：创建一个原生 input，挂上 qw-input class 即可，样式全部来自 css import
const input = document.createElement("input");
input.className = "${className}";
input.type = "${v.type ?? "text"}";
input.placeholder = "${ph}";${v.disabled === true ? "\ninput.disabled = true;" : ""}${v.readOnly === true ? "\ninput.readOnly = true;" : ""}
el.appendChild(input);
// 当前属性：${attrs.join(", ")}`;

  return {
    meta: PKG.calendar,
    symbol: [],
    stmt,
    destroy: 'input.remove()  // 纯 CSS 组件，无需 JS 卸载',
  };
}
