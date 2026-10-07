"use client";

import "@qingwu-ui/button/style.css";
import { type BackdropAction, type ConfirmOptions, confirm } from "@qingwu-ui/confirm";
import "@qingwu-ui/confirm/style.css";
import { useCallback, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";

/* ============================================================
   Confirm 确认框演示页面
   缩放同源转场 · 互斥单例 · 异步确认 · 三态返回值
   ============================================================ */

const RESULT_LABEL: Record<string, string> = {
  confirm: "✓ 确认",
  cancel: "— 取消",
  dismiss: "× 逃逸",
};

const KEYS: { key: string; desc: string }[] = [
  { key: "Enter", desc: "确认按钮" },
  { key: "Tab / Shift+Tab", desc: "在按钮间循环（焦点陷阱）" },
  { key: "Esc", desc: "逃逸关闭（loading 期间忽略）" },
  { key: "焦点回归", desc: "关闭后自动回到触发控件" },
];

export default function ConfirmPage() {
  const [log, setLog] = useState<string[]>([]);
  const [backdrop, setBackdrop] = useState<BackdropAction>("dismiss");

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  /* ---- 基础触发：从当前按钮中心 morph 长出（跟随遮罩行为模式） ---- */
  const fire = (e: React.MouseEvent<HTMLButtonElement>, options?: ConfirmOptions) => {
    const btn = e.currentTarget;
    confirm(btn, { title: "确认操作？", backdrop, ...options })
      .then((r) => addLog(`结果 → ${RESULT_LABEL[r]}（${r}）`))
      .catch((err) => addLog(`onConfirm 抛错 → ${String(err)}`));
  };

  /* ---- 异步确认：loading 1.5s 后缩回 ---- */
  const fireAsync = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    confirm(btn, {
      title: "删除项目？",
      message: "该操作**不可撤销**，项目文件将被永久删除。",
      danger: true,
      confirmText: "删除",
      backdrop,
      onConfirm: () => new Promise<void>((r) => setTimeout(r, 1500)),
    })
      .then((r) => addLog(`异步删除结果 → ${RESULT_LABEL[r]}（${r}）`))
      .catch((err) => addLog(`onConfirm 抛错 → ${String(err)}`));
  };

  /* ---- 互斥替换：A 打开后 1.5s 自动调用 confirm(B) 替换 A ---- */
  const mutexBRef = useRef<HTMLButtonElement>(null);
  const fireMutex = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btnA = e.currentTarget;
    confirm(btnA, { title: "操作 A", message: "1.5s 后自动打开 B 替换 A。", confirmText: "执行" })
      .then((r) => addLog(`确认框 A → ${RESULT_LABEL[r]}（${r}）`))
      .catch((err) => addLog(`onConfirm 抛错 → ${String(err)}`));
    setTimeout(() => {
      const btnB = mutexBRef.current;
      if (!btnB) return;
      confirm(btnB, {
        title: "操作 B",
        message: "已替换 A（A resolve dismiss）。",
        confirmText: "执行",
      })
        .then((r) => addLog(`确认框 B → ${RESULT_LABEL[r]}（${r}）`))
        .catch((err) => addLog(`onConfirm 抛错 → ${String(err)}`));
    }, 1500);
  };

  const snippets = {
    react: [
      'import { confirm } from "@qingwu-ui/confirm";',
      'import "@qingwu-ui/confirm/style.css";',
      "",
      "// 从触发控件中心 morph 长出，确认/取消后缩回",
      "const result = await confirm(deleteBtn, {",
      '  title: "删除文件？",',
      '  message: "该操作**不可撤销**。",',
      "  danger: true, // 确认按钮红色",
      '  confirmText: "删除",',
      "  onConfirm: async () => {",
      "    await deleteFile(); // 异步：loading 态 → 成功才缩回",
      "  },",
      "});",
      "",
      'if (result === "confirm") toast.success("已删除");',
      '// result: "confirm" | "cancel" | "dismiss"（Esc / 遮罩 / dismiss()）',
      "",
      "// 遮罩点击行为 / 互斥",
      'confirm(btn, { backdrop: "ignore" }); // 点遮罩不关闭',
      "confirm.dismiss(); // 程序化关闭",
      'confirm.configure({ confirmText: "是" }); // 全局默认',
    ].join("\n"),
    html: [
      '<link rel="stylesheet" href="https://unpkg.com/@qingwu-ui/confirm/style.css" />',
      '<script type="module">',
      '  import { confirm } from "https://unpkg.com/@qingwu-ui/confirm";',
      "",
      '  document.querySelector("#delete").addEventListener("click", (e) => {',
      "    confirm(e.currentTarget, {",
      '      title: "删除文件？",',
      "      danger: true,",
      '      onConfirm: () => fetch("/api/delete", { method: "POST" }),',
      "    }).then((r) => console.log(r));",
      "  });",
      "</script>",
    ].join("\n"),
    vue: [
      '<script setup lang="ts">',
      'import { confirm } from "@qingwu-ui/confirm";',
      'import "@qingwu-ui/confirm/style.css";',
      "",
      "const doDelete = async (e: MouseEvent) => {",
      "  const btn = e.currentTarget as HTMLElement;",
      '  const r = await confirm(btn, { title: "删除？", danger: true });',
      '  if (r === "confirm") await deleteFile();',
      "};",
      "</script>",
    ].join("\n"),
  };

  return (
    <div className="demo-grid">
      <DemoCard
        title="Confirm 确认框"
        desc="缩放同源转场：从触发控件中心弹性「长」出，确认/取消后缩回控件。互斥单例 · 异步确认 loading · 三态返回值 · 焦点陷阱 · Esc。"
        full
        snippets={snippets}
      >
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 300px", minWidth: 260, display: "grid", gap: 18 }}>
            {/* 触发控件 */}
            <section>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 8 }}>
                触发控件（从控件中心长出 / 缩回）
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="qw-btn qw-btn-primary" type="button" onClick={fire}>
                  打开确认框
                </button>
                <button
                  className="qw-btn"
                  type="button"
                  style={{ background: "#ff3b30", color: "#fff" }}
                  onClick={(e) =>
                    fire(e, { danger: true, confirmText: "删除", message: "该操作**不可撤销**。" })
                  }
                >
                  危险删除
                </button>
                <button className="qw-btn" type="button" onClick={fireAsync}>
                  异步确认 · 1.5s
                </button>
              </div>
            </section>

            {/* 遮罩行为 */}
            <section>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 8 }}>
                遮罩点击行为（backdrop）
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(
                  [
                    { v: "dismiss", label: "dismiss（默认）" },
                    { v: "cancel", label: "cancel" },
                    { v: "ignore", label: "ignore" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    className={backdrop === o.v ? "qw-btn qw-btn-primary" : "qw-btn"}
                    onClick={() => setBackdrop(o.v)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </section>

            {/* 互斥替换 */}
            <section>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 8 }}>
                互斥替换（同时仅一个确认框，新调用替换旧框）
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button className="qw-btn qw-btn-primary" type="button" onClick={fireMutex}>
                  演示互斥替换
                </button>
                <button
                  ref={mutexBRef}
                  className="qw-btn"
                  type="button"
                  style={{ opacity: 0.55, cursor: "default" }}
                  tabIndex={-1}
                >
                  替换源点 B（1.5s 后自动）
                </button>
              </div>
            </section>
          </div>

          <div className="cal-log-panel" style={{ flex: "1 1 220px", minWidth: 200 }}>
            <div className="cal-log-title">操作日志</div>
            <div className="cal-log-list">
              {log.length === 0 ? (
                <div className="cal-log-empty">点击触发控件，观察 morph 转场与返回值</div>
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

      <DemoCard
        title="缩放同源转场"
        desc="transform-origin 固定 50% 50%，以触发控件中心为起点：translate(tx,ty) scale(0.02) → none，过冲 cubic-bezier 弹性回弹；关闭时反向缩回，无过冲。测量失败或触发元素不存在时自动降级为纯居中淡入。"
      >
        <div
          style={{
            display: "grid",
            placeItems: "center",
            minHeight: 120,
            color: "var(--ink-2)",
            fontSize: 13,
          }}
        >
          点击上方任意触发按钮，观察对话框从按钮中心「长」出 / 「缩」回
        </div>
      </DemoCard>

      <DemoCard
        title="键盘与无障碍"
        desc="role=dialog + aria-modal + 焦点陷阱 + Esc + 焦点回归触发控件，reduced-motion 下退化为淡入淡出。"
      >
        <ul style={{ display: "grid", gap: 8 }}>
          {KEYS.map((k) => (
            <li key={k.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <kbd
                style={{
                  flex: "none",
                  minWidth: 120,
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
      </DemoCard>
    </div>
  );
}
