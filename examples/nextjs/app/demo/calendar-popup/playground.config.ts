import { Calendar, type CalendarUiOptions } from "@qingwu-ui/calendar";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

const DEFAULT_HOLIDAYS = {
  holidays: [
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
  ],
  workdays: ["2026-10-10", "2026-10-11"],
};

export const CALENDAR_FIELDS: FieldDef[] = [
  {
    key: "mode",
    label: "展示形态",
    type: "select",
    defaultValue: "popover",
    options: [
      { label: "popover · 锚定输入框", value: "popover" },
      { label: "modal · 居中弹窗", value: "modal" },
    ],
  },
  { key: "placeholder", label: "占位文本", type: "text", defaultValue: "点击选择日期" },
  { key: "selected", label: "默认选中日期", type: "text", defaultValue: "" },
  { key: "min", label: "最小日期", type: "text", defaultValue: "" },
  { key: "max", label: "最大日期", type: "text", defaultValue: "" },
  {
    key: "inputName",
    label: "输入框 name",
    type: "select",
    defaultValue: "",
    options: [
      { label: "（无）", value: "" },
      { label: "date", value: "date" },
      { label: "birthday", value: "birthday" },
      { label: "appointment", value: "appointment" },
    ],
  },
  {
    key: "showDetailPanel",
    label: "日历详情",
    type: "boolean",
    defaultValue: "true",
    options: [
      { label: "关闭", value: "false" },
      { label: "开启", value: "true" },
    ],
  },
  {
    key: "detailPosition",
    label: "详情悬浮方式",
    type: "select",
    defaultValue: "right",
    options: [
      { label: "right · 右侧展开（默认）", value: "right" },
      { label: "left · 左侧展开", value: "left" },
      { label: "inside · 面板内覆盖", value: "inside" },
    ],
  },
  {
    key: "holidays",
    label: "休假日历（JSON）",
    type: "text",
    defaultValue: JSON.stringify(DEFAULT_HOLIDAYS),
  },
];

export function createCalendar(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  const opts: Partial<CalendarUiOptions> = {
    mode: v.mode === "modal" ? "modal" : "popover",
    showDetailPanel: v.showDetailPanel !== false,
    detailPosition: (v.detailPosition as CalendarUiOptions["detailPosition"]) ?? "right",
    onChange: (date: string) => log(`onChange → ${date}`),
    onOpenChange: (open: boolean) => log(`面板 ${open ? "打开" : "关闭"}`),
  };

  const ph = String(v.placeholder ?? "").trim();
  if (ph) opts.placeholder = ph;

  const selected = String(v.selected ?? "").trim();
  if (selected) opts.selected = selected;
  const min = String(v.min ?? "").trim();
  if (min) opts.min = min;
  const max = String(v.max ?? "").trim();
  if (max) opts.max = max;

  const inputName = String(v.inputName ?? "").trim();
  if (inputName) opts.inputName = inputName;

  try {
    const h = JSON.parse(String(v.holidays ?? "") || "{}");
    if (h.holidays || h.workdays) opts.holidays = h;
  } catch {
    /* JSON 格式错误，忽略 */
  }

  const cal = new Calendar(host, opts);
  log("Calendar 渲染完成");

  return {
    destroy: () => cal.destroy(),
  };
}

export function calendarToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = [];

  if (v.mode === "modal") lines.push('  mode: "modal",');

  const ph = String(v.placeholder ?? "").trim();
  if (ph && ph !== "点击选择日期") lines.push(`  placeholder: "${ph}",`);

  const selected = String(v.selected ?? "").trim();
  if (selected) lines.push(`  selected: "${selected}",`);
  const min = String(v.min ?? "").trim();
  if (min) lines.push(`  min: "${min}",`);
  const max = String(v.max ?? "").trim();
  if (max) lines.push(`  max: "${max}",`);

  const inputName = String(v.inputName ?? "").trim();
  if (inputName) lines.push(`  inputName: "${inputName}",`);

  if (v.showDetailPanel === true) lines.push("  showDetailPanel: true,    // 开启右侧详情面板");

  if (v.detailPosition && v.detailPosition !== "right")
    lines.push(`  detailPosition: "${v.detailPosition}",    // 详情悬浮方式`);

  try {
    const h = JSON.parse(String(v.holidays ?? "") || "{}");
    if (h.holidays || h.workdays) {
      lines.push("  holidays: {");
      if (h.holidays?.length) lines.push(`    holidays: ${JSON.stringify(h.holidays)},`);
      if (h.workdays?.length) lines.push(`    workdays: ${JSON.stringify(h.workdays)},`);
      lines.push("  },");
    }
  } catch {
    /* ignore */
  }

  const stmt = `const cal = new Calendar(el, {
${lines.join("\n")}
});`;

  return { meta: PKG.calendar, symbol: "Calendar", stmt };
}
