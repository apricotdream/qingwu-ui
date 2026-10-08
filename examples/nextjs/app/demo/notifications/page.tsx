"use client";

import { ICON_MOON } from "@icon/icons";
import type { NotificationItem, NotificationsOptions } from "@qingwu-ui/notifications";
import { Notifications } from "@qingwu-ui/notifications";
import "@qingwu-ui/notifications/style.css";
import { useEffect, useRef } from "react";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { BASE_ITEMS, NOTIFICATIONS_FIELDS, createNotifications, notificationsToCode } from "./playground.config";

/* ---- 静态挂载宿主：一次构造 + 卸载销毁 ---- */
function NotificationsHost({ options }: { options: NotificationsOptions }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ntf = new Notifications(root, options);
    return () => ntf.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 180 }}
    />
  );
}

/* ---- 自定义渲染：版本发布样式条目 ---- */
function renderRelease(item: NotificationItem): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;align-items:center;gap:10px;flex:1 1 auto;min-width:0;width:100%;";
  wrap.innerHTML =
    `<span style="flex:none;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;` +
    `background:color-mix(in srgb,var(--qntf-teal,#1e605a) 12%,transparent);color:var(--qntf-teal,#1e605a);">` +
    `${ICON_MOON}</span>` +
    `<span style="flex:1 1 auto;min-width:0;">` +
    `<span style="display:block;font-size:13.5px;color:var(--qntf-ink,#1d2b2c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.title}</span>` +
    `<span style="display:block;font-size:11px;color:var(--qntf-ink-3,#84928f);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.sub ?? ""}</span>` +
    `</span>` +
    `<span style="flex:none;font-size:11px;font-weight:600;color:var(--qntf-teal,#1e605a);background:color-mix(in srgb,var(--qntf-teal,#1e605a) 10%,transparent);border-radius:6px;padding:2px 7px;">${String(item.glyph)}</span>`;
  return wrap;
}

/* ---- 键盘导航说明 ---- */
const KEYS: { key: string; desc: string }[] = [
  { key: "Enter / 空格", desc: "打开 / 关闭面板" },
  { key: "↑ / ↓", desc: "在条目间移动高亮" },
  { key: "Home / End", desc: "跳到首 / 尾条目" },
  { key: "Enter", desc: "确认选中高亮条目" },
  { key: "Esc / Tab", desc: "收起面板" },
];

/* ---- 场景卡代码：手写实例化语句，框架外壳由 codegen 统一产出 ---- */
const snippet = (stmt: string) => genAll({ meta: PKG.notifications, symbol: "Notifications", stmt });

export default function NotificationsPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="Notifications 通知铃铛"
        desc="铃铛触发器 + 未读红点徽标 + 手风琴错峰下拉面板。未读时铃铛左右摆动（摇铃动画可实时关闭），受控更新：预览内按钮可动态推送消息 / 清空未读。调整属性后点「应用」。"
        fields={NOTIFICATIONS_FIELDS}
        create={createNotifications}
        toCode={notificationsToCode}
        log
        minHeight={200}
      />

      {/* 基础铃铛 */}
      <DemoCard
        title="基础：未读红点"
        desc="默认渲染 title + sub + 首字 glyph + 未读圆点；未读数 > 0 时触发器右上角弹入朱砂红点。"
        snippets={snippet(`const ntf = new Notifications(el, {
  items: [
    { id: 1, title: "青梧 UI 0.9.0 发布", sub: "12 包全量对齐", glyph: "梧", unread: true },
    { id: 2, title: "新组件 Notifications 上线", sub: "错峰下拉", glyph: "铃", unread: true }
  ],
  unreadCount: 2
});`)}
      >
        <NotificationsHost options={{ items: BASE_ITEMS, unreadCount: 2 }} />
      </DemoCard>

      {/* 空态 */}
      <DemoCard
        title="空态"
        desc="列表为空时显示 emptyText 占位，可自定义文案。"
        snippets={snippet(`const ntf = new Notifications(el, {
  items: [],
  emptyText: "暂无消息，休息一下"
});`)}
      >
        <NotificationsHost options={{ items: [], emptyText: "暂无消息，休息一下" }} />
      </DemoCard>

      {/* 自定义渲染 */}
      <DemoCard
        title="自定义渲染"
        desc="renderItem 返回任意节点：此处渲染为「版本发布」样式（品牌色图标 + 双行 + 版本徽标）。"
        snippets={snippet(`const ntf = new Notifications(el, {
  items: [
    { id: 1, title: "青梧 UI 0.9.0", sub: "12 包全量对齐", glyph: "0.9.0", unread: true },
    { id: 2, title: "AI Editor 1.4.2", sub: "孤儿资源延迟删除", glyph: "1.4.2", unread: false }
  ],
  unreadCount: 1,
  renderItem: renderRelease
});`)}
      >
        <NotificationsHost
          options={{
            items: [
              {
                id: 1,
                title: "青梧 UI 0.9.0",
                sub: "12 包全量对齐 · @qingwu-ui scope 首发",
                glyph: "0.9.0",
                unread: true,
              },
              {
                id: 2,
                title: "AI Editor 1.4.2",
                sub: "替换确认弹窗 · 孤儿资源延迟删除",
                glyph: "1.4.2",
                unread: false,
              },
            ],
            unreadCount: 1,
            renderItem: renderRelease,
          }}
        />
      </DemoCard>

      {/* 向上翻转 */}
      <DemoCard
        title="向上翻转"
        desc="触发器贴近视口底部时面板自动向上展开，错峰动画同步反向（自下而上逐条按下）。"
        snippets={snippet(`const ntf = new Notifications(el, {
  items: BASE_ITEMS,
  unreadCount: 1
});`)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            minHeight: 260,
          }}
        >
          <NotificationsHost options={{ items: BASE_ITEMS, unreadCount: 1 }} />
        </div>
      </DemoCard>

      {/* 键盘导航 */}
      <DemoCard
        title="全键盘导航"
        desc="焦点保持在触发器，aria-activedescendant 指向高亮条目；Tab 聚焦铃铛后即可用方向键操作。"
        snippets={snippet(`const ntf = new Notifications(el, {
  items: BASE_ITEMS,
  unreadCount: 2
});`)}
      >
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
          <div
            style={{
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 120,
              minHeight: 160,
            }}
          >
            <NotificationsHost options={{ items: BASE_ITEMS, unreadCount: 2 }} />
          </div>
          <ul style={{ flex: "1 1 220px", minWidth: 200, display: "grid", gap: 6 }}>
            {KEYS.map((k) => (
              <li key={k.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <kbd
                  style={{
                    flex: "none",
                    minWidth: 86,
                    textAlign: "center",
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    background: "color-mix(in srgb, var(--ink) 6%, transparent)",
                    border: "1px solid var(--line)",
                    color: "var(--ink-2)",
                  }}
                >
                  {k.key}
                </kbd>
                <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{k.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </DemoCard>
    </div>
  );
}
