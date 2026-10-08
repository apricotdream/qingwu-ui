import { AvatarEditor } from "@qingwu-ui/avatar";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { asset } from "@/lib/assets";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

export const AVATAR_FIELDS: FieldDef[] = [
  {
    key: "size",
    label: "展示尺寸",
    type: "select",
    defaultValue: "96",
    options: [
      { label: "96px", value: "96" },
      { label: "128px", value: "128" },
      { label: "160px", value: "160" },
    ],
  },
  {
    key: "outputSize",
    label: "导出尺寸",
    type: "select",
    defaultValue: "256",
    options: [
      { label: "128px", value: "128" },
      { label: "256px", value: "256" },
      { label: "512px", value: "512" },
    ],
  },
  {
    key: "radius",
    label: "圆角率",
    type: "select",
    defaultValue: "50",
    options: [
      { label: "0（直角）", value: "0" },
      { label: "16%", value: "16" },
      { label: "50%（圆形）", value: "50" },
    ],
  },
  {
    key: "outputFormat",
    label: "导出格式",
    type: "select",
    defaultValue: "png",
    options: [
      { label: "PNG", value: "png" },
      { label: "JPEG", value: "jpeg" },
    ],
  },
];

export function createAvatar(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  const editor = new AvatarEditor(host, {
    initialUrl: asset("/logo.png"),
    size: Number(v.size),
    outputSize: Number(v.outputSize),
    radius: Number(v.radius),
    outputFormat: v.outputFormat as "png" | "jpeg",
    onOpenChange: (open) => log(open ? "打开编辑器" : "关闭编辑器"),
    onConfirm: (result) =>
      log(
        `确认导出 ${result.width}×${result.height} / 圆角 ${result.radius}px / ${result.blob.size} bytes`,
      ),
  });
  log("AvatarEditor 渲染完成");

  return {
    destroy: () => editor.destroy(),
  };
}

export function avatarToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = ['  initialUrl: "/logo.png",'];
  if (v.size !== "96") lines.push(`  size: ${v.size},`);
  if (v.outputSize !== "256") lines.push(`  outputSize: ${v.outputSize},`);
  if (v.radius !== "50") lines.push(`  radius: ${v.radius},`);
  if (v.outputFormat !== "png") lines.push(`  outputFormat: "${v.outputFormat}",`);
  lines.push(`  onConfirm(result) {
    console.log(result.blob, result.dataUrl, result.width, result.height);
  },`);

  const stmt = `const editor = new AvatarEditor(el, {
${lines.join("\n")}
});`;

  return { meta: PKG.avatar, symbol: "AvatarEditor", stmt, destroy: "editor.destroy()" };
}
