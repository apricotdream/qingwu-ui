"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@qingwu/toast";
import "@qingwu/toast/style.css";
import DemoCard from "@/components/DemoCard";

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

/* Apple 系统色 */
const TYPES = [
  { type: "info" as const, label: "信息提示", dot: "#007AFF" },
  { type: "success" as const, label: "操作成功", dot: "#34C759" },
  { type: "warning" as const, label: "警告提醒", dot: "#FF9500" },
  { type: "error" as const, label: "错误反馈", dot: "#FF3B30" },
] as const;

/* 与 @qingwu/toast 组件一致的 SVG 图标（样式预览用） */
const TOAST_ICONS: Record<string, string> = {
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

const CLOSE_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/* 预览行：解析 **关键词** 标记（与组件 renderLine 同逻辑，空段过滤） */
function PreviewLine({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g).filter(Boolean);
  return (
    <span className="qt-line">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <em key={part} className="qt-mark">{part}</em>
        ) : (
          <span key={part}>{part}</span>
        ),
      )}
    </span>
  );
}

/* 样式预览卡片：message + 可选两行（模拟 text-layout 排版） */
const PREVIEWS = [
  { type: "info" as const, lines: [{ id: "info-1", text: "磨砂玻璃 · **信息提示**" }], icon: TOAST_ICONS.info },
  { type: "success" as const, lines: [{ id: "ok-1", text: "**操作成功**" }], icon: TOAST_ICONS.success },
  { type: "warning" as const, lines: [{ id: "warn-1", text: "磁盘空间**不足**，请及时清理" }, { id: "warn-2", text: "以释放存储空间" }], icon: TOAST_ICONS.warning },
  { type: "error" as const, lines: [{ id: "err-1", text: "**登录失败**：账号或密码错误" }], icon: TOAST_ICONS.error },
] as const;

const SCENES = [
  {
    key: "persistent",
    label: "常驻通知",
    desc: "不自动消失，点击关闭",
    action: (pos: string) => toast.info("点击此处或右侧 × 可关闭此通知", { position: pos as never, duration: 0 }),
  },
  {
    key: "long",
    label: "长文本截断",
    desc: "超长消息自动省略",
    action: (pos: string) => toast.info("这条通知消息的文本内容非常长，用于验证文本在桌面端单行截断和移动端两行换行的显示效果", { position: pos as never }),
  },
  {
    key: "promise",
    label: "Promise 链",
    desc: "loading → success / error",
    action: (pos: string) => {
      toast.promise(
        new Promise<string>((resolve, reject) => {
          setTimeout(() => (Math.random() > 0.4 ? resolve("数据加载成功") : reject(new Error("网络请求失败"))), 2500);
        }),
        {
          loading: "正在加载数据...",
          success: (data) => data,
          error: (err) => (err as Error).message,
        },
        { position: pos as never },
      );
    },
  },
  {
    key: "queue",
    label: "队列管理",
    desc: "maxVisible=2, 5 条入队",
    action: (pos: string) => {
      toast.configure({ maxVisible: 2 });
      for (let i = 1; i <= 5; i++) {
        setTimeout(() => {
          toast.info(`队列消息 #${i}`, { position: pos as never });
          if (i === 5) toast.configure({ maxVisible: 5 });
        }, i * 150);
      }
    },
  },
  {
    key: "dismissAll",
    label: "关闭全部",
    desc: "一键清除所有通知",
    action: () => toast.dismissAll(),
  },
] as const;

const DEFAULT_TEXT = "这条通知消息的文本内容非常长，用于演示 **text-layout** 的自适应排版能力：一行放不下时自动换行，超过 maxLines 时按字符截断并追加省略号";

export default function ToastPage() {
  const [position, setPosition] = useState<string>("top-center");
  const [text, setText] = useState<string>(DEFAULT_TEXT);
  const [maxLines, setMaxLines] = useState<number>(2);
  const [log, setLog] = useState<string[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-39), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  /* 预览卡片：页面加载后逐卡延迟入场（模拟真实触发时序，动画可见）；
     点击卡片重播动画（错误卡可反复观看震动效果） */
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

  const pos = position as
    | "top-left" | "top-center" | "top-right"
    | "bottom-left" | "bottom-center" | "bottom-right";

  const fireType = (type: "info" | "success" | "warning" | "error") => {
    const labels = { info: "提示", success: "成功", warning: "警告", error: "错误" };
    const fns = { info: toast.info, success: toast.success, warning: toast.warn, error: toast.error };
    const id = fns[type](`${labels[type]} — 轻提示消息`, { position: pos, duration: 3500 });
    addLog(`${labels[type]} | id=${id}`);
  };

  const fireScene = (scene: (typeof SCENES)[number]) => {
    scene.action(pos);
    addLog(`场景: ${scene.label}`);
  };

  /* 自适应文本：text-layout 精确排版 */
  const fireTextDemo = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      addLog("文本为空，未触发");
      return;
    }
    const id = toast.info(trimmed, { position: pos, maxLines });
    addLog(`自适应文本 | 长度=${trimmed.length} | maxLines=${maxLines} | id=${id}`);
  };

  const snippets = (() => {
    const react = [
      'import { toast } from "@qingwu/toast";',
      'import "@qingwu/toast/style.css";',
      "",
      'toast.success("操作成功");',
      'toast.error("操作失败");',
      "",
      'toast("自定义消息", {',
      '  position: "top-right",',
      "  duration: 3000,",
      "});",
      "",
      "// 自适应文本（text-layout 精确排版）",
      'toast.info("超长文本……自动截断", { maxLines: 2 });',
      "toast.configure({ maxLines: 3 });",
      "",
      "// Promise 链",
      "toast.promise(fetchUser(), {",
      '  loading: "加载中...",',
      '  success: (data) => `欢迎 ${data.name}`,',
      '  error: "加载失败",',
      "});",
      "",
      "// 关闭 & 配置",
      "toast.dismiss(id);",
      "toast.dismissAll();",
      'toast.configure({ maxVisible: 3 });',
    ].join("\n");

    const html = [
      '<script type="module">',
      '  import { toast } from "https://unpkg.com/@qingwu/toast";',
      "</script>",
      '<link rel="stylesheet" href="https://unpkg.com/@qingwu/toast/style.css" />',
      "<script>",
      '  toast.success("就绪");',
      "</script>",
    ].join("\n");

    const vue = [
      '<script setup lang="ts">',
      'import { toast } from "@qingwu/toast";',
      'import "@qingwu/toast/style.css";',
      '',
      'onMounted(() => toast("Vue 就绪"));',
      "</script>",
    ].join("\n");

    return { react, html, vue };
  })();

  return (
    <div className="demo-grid">
      <DemoCard
        title="Toast 轻提示"
        desc="轻量级全局反馈，零依赖 · 纯 TypeScript · ARIA live region 内建 · 6 种定位 · 4 种语义 · Promise 链 · 队列管理"
        full
        snippets={snippets}
      >
        <div className="toast-demo">
          {/* ============================================================
              ① 样式预览 · 与组件样式实时同步
              ============================================================ */}
          <section>
            <div className="toast-section-title">样式预览 · Apple 磨砂玻璃 <span className="toast-preview-hint">（点击卡片重播入场动画）</span></div>
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
          </section>

          {/* ============================================================
              ② 语义类型
              ============================================================ */}
          <section>
            <div className="toast-section-title">语义类型</div>
            <div className="toast-type-row">
              {TYPES.map((t) => (
                <button
                  key={t.type}
                  className="toast-type-btn"
                  type="button"
                  onClick={() => fireType(t.type)}
                >
                  <span className="toast-type-dot" style={{ background: t.dot }} />
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          {/* ============================================================
              ③ 定位选择
              ============================================================ */}
          <section>
            <div className="toast-section-title">定位 · 当前: {POSITIONS.find((p) => p.key === position)?.label}</div>
            <div className="toast-pos-grid">
              {POSITIONS.map((p) => (
                <button
                  key={p.key}
                  className={`toast-pos-cell${position === p.key ? " is-active" : ""}`}
                  type="button"
                  onClick={() => { setPosition(p.key); addLog(`切换定位 → ${p.label}`); }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* ============================================================
              ④ 场景演示
              ============================================================ */}
          <section>
            <div className="toast-section-title">场景演示</div>
            <div className="toast-scene-row">
              {SCENES.map((s) => (
                <button
                  key={s.key}
                  className="toast-type-btn"
                  type="button"
                  onClick={() => fireScene(s)}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          {/* ============================================================
              ⑤ 自适应文本 · text-layout
              ============================================================ */}
          <section>
            <div className="toast-section-title">自适应文本 · @qingwu/text-layout</div>
            <div className="toast-text-demo">
              <textarea
                className="toast-text-input"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="输入消息文本…"
              />
              <div className="toast-text-controls">
                <span className="toast-text-label">最大行数</span>
                <div className="toast-type-row">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      className={`toast-type-btn${maxLines === n ? " is-active" : ""}`}
                      type="button"
                      onClick={() => setMaxLines(n)}
                    >
                      {n} 行
                    </button>
                  ))}
                </div>
                <button className="toast-type-btn" type="button" onClick={fireTextDemo}>
                  触发自适应排版
                </button>
              </div>
            </div>
          </section>

          {/* ============================================================
              ⑥ 操作日志
              ============================================================ */}
          <section>
            <div className="toast-section-title">操作日志</div>
            <div className="cal-log-panel" style={{ maxWidth: "100%" }}>
              <div className="cal-log-list">
                {log.length === 0 ? (
                  <div className="cal-log-empty">点击上方交互控件，每次操作将记录在此</div>
                ) : (
                  log.map((msg, i) => (
                    <div key={i} className="cal-log-item">{msg}</div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </DemoCard>
    </div>
  );
}
