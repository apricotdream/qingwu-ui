export default function CalendarBasicPage() {
  const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

  /* 可视化日历网格数据 —— 模拟 2026 年 8 月 */
  interface VisCell {
    d: number;
    sub: string;
    m: string;
    holiday?: boolean;
    badge?: string;
    badgeClass?: string;
    today?: boolean;
    term?: string;
  }
  const cells: VisCell[] = [
    /* 7/27 - 8/2 */ { d: 27, sub: "廿三", m: "prev" }, { d: 28, sub: "廿四", m: "prev" }, { d: 29, sub: "廿五", m: "prev" }, { d: 30, sub: "廿六", m: "prev" }, { d: 31, sub: "廿七", m: "prev" }, { d: 1, sub: "建军", m: "curr", holiday: true, badge: "休", badgeClass: "rest" }, { d: 2, sub: "十九", m: "curr" },
    ...[7, 8, 9, 10, 11, 12, 13].map((d) => ({ d, sub: ["二十", "廿一", "廿二", "廿三", "廿四", "廿五", "廿六"][d - 7], m: "curr" })),
    ...[14, 15, 16, 17, 18, 19, 20].map((d) => {
      const subs: Record<number, string> = { 14: "廿七", 15: "廿八", 16: "廿九", 17: "三十", 18: "初一", 19: "初二", 20: "初三" };
      return { d, sub: subs[d] ?? `${d}`, m: "curr" };
    }),
    ...[21, 22, 23, 24, 25, 26, 27].map((d) => ({ d, sub: `初${["四", "五", "六", "七", "八", "九", "十"][d - 21]}`, m: "curr" })),
    ...[28, 29, 30, 31, 1, 2, 3].map((d) => ({ d, sub: d <= 31 ? `十${d - 27}` : `${d}`, m: "curr" })),
  ].map((cell) => ({ ...cell, today: cell.d === 31 && cell.m === "curr" }));

  return (
    <>
      <section className="page-hero">
        <h1>Calendar 日历网格</h1>
        <p>日历组件的核心——日格渲染管线。每一天格携带公历/农历/节气/节日/宜忌等多维信息，通过 DOM Patch 策略进行高性能更新。</p>
      </section>

      <div className="demo-grid">
        {/* 可视化日历 */}
        <div className="demo-card is-full">
          <div className="demo-card-header">
            <h4>日格结构</h4>
            <p>下方展示一个典型的日历月视图网格结构。每个日格包含公历数字、农历日期、节日/节气标注、休/工角标。</p>
          </div>
          <div className="demo-card-stage" style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ maxWidth: 500, width: "100%" }}>
              {/* 月导航 */}
              <div className="cal-top" style={{ justifyContent: "center", marginBottom: 14 }}>
                <button className="btn icon" style={{ width: 32, height: 32, fontSize: 14 }}>‹</button>
                <div className="cal-title" style={{ minWidth: 120, justifyContent: "center" }}>
                  <span className="cal-month">2026 年 8 月</span>
                  <span className="cal-lunar-year">丙午年·七月</span>
                </div>
                <button className="btn icon" style={{ width: 32, height: 32, fontSize: 14 }}>›</button>
              </div>

              {/* 星期头 */}
              <div className="qw-weekdays">
                {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
              </div>

              {/* 日格网格 */}
              <div className="vis-cal">
                {cells.map((cell, i) => (
                  <div
                    key={i}
                    className={`vis-cal-cell${cell.m === "prev" ? " other-month" : ""}${cell.today ? " today" : ""}${cell.holiday ? " holiday" : ""}`}
                  >
                    <span className="vis-cal-cell-num">{cell.d}</span>
                    <span className="vis-cal-cell-sub">{cell.sub}</span>
                    {cell.badge && (
                      <span className={`vis-cal-cell-badge ${cell.badgeClass}`}>{cell.badge}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="cal-foot" style={{ textAlign: "center" }}>
                <span className="cal-foot-label">图例：</span>
                <span style={{ color: "var(--vermilion)" }}>休</span> = 休息日 ·{" "}
                <span style={{ color: "var(--teal)" }}>工</span> = 调班工作日 ·{" "}
                <span style={{ marginLeft: 4, color: "var(--amber)" }}>节气</span> = 节气标注
              </div>
            </div>
          </div>
        </div>

        {/* Day Meta 管线说明 */}
        <div className="demo-card is-full">
          <div className="demo-card-header">
            <h4>DayMeta 渲染管线</h4>
            <p>每个日格的 dayMeta 对象经过多层插件管线合并生成，最终写入 DOM。所有插件遵循统一的 DayMetaProvider 契约。</p>
          </div>
          <div className="demo-card-stage">
            <div className="pipeline" style={{ justifyContent: "center" }}>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Step 1</div>
                <div className="pipeline-step-name">基础日期</div>
              </div>
              <span className="pipeline-arrow">→</span>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Step 2</div>
                <div className="pipeline-step-name">农历插件</div>
              </div>
              <span className="pipeline-arrow">→</span>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Step 3</div>
                <div className="pipeline-step-name">节日/节气</div>
              </div>
              <span className="pipeline-arrow">→</span>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Step 4</div>
                <div className="pipeline-step-name">休假表</div>
              </div>
              <span className="pipeline-arrow">→</span>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Step 5</div>
                <div className="pipeline-step-name">规则引擎</div>
              </div>
              <span className="pipeline-arrow">→</span>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Output</div>
                <div className="pipeline-step-name">dayMeta</div>
              </div>
            </div>
            <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--ink-3)", marginTop: 12 }}>
              完整交互演示请参阅{" "}
              <a href="/demo/calendar-popup" style={{ color: "var(--teal)", fontWeight: 600 }}>
                Calendar 弹出选择
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
