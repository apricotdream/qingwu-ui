"use client";

import { toast } from "@qingwu-ui/toast";
import { useCallback, useEffect, useRef, useState } from "react";
import "@qingwu-ui/toast/style.css";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { TOAST_DESTROY, TOAST_FIELDS, createToast, toastToCode } from "./playground.config";

/* ============================================================
   Toast 轻提示演示页面
   ============================================================ */

const POSITIONS = [
  { key: "top-left", label: "↖ 左上" },
  { key: "top-center", label: "↑ 顶部" },
  { key: "top-right", label: "↗ 右上" },
  { key: "bottom-left", label: "↙ 左下" },
  { key: "bottom-center", label: "↓ 底部" },
  { key: "bottom-right", label: "↘ 右下" },
] as const;

/* 与 @qingwu-ui/toast 组件一致的 SVG 图标（样式预览用） */
const TOAST_ICONS: Record<string, string> = {
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  success:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
  warning:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  error:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

const CLOSE_ICON =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/* 预览行：解析 **关键词** 标记（与组件 renderLine 同逻辑，空段过滤） */
function PreviewLine({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g).filter(Boolean);
  return (
    <span className="qt-line">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <em key={part} className="qt-mark">
            {part}
          </em>
        ) : (
          <span key={part}>{part}</span>
        ),
      )}
    </span>
  );
}

/* 样式预览卡片：message + 可选两行（模拟 text-layout 排版） */
const PREVIEWS = [
  {
    type: "info" as const,
    lines: [{ id: "info-1", text: "磨砂玻璃 · **信息提示**" }],
    icon: TOAST_ICONS.info,
  },
  {
    type: "success" as const,
    lines: [{ id: "ok-1", text: "**操作成功**" }],
    icon: TOAST_ICONS.success,
  },
  {
    type: "warning" as const,
    lines: [
      { id: "warn-1", text: "磁盘空间**不足**，请及时清理" },
      { id: "warn-2", text: "以释放存储空间" },
    ],
    icon: TOAST_ICONS.warning,
  },
  {
    type: "error" as const,
    lines: [{ id: "err-1", text: "**登录失败**：账号或密码错误" }],
    icon: TOAST_ICONS.error,
  },
];

/* 与「长文本完整显示 / 长文本截断」两个场景共用的长消息 */
const LONG_TEXT =
  "这是一条用于演示 **text-layout** 内容自适应的长消息：默认不限行，文本完整显示、不截断、不加省略号；每一行都由排版引擎按 290px 精确断行，无论是中文、英文还是长 URL 都能优雅换行。";

/* ---- 场景卡代码：手写 toast 调用语句，框架外壳由 codegen 统一产出 ---- */
const snippet = (stmt: string) =>
  genAll({ meta: PKG.toast, symbol: "toast", stmt, destroy: TOAST_DESTROY });

export default function ToastPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="Toast 轻提示"
        desc="轻量级全局反馈：单例命令式调用，调整类型 / 位置 / 时长后点「应用」，再点击预览中的按钮。"
        fields={TOAST_FIELDS}
        create={createToast}
        toCode={toastToCode}
        log
        hostStyle={{ width: "auto" }}
      />

      <DemoCard
        title="样式预览 · Apple 磨砂玻璃"
        desc="四种语义图标与配色，与组件样式实时同步；点击卡片可重播入场动画。"
        snippets={snippet(`toast.info("磨砂玻璃 · 信息提示");
toast.success("操作成功");
toast.warn("磁盘空间不足，请及时清理");
toast.error("登录失败：账号或密码错误");`)}
        full
      >
        <StylePreview />
      </DemoCard>

      <DemoCard
        title="Promise 链"
        desc="一个 toast 跟随 Promise 三态切换：loading → success / error，2.5s 后随机成功或失败。"
        snippets={snippet(`toast.promise(
  fetch("/api/data").then((r) => r.json()),
  {
    loading: "正在加载数据...",
    success: (data) => data,
    error: (err) => err.message,
  },
  { position: "top-center" },
);`)}
      >
        <button
          className="qw-btn qw-btn-primary"
          type="button"
          onClick={() => {
            toast.promise(
              new Promise<string>((resolve, reject) => {
                setTimeout(
                  () =>
                    Math.random() > 0.4
                      ? resolve("数据加载成功")
                      : reject(new Error("网络请求失败")),
                  2500,
                );
              }),
              {
                loading: "正在加载数据...",
                success: (data) => data,
                error: (err) => (err as Error).message,
              },
            );
          }}
        >
          运行 Promise 链
        </button>
      </DemoCard>

      <DemoCard
        title="全局配置 configure"
        desc="toast.configure 设置默认值：下例 maxVisible=2，连发 5 条观察队列，结束后恢复 5。"
        snippets={snippet(`toast.configure({
  maxVisible: 2,      // 同时最多显示条数，超出排队（默认 5）
  duration: 4000,
  position: "top-center",
});

for (let i = 1; i <= 5; i++) {
  toast.info(\`队列消息 #\${i}\`);
}

toast.configure({ maxVisible: 5 }); // 恢复默认`)}
      >
        <button
          className="qw-btn qw-btn-primary"
          type="button"
          onClick={() => {
            toast.configure({ maxVisible: 2 });
            for (let i = 1; i <= 5; i++) {
              setTimeout(() => {
                toast.info(`队列消息 #${i}`);
                if (i === 5) toast.configure({ maxVisible: 5 });
              }, i * 150);
            }
          }}
        >
          队列管理 · maxVisible=2
        </button>
      </DemoCard>

      <DemoCard
        title="常驻与文本排版"
        desc="persist 常驻不自动消失（persistMaxVisible=3 时 FIFO 挤掉最老）；长文本默认完整显示，maxLines=2 超出截断加省略号。"
        snippets={snippet(`// 常驻通知，点击或 × 关闭
toast.info("点击此处或右侧 × 可关闭此通知", { persist: true });

// 长文本：text-layout 按 290px 精确断行，完整显示不截断
toast.info(LONG_TEXT);

// maxLines=2：超出按字符截断并追加省略号
toast.info(LONG_TEXT, { maxLines: 2 });

// 常驻上限：连发 4 条，最老的被挤掉
toast.configure({ persistMaxVisible: 3 });`)}
        full
      >
        <ScenesGrid />
      </DemoCard>

      <DemoCard
        title="关闭全部"
        desc="toast.dismiss(id) 关闭单条；toast.dismissAll() 一键清除所有位置的通知。"
        snippets={snippet(`const id = toast.info("可按 id 关闭");
toast.dismiss(id);      // 关闭单条
toast.dismissAll();     // 清除所有通知`)}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            className="qw-btn qw-btn-primary"
            type="button"
            onClick={() => toast.info("这是一条待清除的通知", { persist: true })}
          >
            先弹一条常驻
          </button>
          <button className="qw-btn" type="button" onClick={() => toast.dismissAll()}>
            dismissAll 关闭全部
          </button>
        </div>
      </DemoCard>
    </div>
  );
}

/* ---- 样式预览：逐卡延迟入场，点击重播 ---- */
function StylePreview() {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = previewRef.current?.querySelectorAll(".qt-toast");
    cards?.forEach((c, i) => {
      setTimeout(() => c.classList.add("qt-enter"), 200 * (i + 1));
    });
  }, []);

  const replayPreview = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = (e.target as HTMLElement).closest(".qt-toast");
    if (!card) return;
    card.classList.remove("qt-enter");
    void (card as HTMLElement).offsetWidth; /* 强制 reflow 重启动画 */
    card.classList.add("qt-enter");
  };

  return (
    <div ref={previewRef} className="qt-container toast-preview" onClick={replayPreview}>
      {PREVIEWS.map((p) => (
        <div key={p.type} className={`qt-toast qt-${p.type}`}>
          <span className="qt-icon" dangerouslySetInnerHTML={{ __html: p.icon }} />
          <span className="qt-msg">
            {p.lines.map((line) => (
              <PreviewLine key={line.id} text={line.text} />
            ))}
          </span>
          <button
            className="qt-close"
            type="button"
            aria-label="关闭通知"
            tabIndex={-1}
            dangerouslySetInnerHTML={{ __html: CLOSE_ICON }}
          />
        </div>
      ))}
    </div>
  );
}

/* ---- 常驻与文本排版场景按钮（位置可选） ---- */
function ScenesGrid() {
  const [position, setPosition] = useState<string>("top-center");
  const pos = position as never;

  const fire = useCallback(
    (key: string) => {
      if (key === "persistent") {
        toast.info("点击此处或右侧 × 可关闭此通知", { position: pos, persist: true });
      } else if (key === "full") {
        toast.info(LONG_TEXT, { position: pos });
      } else if (key === "truncate") {
        toast.info(LONG_TEXT, { position: pos, maxLines: 2 });
      } else if (key === "persistEvict") {
        for (let i = 1; i <= 4; i++) {
          setTimeout(() => {
            toast.info(`常驻消息 #${i}`, { position: pos, persist: true });
          }, i * 250);
        }
      }
    },
    [pos],
  );

  const buttons: { key: string; label: string; title: string }[] = [
    { key: "persistent", label: "常驻通知", title: "persist 常驻，点击关闭" },
    { key: "full", label: "长文本完整显示", title: "内容自适应，不截断不加省略号" },
    { key: "truncate", label: "长文本截断", title: "显式 maxLines=2，超出追加省略号" },
    { key: "persistEvict", label: "常驻上限挤最老", title: "persistMaxVisible=3，FIFO 挤掉最老" },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="toast-pos-grid" style={{ maxWidth: 420 }}>
        {POSITIONS.map((p) => (
          <button
            key={p.key}
            className={`toast-pos-cell${position === p.key ? " is-active" : ""}`}
            type="button"
            onClick={() => setPosition(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="toast-scene-row">
        {buttons.map((b) => (
          <button
            key={b.key}
            className="toast-type-btn"
            type="button"
            title={b.title}
            onClick={() => fire(b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
