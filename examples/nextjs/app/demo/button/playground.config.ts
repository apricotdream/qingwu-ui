import { Button } from "@qingwu-ui/button";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

export const BUTTON_FIELDS: FieldDef[] = [
  { key: "text", label: "按钮文本", type: "text", defaultValue: "按钮" },
  {
    key: "variant",
    label: "风格变体",
    type: "select",
    defaultValue: "default",
    options: [
      { label: "默认", value: "default" },
      { label: "主色", value: "primary" },
      { label: "琥珀", value: "amber" },
      { label: "图标", value: "icon" },
    ],
  },
  {
    key: "type",
    label: "type 属性",
    type: "select",
    defaultValue: "button",
    options: [
      { label: "button", value: "button" },
      { label: "submit", value: "submit" },
      { label: "reset", value: "reset" },
    ],
  },
  {
    key: "disabled",
    label: "禁用状态",
    type: "boolean",
    defaultValue: "false",
    options: [
      { label: "否", value: "false" },
      { label: "是", value: "true" },
    ],
  },
];

export function createButton(
  host: HTMLElement,
  v: Record<string, unknown>,
  _log: LogFn,
): PlaygroundHandle {
  // 图标变体无文本时给一个默认符号
  const text = v.variant === "icon" && !String(v.text ?? "").trim() ? "‹" : String(v.text);
  const btn = new Button({
    text,
    variant: v.variant as "default" | "primary" | "amber" | "icon",
    type: v.type as "button" | "submit" | "reset",
    disabled: v.disabled === true,
  });
  host.append(btn.el);
  return { destroy: () => btn.destroy() };
}

export function buttonToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = [];
  const text = v.variant === "icon" && !String(v.text ?? "").trim() ? "‹" : String(v.text);
  lines.push(`  text: "${text}",`);
  if (v.variant !== "default") lines.push(`  variant: "${v.variant}",`);
  if (v.type !== "button") lines.push(`  type: "${v.type}",`);
  if (v.disabled === true) lines.push("  disabled: true,");

  const stmt = `const btn = new Button({
${lines.join("\n")}
});
el.append(btn.el);`;

  return { meta: PKG.button, symbol: "Button", stmt };
}
