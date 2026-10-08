import { confirm, type BackdropAction, type ConfirmOptions } from "@qingwu-ui/confirm";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

/* confirm 是命令式 API，codegen 的 deriveDestroy 只识别 new X，这里显式给出卸载说明 */
export const CONFIRM_DESTROY =
  "// confirm 自管理生命周期，无需 destroy；需要时 confirm.dismiss()";

export const CONFIRM_FIELDS: FieldDef[] = [
  {
    key: "backdrop",
    label: "遮罩点击行为",
    type: "select",
    defaultValue: "dismiss",
    options: [
      { label: "dismiss（逃逸，默认）", value: "dismiss" },
      { label: "cancel（视为取消）", value: "cancel" },
      { label: "ignore（不关闭）", value: "ignore" },
    ],
  },
  {
    key: "danger",
    label: "危险操作变体",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "closeOnEsc",
    label: "Esc 关闭",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "confirmText",
    label: "确认按钮文案",
    type: "text",
    defaultValue: "确认",
  },
];

export function createConfirm(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  /* 预览内置一个真实触发按钮：confirm 从它中心 morph 长出 */
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "qw-btn qw-btn-primary";
  btn.textContent = "打开确认框";
  host.append(btn);

  const onClick = () => {
    const options: ConfirmOptions = {
      title: "确认操作？",
      backdrop: v.backdrop as BackdropAction,
      closeOnEsc: v.closeOnEsc !== false,
    };
    if (v.danger === true) {
      options.danger = true;
      options.message = "该操作**不可撤销**。";
    }
    const text = String(v.confirmText ?? "").trim();
    if (text) options.confirmText = text;

    confirm(btn, options)
      .then((r) => log(`结果 → ${r}`))
      .catch((err) => log(`onConfirm 抛错 → ${String(err)}`));
  };

  btn.addEventListener("click", onClick);
  log("已绑定触发按钮，点击按钮调用 confirm(btn, options)");

  return {
    destroy: () => btn.removeEventListener("click", onClick),
  };
}

export function confirmToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = ['  title: "确认操作？",'];
  if (v.backdrop !== "dismiss") lines.push(`  backdrop: "${v.backdrop as string}",`);
  if (v.closeOnEsc === false) lines.push("  closeOnEsc: false,");
  if (v.danger === true) {
    lines.push("  danger: true,");
    lines.push('  message: "该操作**不可撤销**。",');
  }
  const text = String(v.confirmText ?? "").trim();
  if (text && text !== "确认") lines.push(`  confirmText: "${text}",`);

  const stmt = `const triggerBtn = document.createElement("button");
  triggerBtn.type = "button";
  triggerBtn.textContent = "打开确认框";
  triggerBtn.style.cssText = "height:40px;padding:0 18px;border-radius:10px;border:none;background:#1e605a;color:#fff;font-size:14px;cursor:pointer;";
  el.append(triggerBtn);

  triggerBtn.addEventListener("click", () => {
    confirm(triggerBtn, {
${lines.map((l) => `    ${l}`).join("\n")}
    }).then((result) => {
      // result: "confirm" | "cancel" | "dismiss"（Esc / 遮罩 / confirm.dismiss()）
      console.log(result);
    });
  });`;

  return { meta: PKG.confirm, symbol: "confirm", stmt, destroy: CONFIRM_DESTROY };
}
