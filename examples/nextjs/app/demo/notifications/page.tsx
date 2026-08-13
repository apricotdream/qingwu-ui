"use client";

import { ICON_MOON } from "@icon/icons";
import type { NotificationItem, NotificationsOptions } from "@qingwu-ui/notifications";
import { Notifications } from "@qingwu-ui/notifications";
import "@qingwu-ui/notifications/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";

/* ============================================================
   Notifications 通知铃铛演示页面
   ============================================================ */

/* ---- 示例数据 ---- */
const BASE_ITEMS: NotificationItem[] = [
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
];

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

export default function NotificationsPage() {
  /* ---- 受控更新卡 ---- */
  const ctrlRef = useRef<HTMLDivElement>(null);
  const ntfRef = useRef<Notifications | null>(null);
  const seqRef = useRef(5);
  const [log, setLog] = useState<string[]>([]);
  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);
  /* ---- 摇铃动画开关（实时热更 ring） ---- */
  const [ringOn, setRingOn] = useState(true);
  const ringOnRef = useRef(true);
  const toggleRing = useCallback(() => {
    const next = !ringOnRef.current;
    ringOnRef.current = next;
    setRingOn(next);
    ntfRef.current?.update({ ring: next });
    addLog(next ? "摇铃动画已开启" : "摇铃动画已关闭");
  }, [addLog]);

  useEffect(() => {
    const root = ctrlRef.current;
    if (!root) return;
    const ntf = new Notifications(root, {
      items: BASE_ITEMS,
      unreadCount: 2,
      width: "auto",
      onItemClick: (item) => addLog(`点击条目「${item.title}」`),
      onOpenChange: (open) => addLog(open ? "面板展开" : "面板收起"),
    });
    ntfRef.current = ntf;
    addLog("已挂载：3 条消息 + 2 未读红点");
    return () => ntf.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushMessage = () => {
    const n = seqRef.current++;
    ntfRef.current?.update({
      items: [
        ...(ntfRef.current?.expanded ? [] : BASE_ITEMS),
        {
          id: n,
          title: `系统消息 #${n}`,
          sub: `模拟推送，${new Date().toLocaleTimeString()}`,
          glyph: "推",
          unread: true,
        },
      ].slice(-6),
    });
    ntfRef.current?.update({ unreadCount: n });
    addLog(`推送消息 #${n}，未读 ${n}`);
  };

  const clearUnread = () => {
    ntfRef.current?.update({ unreadCount: 0 });
    addLog("清空未读红点");
  };

  const snippets = {
    react: [
      'import { Notifications } from "@qingwu-ui/notifications";',
      'import "@qingwu-ui/notifications/style.css";',
      "",
      "const ntf = new Notifications(container, {",
      "  items: [",
      '    { id: 1, title: "青梧 UI 0.9.0 发布", sub: "12 包全量对齐", glyph: "梧", unread: true },',
      '    { id: 2, title: "日历邀请已通过", sub: "周三 10:00 评审会", unread: false },',
      "  ],",
      "  unreadCount: 1,",
      "  ring: true, // 未读响铃摆动开关",
      '  // ringMode: "intermittent", ringInterval: 4000, // 按频率间歇重响',
      "  onItemClick: (item) => handle(item),",
      "  onOpenChange: (open) => console.log(open),",
      "});",
      "",
      "// 受控更新：推送 / 清未读",
      "ntf.update({ items, unreadCount: 0 });",
      "ntf.destroy(); // 卸载时销毁",
    ].join("\n"),
    html: [
      "<!DOCTYPE html>",
      '<html lang="zh-CN">',
      "<head>",
      '  <link rel="stylesheet" href="https://unpkg.com/@qingwu-ui/notifications/style.css" />',
      "</head>",
      "<body>",
      '  <div id="root"></div>',
      '  <script type="module">',
      '    import { Notifications } from "https://unpkg.com/@qingwu-ui/notifications";',
      "    const ntf = new Notifications(document.querySelector(\"#root\"), {",
      "      items: [{ id: 1, title: \"青梧 UI 0.9.0 发布\", unread: true }],",
      "      unreadCount: 1,",
      "      ring: true,",
      "    });",
      "  </script>",
      "</body>",
      "</html>",
    ].join("\n"),
  };

  return (
    <div className="demo-grid">
      {/* 受控更新（full） */}
      <DemoCard
        title="Notifications 通知铃铛"
        desc="铃铛触发器 + 未读红点徽标 + 手风琴错峰下拉面板。未读时铃铛左右摆动（可一键关闭摇铃动画），受控更新：动态推送消息 / 清空未读 / 切换摇铃。"
        full
        snippets={snippets}
      >
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div
            style={{
              width: 300,
              maxWidth: "100%",
              minHeight: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div ref={ctrlRef} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="qw-btn qw-btn-primary" type="button" onClick={pushMessage}>
                推送消息
              </button>
              <button className="qw-btn" type="button" onClick={clearUnread}>
                清空未读
              </button>
              <button
                className={ringOn ? "qw-btn qw-btn-primary" : "qw-btn"}
                type="button"
                onClick={toggleRing}
              >
                摇铃动画：{ringOn ? "开" : "关"}
              </button>
            </div>
          </div>
          <div className="cal-log-panel" style={{ flex: "1 1 220px", minWidth: 200 }}>
            <div className="cal-log-title">操作日志</div>
            <div className="cal-log-list">
              {log.length === 0 ? (
                <div className="cal-log-empty">点击铃铛展开，点击条目查看回调</div>
              ) : (
                log.map((msg, i) => (
                  <div key={i} className="cal-log-item">
                    {msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DemoCard>

      {/* 基础铃铛 */}
      <DemoCard
        title="基础：未读红点"
        desc="默认渲染 title + sub + 首字 glyph + 未读圆点；未读数 > 0 时触发器右上角弹入朱砂红点。"
      >
        <NotificationsHost options={{ items: BASE_ITEMS, unreadCount: 2 }} />
      </DemoCard>

      {/* 空态 */}
      <DemoCard title="空态" desc="列表为空时显示 emptyText 占位，可自定义文案。">
        <NotificationsHost options={{ items: [], emptyText: "暂无消息，休息一下" }} />
      </DemoCard>

      {/* 自定义渲染 */}
      <DemoCard
        title="自定义渲染"
        desc="renderItem 返回任意节点：此处渲染为「版本发布」样式（品牌色图标 + 双行 + 版本徽标）。"
      >
        <NotificationsHost
          options={{
            items: [
              { id: 1, title: "青梧 UI 0.9.0", sub: "12 包全量对齐 · @qingwu-ui scope 首发", glyph: "0.9.0", unread: true },
              { id: 2, title: "AI Editor 1.4.2", sub: "替换确认弹窗 · 孤儿资源延迟删除", glyph: "1.4.2", unread: false },
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
