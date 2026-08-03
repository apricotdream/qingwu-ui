"use client";

import { useCallback, useRef, useState } from "react";

/* 模拟性能基准测试 */
const METRICS = [
  { key: "nodes", label: "节点创建", unit: "个", base: 42, variance: 8 },
  { key: "patch", label: "本次 Patch", unit: "次", base: 3, variance: 5 },
  { key: "total", label: "累计 Patch", unit: "次", base: 0, variance: 0 },
  { key: "fps", label: "渲染帧率", unit: "fps", base: 60, variance: 5 },
  { key: "memory", label: "内存占用", unit: "KB", base: 180, variance: 40 },
  { key: "time", label: "渲染耗时", unit: "ms", base: 2.1, variance: 1.5 },
];

export default function PerfPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Record<string, number>[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runBenchmark = useCallback(() => {
    if (running) return;
    setRunning(true);
    setHistory([]);
    setResults({});

    let round = 0;
    const maxRounds = 12;

    timerRef.current = setInterval(() => {
      round++;
      const snapshot: Record<string, number> = {};
      for (const m of METRICS) {
        const val = m.base + (Math.random() - 0.5) * m.variance * 2;
        snapshot[m.key] =
          m.variance === 0 ? m.base + round * 2 : Math.max(0, Math.round(val * 10) / 10);
      }
      setResults(snapshot);
      setHistory((prev) => [...prev, snapshot]);

      if (round >= maxRounds) {
        if (timerRef.current) clearInterval(timerRef.current);
        setRunning(false);
      }
    }, 300);
  }, [running]);

  const maxTotal = Math.max(...history.map((h) => h.total ?? 0), 1);

  return (
    <>
      <section className="page-hero">
        <h1>渲染性能</h1>
        <p>
          日历组件采用一次性节点创建 + 快照 Diff + 按格 DOM Patch
          的渲染策略，避免全量重绘。点击下方按钮运行 12 轮性能模拟。
        </p>
      </section>

      <div className="demo-grid">
        <div className="demo-card is-full">
          <div className="demo-card-header">
            <h4>性能基准模拟</h4>
            <p>模拟连续 12 次日期切换/月份切换的 Patch 性能表现。</p>
          </div>
          <div className="demo-card-stage">
            <div style={{ marginBottom: 16 }}>
              <button
                className={`event-sim-btn${running ? " is-running" : ""}`}
                onClick={runBenchmark}
                disabled={running}
              >
                {running ? "模拟运行中..." : history.length > 0 ? "重新运行" : "▶ 运行性能模拟"}
              </button>
              {history.length > 0 && (
                <span style={{ marginLeft: 12, fontSize: 12.5, color: "var(--ink-3)" }}>
                  已完成 {history.length} / 12 轮
                </span>
              )}
            </div>

            {/* 实时指标 */}
            <div className="perf-sim-grid">
              {METRICS.map((m) => (
                <div key={m.key} className="perf-sim-card">
                  <div className="perf-card-label">{m.label}</div>
                  <div className={`perf-sim-value${history.length >= 12 ? " done" : ""}`}>
                    {results[m.key] ?? "—"}
                  </div>
                  <div className="perf-card-sub">{m.unit}</div>
                  {m.key === "total" && (
                    <div className="perf-sim-bar">
                      <div
                        className="perf-sim-bar-fill"
                        style={{
                          width: `${Math.min(100, ((results[m.key] ?? 0) / maxTotal) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 历史图表 */}
            {history.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 650,
                    color: "var(--ink-3)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  累计 Patch 趋势
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 60 }}>
                  {history.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${Math.max(4, ((h.total ?? 0) / maxTotal) * 100)}%`,
                        background:
                          running && i === history.length - 1
                            ? "linear-gradient(180deg, var(--vermilion), var(--amber))"
                            : "var(--teal)",
                        borderRadius: "2px 2px 0 0",
                        transition: "height 0.3s ease",
                        minWidth: 6,
                        opacity: running ? 0.7 : 0.9,
                      }}
                      title={`轮 ${i + 1}: ${h.total} 次`}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    fontSize: 10,
                    color: "var(--ink-3)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>轮 1</span>
                  <span>轮 {history.length}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 策略说明 */}
        <div className="demo-card is-full">
          <div className="demo-card-header">
            <h4>渲染策略</h4>
            <p>三种核心优化策略，确保日历组件在频繁交互下保持流畅。</p>
          </div>
          <div className="demo-card-stage">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {[
                {
                  title: "一次性节点创建",
                  desc: "初始化时一次性创建所有日格 DOM 节点（42个），后续不再增删节点。",
                },
                {
                  title: "快照 Diff",
                  desc: "每次状态变更生成 dayMeta 快照与上一次对比，精确定位变化的日格。",
                },
                {
                  title: "按格 Patch",
                  desc: "仅对 Diff 标记的日格节点进行 DOM 属性写入，其余节点保持不变。",
                },
              ].map((s) => (
                <div key={s.title} className="perf-card" style={{ textAlign: "left" }}>
                  <div className="perf-card-label">{s.title}</div>
                  <div
                    style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6, marginTop: 6 }}
                  >
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
