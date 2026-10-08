import { Select, type SelectOption, type SelectOptions } from "@qingwu-ui/select";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";
import { FRAMEWORKS } from "./data";

export const SELECT_FIELDS: FieldDef[] = [
  { key: "placeholder", label: "占位文本", type: "text", defaultValue: "选择框架" },
  {
    key: "width",
    label: "面板宽度",
    type: "select",
    defaultValue: "trigger",
    options: [
      { label: "跟随触发器", value: "trigger" },
      { label: "内容自适应", value: "auto" },
    ],
  },
  {
    key: "animate",
    label: "手风琴动画",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "frosted",
    label: "面板磨砂",
    type: "boolean",
    defaultValue: "true",
    options: [
      { label: "半透明磨砂", value: "true" },
      { label: "不透明", value: "false" },
    ],
  },
  {
    key: "stagger",
    label: "错峰间隔 ms",
    type: "select",
    defaultValue: "28",
    options: [
      { label: "28ms（密）", value: "28" },
      { label: "48ms（缓）", value: "48" },
      { label: "72ms（疏）", value: "72" },
    ],
  },
  {
    key: "disabled",
    label: "整体禁用",
    type: "boolean",
    defaultValue: "false",
    options: [
      { label: "否", value: "false" },
      { label: "是", value: "true" },
    ],
  },
  {
    key: "controlledValue",
    label: "受控 value",
    type: "select",
    defaultValue: "none",
    live: true,
    options: [
      { label: "（非受控）", value: "none" },
      ...FRAMEWORKS.filter((f) => !f.disabled).map((f) => ({ label: f.label, value: f.value })),
    ],
  },
];

export function createSelect(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  const opts: Partial<SelectOptions> = {
    options: FRAMEWORKS,
    width: v.width === "auto" ? "auto" : "trigger",
    animate: v.animate !== false,
    frosted: v.frosted !== false,
    stagger: Number(v.stagger) || 28,
    disabled: v.disabled === true,
    onOpenChange: (open) => log(`展开状态：${open ? "开" : "关"}`),
    onChange: (value: string | null, option: SelectOption | null) =>
      log(`选中「${option?.label ?? "（取消）"}」= ${value}`),
  };
  const ph = String(v.placeholder ?? "").trim();
  if (ph) opts.placeholder = ph;
  if (v.controlledValue !== "none") opts.value = v.controlledValue as string;

  const sel = new Select(host, opts);
  log("Select 渲染完成");

  return {
    destroy: () => sel.destroy(),
    update: (values) => {
      const val = values.controlledValue;
      sel.update({ value: val === "none" ? null : (val as string) });
      log(val === "none" ? "切换到非受控模式" : `外部 update({ value: "${val}" })`);
    },
  };
}

/** 内联演示数据：生成代码必须自包含，禁止引用未定义变量 */
const FRAMEWORKS_LITERAL = JSON.stringify(FRAMEWORKS, null, 2)
  .split("\n")
  .map((l, i) => (i === 0 ? l : `  ${l}`))
  .join("\n");

export function selectToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = [`  options: ${FRAMEWORKS_LITERAL},`];
  const ph = String(v.placeholder ?? "").trim();
  if (ph) lines.push(`  placeholder: "${ph}",`);
  if (v.width === "auto") lines.push('  width: "auto",');
  if (v.animate === false) lines.push("  animate: false,");
  if (v.frosted === false) lines.push("  frosted: false,");
  // stagger 字段是 select 控件，值为字符串，需转 number 再与默认值比较
  const stagger = Number(v.stagger);
  if (stagger !== 28) lines.push(`  stagger: ${stagger},`);
  if (v.disabled === true) lines.push("  disabled: true,");
  if (v.controlledValue !== "none") lines.push(`  value: "${v.controlledValue}",`);

  const stmt = `const sel = new Select(el, {
${lines.join("\n")}
});`;

  return { meta: PKG.select, symbol: "Select", stmt };
}
