import { Notifications, type NotificationItem, type NotificationsOptions } from "@qingwu-ui/notifications";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

/* ---- 示例数据 ---- */
export const BASE_ITEMS: NotificationItem[] = [
  {
    id: 1,
    title: "青梧 UI 0.9.0 发布",
    sub: "12 包全量对齐 · 首次以 @qingwu-ui scope 发布",
    glyph: "梧",
    unread: true,
  },
  {
    id: 2,
    title: "新组件 Notifications 上线",
    sub: "通知铃铛 · 错峰下拉 · 键盘可达",
    glyph: "铃",
    unread: true,
  },
  {
    id: 3,
    title: "你的日历邀请已通过",
    sub: "李青梧 · 周三 10:00 评审会",
    glyph: "日",
    unread: false,
  },
  {
    id: 4,
    title: "存储空间提醒",
    sub: "已使用 86%，请及时清理",
    glyph: "存",
    unread: false,
  },
  {
    id: 5,
    title: "系统维护通知：本周六凌晨升级",
    sub: "长 glyph 回归用例：徽标自动取首字母 S，不溢出方块",
    glyph: "system",
    unread: false,
  },
];

export const NOTIFICATIONS_FIELDS: FieldDef[] = [
  {
    key: "width",
    label: "面板宽度",
    type: "select",
    defaultValue: "auto",
    options: [
      { label: "跟随触发器", value: "trigger" },
      { label: "内容自适应", value: "auto" },
    ],
  },
  {
    key: "ring",
    label: "摇铃动画",
    type: "boolean",
    defaultValue: "true",
    live: true,
    options: [
      { label: "开启", value: "true" },
      { label: "关闭", value: "false" },
    ],
  },
  {
    key: "unreadCount",
    label: "未读数",
    type: "select",
    defaultValue: "2",
    options: [
      { label: "0", value: "0" },
      { label: "2", value: "2" },
      { label: "5", value: "5" },
    ],
  },
  {
    key: "animate",
    label: "错峰动画",
    type: "boolean",
    defaultValue: "true",
    options: [
      { label: "开启", value: "true" },
      { label: "关闭", value: "false" },
    ],
  },
];

export function createNotifications(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  let seq = 5;

  const opts: Partial<NotificationsOptions> = {
    items: BASE_ITEMS,
    unreadCount: Number(v.unreadCount),
    width: v.width === "trigger" ? "trigger" : "auto",
    ring: v.ring !== false,
    animate: v.animate !== false,
    onItemClick: (item) => log(`点击条目「${item.title}」`),
    onOpenChange: (open) => log(open ? "面板展开" : "面板收起"),
  };

  const ntf = new Notifications(host, opts);
  log(`已挂载：${BASE_ITEMS.length} 条消息 + ${v.unreadCount} 未读红点`);

  /* ---- 预览内小按钮：推送 / 清空未读 ---- */
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;";

  const mkBtn = (text: string, primary: boolean) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = primary ? "qw-btn qw-btn-primary" : "qw-btn";
    b.textContent = text;
    return b;
  };

  const pushBtn = mkBtn("推送消息", true);
  pushBtn.addEventListener("click", () => {
    const n = seq++;
    const nextItems = [
      ...(ntf.expanded ? [] : BASE_ITEMS),
      {
        id: n,
        title: `系统消息 #${n}`,
        sub: `模拟推送，${new Date().toLocaleTimeString()}`,
        glyph: "推",
        unread: true,
      },
    ].slice(-6);
    ntf.update({ items: nextItems });
    ntf.update({ unreadCount: n });
    log(`推送消息 #${n}，未读 ${n}`);
  });

  const clearBtn = mkBtn("清空未读", false);
  clearBtn.addEventListener("click", () => {
    ntf.update({ unreadCount: 0 });
    log("清空未读红点");
  });

  bar.append(pushBtn, clearBtn);
  host.append(bar);

  return {
    destroy: () => ntf.destroy(),
    update: (values, changedKey) => {
      if (changedKey === "ring") {
        const on = values.ring === true;
        ntf.update({ ring: on });
        log(on ? "摇铃动画已开启" : "摇铃动画已关闭");
      }
    },
  };
}

export function notificationsToCode(v: Record<string, unknown>): CodegenInput {
  // 自包含 items 字面量，禁止引用外部 BASE_ITEMS
  const itemsLiteral = JSON.stringify(BASE_ITEMS, null, 2)
    .split("\n")
    .map((l, i) => (i === 0 ? l : `  ${l}`))
    .join("\n");

  const lines: string[] = [`  items: ${itemsLiteral},`];
  if (Number(v.unreadCount) !== 2) lines.push(`  unreadCount: ${v.unreadCount},`);
  if (v.width !== "auto") lines.push('  width: "trigger",');
  if (v.ring === false) lines.push("  ring: false,");
  if (v.animate === false) lines.push("  animate: false,");
  lines.push("  onItemClick: (item) => console.log(item),");
  lines.push("  onOpenChange: (open) => console.log(open),");

  const stmt = `const ntf = new Notifications(el, {
${lines.join("\n")}
});

// 受控更新示例：ntf.update({ items: newItems, unreadCount: 0 });`;

  return { meta: PKG.notifications, symbol: "Notifications", stmt };
}
