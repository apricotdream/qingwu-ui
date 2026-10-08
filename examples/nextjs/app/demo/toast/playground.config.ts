import { toast, type ToastOptions, type ToastPosition, type ToastType } from "@qingwu-ui/toast";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

/* toast 是单例命令式 API，codegen 的 deriveDestroy 只识别 new X，这里显式给出卸载说明 */
export const TOAST_DESTROY = "// toast 为单例，无需 destroy";

export const TOAST_FIELDS: FieldDef[] = [
  {
    key: "type",
    label: "语义类型",
    type: "select",
    defaultValue: "info",
    options: [
      { label: "info 信息", value: "info" },
      { label: "success 成功", value: "success" },
      { label: "warning 警告", value: "warning" },
      { label: "error 错误", value: "error" },
    ],
  },
  {
    key: "position",
    label: "弹出位置",
    type: "select",
    defaultValue: "top-center",
    options: [
      { label: "↖ 左上", value: "top-left" },
      { label: "↑ 顶部居中", value: "top-center" },
      { label: "↗ 右上", value: "top-right" },
      { label: "↙ 左下", value: "bottom-left" },
      { label: "↓ 底部居中", value: "bottom-center" },
      { label: "↘ 右下", value: "bottom-right" },
    ],
  },
  {
    key: "duration",
    label: "自动消失 ms",
    type: "select",
    defaultValue: "4000",
    options: [
      { label: "0（常驻）", value: "0" },
      { label: "2000", value: "2000" },
      { label: "4000（默认）", value: "4000" },
      { label: "8000", value: "8000" },
    ],
  },
  {
    key: "dismissible",
    label: "可点击关闭",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "persist",
    label: "常驻 persist",
    type: "boolean",
    defaultValue: "false",
  },
];

const MESSAGE_LABEL: Record<ToastType, string> = {
  info: "信息提示",
  success: "操作成功",
  warning: "警告提醒",
  error: "错误反馈",
};

export function createToast(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  /* 预览内置一个真实触发按钮 */
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "qw-btn qw-btn-primary";
  btn.textContent = "显示 Toast";
  host.append(btn);

  const onClick = () => {
    const type = v.type as ToastType;
    const options: ToastOptions = {
      position: v.position as ToastPosition,
      duration: Number(v.duration),
      dismissible: v.dismissible !== false,
      persist: v.persist === true,
    };
    const id = toast[type === "warning" ? "warn" : type](
      `${MESSAGE_LABEL[type]} — 轻提示消息`,
      options,
    );
    log(`${type} | position=${options.position} | id=${id}`);
  };

  btn.addEventListener("click", onClick);
  log("已绑定触发按钮，点击按钮调用 toast[type](message, options)");

  return {
    destroy: () => btn.removeEventListener("click", onClick),
  };
}

export function toastToCode(v: Record<string, unknown>): CodegenInput {
  const type = v.type as ToastType;
  const fn = type === "warning" ? "warn" : type;
  const lines: string[] = [];
  if (v.position !== "top-center") lines.push(`  position: "${v.position as string}",`);
  if (v.duration !== "4000") lines.push(`  duration: ${Number(v.duration)},`);
  if (v.dismissible === false) lines.push("  dismissible: false,");
  if (v.persist === true) lines.push("  persist: true,");

  const stmt =
    lines.length > 0
      ? `toast.${fn}("${MESSAGE_LABEL[type]} — 轻提示消息", {
${lines.join("\n")}
});`
      : `toast.${fn}("${MESSAGE_LABEL[type]} — 轻提示消息");`;

  return {
    meta: PKG.toast,
    symbol: "toast",
    stmt,
    destroy: TOAST_DESTROY,
    importMap: { [PKG.textLayout.pkg]: PKG.textLayout.cdnJs },
  };
}
