"use client";

import { useState, useCallback, useRef } from "react";

const SAMPLE_EVENTS = [
  { type: "ext", tag: "扩展", msg: "lunarPlugin 注册成功", time: "17:49:30.000" },
  { type: "perf", tag: "性能", msg: "42 个日格节点一次性创建完成", time: "17:49:30.001" },
  { type: "ext", tag: "扩展", msg: "festivalPlugin 注册成功（12 个节日）", time: "17:49:30.003" },
  { type: "ext", tag: "扩展", msg: "solarTermPlugin 注册成功（24 个节气）", time: "17:49:30.004" },
  { type: "perf", tag: "性能", msg: "首屏渲染耗时 2.3ms（含 dayMeta 计算）", time: "17:49:30.008" },
  { type: "sel", tag: "选择", msg: "用户选择 2026-10-01（国庆节·休）", time: "17:49:32.150" },
  { type: "sel", tag: "选择", msg: "onChange 回调触发: 2026-10-01", time: "17:49:32.152" },
  { type: "perf", tag: "性能", msg: "本次 Patch: 2 个日格（选中态 + 旧选中态清除）", time: "17:49:32.154" },
  { type: "ext", tag: "扩展", msg: "holidayPlugin 读取 2026 年休假 JSON", time: "17:49:32.200" },
  { type: "rule", tag: "规则", msg: "规则引擎编译 3 条禁用规则（周末禁用）", time: "17:49:32.201" },
  { type: "sel", tag: "选择", msg: "用户翻页到 2026-11 月", time: "17:49:35.001" },
  { type: "perf", tag: "性能", msg: "本月 Patch: 42 个日格（月切换）耗时 1.8ms", time: "17:49:35.004" },
  { type: "ext", tag: "扩展", msg: "panel 关闭（onOpenChange: false）", time: "17:49:36.500" },
  { type: "perf", tag: "性能", msg: "累计 total Patch: 46 次", time: "17:49:36.501" },
];

export default function LogPage() {
  const [log, setLog] = useState<typeof SAMPLE_EVENTS>([]);
  const [running, setRunning] = useState(false);
  const idxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSim = useCallback(() => {
    if (running) return;
    setRunning(true);
    setLog([]);
    idxRef.current = 0;

    timerRef.current = setInterval(() => {
      const i = idxRef.current;
      if (i >= SAMPLE_EVENTS.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setRunning(false);
        return;
      }
      setLog((prev) => [...prev, SAMPLE_EVENTS[i]]);
      idxRef.current = i + 1;
    }, 280);
  }, [running]);

  const tagClass: Record<string, string> = {
    ext: "ext",
    sel: "sel",
    perf: "perf",
    rule: "rule",
  };

  return (
    <>
      <section className="page-hero">
        <h1>事件日志</h1>
        <p>日历组件运行时的事件流：插件注册 → 选择变更 → Patch 统计 → 规则编译。所有事件均可在控制台和自定义回调中捕获。</p>
      </section>

      <div className="demo-grid">
        <div className="demo-card is-full">
          <div className="demo-card-header">
            <h4>事件模拟</h4>
            <p>点击按钮模拟一次完整的日历交互流程——从插件注册到日期选择到面板关闭。</p>
          </div>
          <div className="demo-card-stage">
            <button
              className={`event-sim-btn${running ? " is-running" : ""}`}
              onClick={startSim}
              disabled={running}
            >
              {running ? "事件流进行中..." : log.length > 0 ? "重新播放" : "▶ 播放事件流"}
            </button>
            {log.length > 0 && (
              <span style={{ marginLeft: 12, fontSize: 12, color: "var(--ink-3)" }}>
                {log.length} / {SAMPLE_EVENTS.length} 条事件
                {log.length === SAMPLE_EVENTS.length && " ✓ 完成"}
              </span>
            )}

            <ul className="log" style={{ maxHeight: 400, marginTop: 12 }}>
              {log.length === 0 && (
                <li style={{ color: "var(--ink-3)", fontFamily: "var(--font-ui)", fontStyle: "italic", padding: "8px 0" }}>
                  点击「播放事件流」开始模拟...
                </li>
              )}
              {log.map((evt, i) => (
                <li key={i}>
                  <time>{evt.time}</time>
                  <span className={`tag ${tagClass[evt.type] ?? "ext"}`}>{evt.tag}</span>
                  <span className="msg">{evt.msg}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 事件类型说明 */}
        <div className="demo-card">
          <div className="demo-card-header">
            <h4>事件类型</h4>
            <p>四种事件标签的含义与触发时机。</p>
          </div>
          <div className="demo-card-stage">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { tag: "扩展", cls: "ext", desc: "插件注册、注销、配置变更" },
                { tag: "选择", cls: "sel", desc: "用户选择/取消选择日期、翻页" },
                { tag: "性能", cls: "perf", desc: "节点创建、Patch 统计、渲染耗时" },
                { tag: "规则", cls: "rule", desc: "规则编译、规则命中、禁用判断" },
              ].map((item) => (
                <div key={item.tag} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`tag ${item.cls}`} style={{ flex: "none" }}>{item.tag}</span>
                  <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
