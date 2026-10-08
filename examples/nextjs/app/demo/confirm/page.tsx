"use client";

import "@qingwu-ui/button/style.css";
import { type ConfirmResult, confirm } from "@qingwu-ui/confirm";
import "@qingwu-ui/confirm/style.css";
import { useRef } from "react";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { CONFIRM_DESTROY, CONFIRM_FIELDS, confirmToCode, createConfirm } from "./playground.config";

/* ============================================================
   Confirm 确认框演示页面
   缩放同源转场 · 互斥单例 · 异步确认 · 三态返回值
   ============================================================ */

const RESULT_LABEL: Record<ConfirmResult, string> = {
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

/* ---- 场景卡代码：手写 confirm 调用语句，框架外壳由 codegen 统一产出 ---- */
const snippet = (stmt: string) =>
  genAll({ meta: PKG.confirm, symbol: "confirm", stmt, destroy: CONFIRM_DESTROY });

export default function ConfirmPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="Confirm 确认框"
        desc="缩放同源转场：从触发控件中心弹性「长」出，确认/取消后缩回控件。调整属性后点「应用」，再点击预览中的按钮。"
        fields={CONFIRM_FIELDS}
        create={createConfirm}
        toCode={confirmToCode}
        log
        hostStyle={{ width: "auto" }}
      />

      <DemoCard
        title="危险操作 · 异步确认"
        desc="danger 确认按钮变红；onConfirm 返回 Promise 时进入 loading，成功后才缩回，reject 保持打开。"
        snippets={snippet(`confirm(btn, {
  title: "删除项目？",
  message: "该操作**不可撤销**，项目文件将被永久删除。",
  danger: true,
  confirmText: "删除",
  onConfirm: () => new Promise((done) => setTimeout(done, 1500)),
}).then((r) => console.log(r));`)}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <DangerButton />
          <AsyncButton />
        </div>
      </DemoCard>

      <DemoCard
        title="互斥替换"
        desc="同时仅一个确认框：A 打开 1.5s 后自动 confirm(B)，A 以 dismiss 结束并从 B 重新 morph。"
        snippets={snippet(`confirm(btnA, { title: "操作 A" });

// 1.5s 后再次调用即替换当前确认框（A resolve "dismiss"）
setTimeout(() => {
  confirm(btnB, { title: "操作 B", message: "已替换 A。" });
}, 1500);`)}
      >
        <MutexDemo />
      </DemoCard>

      <DemoCard
        title="缩放同源转场"
        desc="transform-origin 固定 50% 50%，以触发控件中心为起点：translate(tx,ty) scale(0.02) → none，过冲 cubic-bezier 弹性回弹；关闭时反向缩回，无过冲。测量失败或触发元素不存在时自动降级为纯居中淡入。"
        snippets={snippet(`// 第一个参数即转场源点元素：对话框从它中心长出、关闭后缩回
confirm(triggerEl, { title: "确认操作？" });

// 只传选择器时无法测量源点，自动降级为居中淡入
confirm("#open-btn", { title: "降级模式" });

// 程序化关闭（当前确认框同样以 dismiss 结束）
confirm.dismiss();`)}
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
        snippets={snippet(`// closeOnEsc: false 可禁用 Esc；loading 期间 Esc 始终被忽略
confirm(btn, { title: "按 Esc 无效", closeOnEsc: false });

// 快捷键（组件内建，无需手写）：
// Enter         → 确认
// Tab / Shift+Tab → 焦点在按钮间循环
// Esc           → 逃逸关闭
// 关闭后焦点自动回归触发控件`)}
      >
        <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
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

/* ---- 危险删除按钮 ---- */
function DangerButton() {
  const fire = (e: React.MouseEvent<HTMLButtonElement>) => {
    confirm(e.currentTarget, {
      title: "删除项目？",
      message: "该操作**不可撤销**。",
      danger: true,
      confirmText: "删除",
    }).then((r) => console.log(RESULT_LABEL[r], r));
  };
  return (
    <button
      className="qw-btn"
      type="button"
      style={{ background: "#ff3b30", color: "#fff" }}
      onClick={fire}
    >
      危险删除
    </button>
  );
}

/* ---- 异步确认按钮 ---- */
function AsyncButton() {
  const fire = (e: React.MouseEvent<HTMLButtonElement>) => {
    confirm(e.currentTarget, {
      title: "删除项目？",
      message: "该操作**不可撤销**，项目文件将被永久删除。",
      danger: true,
      confirmText: "删除",
      onConfirm: () => new Promise<void>((r) => setTimeout(r, 1500)),
    }).then((r) => console.log(RESULT_LABEL[r], r));
  };
  return (
    <button className="qw-btn" type="button" onClick={fire}>
      异步确认 · 1.5s
    </button>
  );
}

/* ---- 互斥替换演示 ---- */
function MutexDemo() {
  const btnBRef = useRef<HTMLButtonElement>(null);

  const fireMutex = (e: React.MouseEvent<HTMLButtonElement>) => {
    confirm(e.currentTarget, {
      title: "操作 A",
      message: "1.5s 后自动打开 B 替换 A。",
      confirmText: "执行",
    }).then((r) => console.log("A →", r));

    setTimeout(() => {
      const btnB = btnBRef.current;
      if (!btnB) return;
      confirm(btnB, {
        title: "操作 B",
        message: "已替换 A（A resolve dismiss）。",
        confirmText: "执行",
      }).then((r) => console.log("B →", r));
    }, 1500);
  };

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <button className="qw-btn qw-btn-primary" type="button" onClick={fireMutex}>
        演示互斥替换
      </button>
      <button
        ref={btnBRef}
        className="qw-btn"
        type="button"
        style={{ opacity: 0.55, cursor: "default" }}
        tabIndex={-1}
      >
        替换源点 B（1.5s 后自动）
      </button>
    </div>
  );
}
