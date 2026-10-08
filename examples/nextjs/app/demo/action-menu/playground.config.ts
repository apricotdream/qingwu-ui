import {
  ICON_CALENDAR,
  ICON_CLOCK,
  ICON_COPY,
  ICON_EDIT,
  ICON_STAR,
  ICON_TAG,
  ICON_TRASH,
  ICON_UPLOAD,
} from "@icon/icons";
import { ActionMenu, type ActionMenuItem, type ActionMenuOptions } from "@qingwu-ui/action-menu";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

/* ---- 图标池（与页面共享的同一份数据） ---- */
export const ICON_POOL: (ActionMenuItem & { disabled?: boolean })[] = [
  { id: "copy", icon: ICON_COPY, label: "复制" },
  { id: "edit", icon: ICON_EDIT, label: "编辑" },
  { id: "tag", icon: ICON_TAG, label: "加标签" },
  { id: "clock", icon: ICON_CLOCK, label: "待办" },
  { id: "upload", icon: ICON_UPLOAD, label: "上传" },
  { id: "calendar", icon: ICON_CALENDAR, label: "排期" },
  { id: "star", icon: ICON_STAR, label: "收藏" },
  { id: "trash", icon: ICON_TRASH, label: "删除", disabled: true },
];

export function buildItems(count: number): ActionMenuItem[] {
  return ICON_POOL.slice(0, count).map(({ disabled, ...it }) => ({ ...it, disabled }));
}

export const ACTION_MENU_FIELDS: FieldDef[] = [
  {
    key: "mode",
    label: "触发方式",
    type: "select",
    defaultValue: "external",
    options: [
      { label: "外部 trigger", value: "external" },
      { label: "内置 FAB 悬浮球", value: "fab" },
    ],
  },
  {
    key: "direction",
    label: "展开方向",
    type: "select",
    defaultValue: "right",
    options: [
      { label: "向右 →", value: "right" },
      { label: "向左 ←", value: "left" },
    ],
  },
  {
    key: "spread",
    label: "扇形张角",
    type: "select",
    defaultValue: "120",
    options: [
      { label: "120°", value: "120" },
      { label: "180°", value: "180" },
      { label: "240°", value: "240" },
    ],
  },
  {
    key: "radius",
    label: "弧半径",
    type: "select",
    defaultValue: "48",
    options: [
      { label: "48px（紧凑）", value: "48" },
      { label: "56px（默认）", value: "56" },
      { label: "72px（舒展）", value: "72" },
    ],
  },
  {
    key: "count",
    label: "菜单项数",
    type: "select",
    defaultValue: "3",
    options: [
      { label: "3 项", value: "3" },
      { label: "5 项", value: "5" },
      { label: "7 项", value: "7" },
    ],
  },
];

export function createActionMenu(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  const isFab = v.mode === "fab";

  const opts: ActionMenuOptions = {
    items: buildItems(Number(v.count)),
    direction: v.direction === "left" ? "left" : "right",
    spread: Number(v.spread),
    radius: Number(v.radius),
    onAction: (item) => log(`触发「${item.label}」`),
    onOpenChange: (open) => log(open ? "菜单展开" : "菜单收起"),
  };

  let trigger: HTMLButtonElement | null = null;
  if (isFab) {
    // 无 trigger 时组件内置 fixed 定位 FAB：锚定视口右下角（与原面板一致）
    opts.position = { right: 24, bottom: 24 };
  } else {
    // 外部 trigger：destroy() 只清空 host，故按钮需挂在 host 内随其一起被清空
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.setAttribute("aria-label", "打开操作菜单");
    trigger.style.cssText =
      "display:grid;place-items:center;width:52px;height:52px;border-radius:50%;" +
      "border:1px solid var(--line,#dcdfd6);background:var(--card,#fdfdfb);" +
      "color:var(--teal,#1e605a);box-shadow:0 12px 30px -14px rgba(29,43,44,.4);" +
      "cursor:pointer;font-size:20px;";
    trigger.textContent = "✦";
    host.append(trigger);
    opts.trigger = trigger;
  }

  const menu = new ActionMenu(host, opts);
  log(
    `已渲染：${isFab ? "FAB 悬浮球" : "外部 trigger"} · ${v.direction === "left" ? "向左" : "向右"} · ${v.spread}° · ${v.radius}px · ${v.count} 项`,
  );

  return { destroy: () => menu.destroy() };
}

export function actionMenuToCode(v: Record<string, unknown>): CodegenInput {
  const isFab = v.mode === "fab";

  // 自包含 items 字面量：把真实 SVG 字符串内联，禁止引用外部 ICON_* 变量
  const itemsLiteral = JSON.stringify(buildItems(Number(v.count)), null, 2)
    .split("\n")
    .map((l, i) => (i === 0 ? l : `  ${l}`))
    .join("\n");

  const lines: string[] = [
    `  items: ${itemsLiteral},`,
    `  direction: "${v.direction === "left" ? "left" : "right"}",`,
  ];
  if (Number(v.spread) !== 180) lines.push(`  spread: ${v.spread},`);
  if (Number(v.radius) !== 56) lines.push(`  radius: ${v.radius},`);
  if (isFab) {
    lines.push("  position: { right: 24, bottom: 24 },");
  } else {
    lines.push("  trigger,");
  }

  const triggerSetup = isFab
    ? ""
    : `const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = "✦";
  trigger.style.cssText = "display:grid;place-items:center;width:52px;height:52px;border-radius:50%;border:1px solid #dcdfd6;background:#fdfdfb;color:#1e605a;cursor:pointer;font-size:20px;";
  el.append(trigger);

  `;

  const stmt = `${triggerSetup}const menu = new ActionMenu(el, {
${lines.join("\n")}
});`;

  return { meta: PKG.actionMenu, symbol: "ActionMenu", stmt };
}
