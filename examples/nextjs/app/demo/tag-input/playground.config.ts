import { TagInput, type TagInputOptions } from "@qingwu-ui/tag-input";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

export const TAG_INPUT_FIELDS: FieldDef[] = [
  {
    key: "inline",
    label: "chip-in-input",
    type: "boolean",
    defaultValue: "false",
    options: [
      { label: "关闭（标签快捷栏）", value: "false" },
      { label: "开启（chip 内嵌）", value: "true" },
    ],
  },
  {
    key: "allowEnterCreate",
    label: "回车创建",
    type: "boolean",
    defaultValue: "false",
    options: [
      { label: "关闭", value: "false" },
      { label: "开启", value: "true" },
    ],
  },
  {
    key: "maxRows",
    label: "标签栏行数",
    type: "select",
    defaultValue: "2",
    options: [
      { label: "1 行（超出折叠）", value: "1" },
      { label: "2 行（默认）", value: "2" },
      { label: "0 = 不限制", value: "0" },
    ],
  },
  {
    key: "maxTags",
    label: "标签数量上限",
    type: "select",
    defaultValue: "0",
    options: [
      { label: "0 = 不限（默认）", value: "0" },
      { label: "3 个", value: "3" },
      { label: "5 个", value: "5" },
    ],
  },
  {
    key: "disabled",
    label: "禁用",
    type: "boolean",
    defaultValue: "false",
    options: [
      { label: "否", value: "false" },
      { label: "是", value: "true" },
    ],
  },
  {
    key: "placeholder",
    label: "占位文本",
    type: "text",
    defaultValue: "输入标签，逗号分隔…",
  },
];

export function createTagInput(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  const placeholder = String(v.placeholder ?? "").trim();

  const options: TagInputOptions = {
    inline: v.inline === true,
    allowEnterCreate: v.allowEnterCreate === true,
    maxRows: Number(v.maxRows),
    maxTags: Number(v.maxTags),
    disabled: v.disabled === true,
    defaultTags: ["前端", "React", "TypeScript", "Vue", "组件库", "零依赖"],
    onChange: (val) => log(`输入值 → ${val || "（空）"}`),
    onTagsChange: (tags) => log(`快捷标签 → ${tags.join(", ") || "（空）"}`),
  };
  if (v.inline === true) {
    options.defaultSelected = ["前端", "React"];
    options.onSelectedChange = (s) => log(`已选 chip → ${s.join(", ") || "（空）"}`);
  }
  if (placeholder) options.placeholder = placeholder;

  const ti = new TagInput(host, options);
  log(
    `TagInput 挂载：${v.inline === true ? "inline" : "bar"} · maxRows=${v.maxRows} · maxTags=${v.maxTags}`,
  );

  return {
    destroy: () => ti.destroy(),
  };
}

export function tagInputToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = [];
  if (v.inline === true) lines.push("  inline: true,");
  if (v.allowEnterCreate === true) lines.push("  allowEnterCreate: true,");
  if (Number(v.maxRows) !== 2) lines.push(`  maxRows: ${v.maxRows},`);
  if (Number(v.maxTags) !== 0) lines.push(`  maxTags: ${v.maxTags},`);
  if (v.disabled === true) lines.push("  disabled: true,");
  const placeholder = String(v.placeholder ?? "").trim();
  if (placeholder) lines.push(`  placeholder: "${placeholder}",`);

  const stmt = `const ti = new TagInput(el, {
  defaultTags: ["前端", "React", "TypeScript", "Vue", "组件库", "零依赖"],
${lines.join("\n")}
});`;

  return {
    meta: PKG.tagInput,
    symbol: "TagInput",
    stmt,
    importMap: { [PKG.textLayout.pkg]: PKG.textLayout.cdnJs },
  };
}
