export default function InspectorPage() {
  return (
    <>
      <section className="page-hero">
        <h1>dayMeta 检视器</h1>
        <p>
          悬停或聚焦日期时实时查看 dayMeta 合并管线输出，追溯每条字段的来源插件，检验插件执行顺序。
        </p>
      </section>

      <div className="demo-grid">
        {/* 数据流图 */}
        <div className="demo-card is-full">
          <div className="demo-card-header">
            <h4>dayMeta 管线架构</h4>
            <p>
              多个 DayMetaProvider
              插件按注册顺序依次执行，后注册的插件可覆盖前序结果，最终合并为完整 dayMeta 对象。
            </p>
          </div>
          <div className="demo-card-stage">
            <div className="pipeline" style={{ justifyContent: "center" }}>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Plugin 1</div>
                <div className="pipeline-step-name">lunarPlugin</div>
                <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>农历日期</div>
              </div>
              <span className="pipeline-arrow">+</span>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Plugin 2</div>
                <div className="pipeline-step-name">festivalPlugin</div>
                <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>节日信息</div>
              </div>
              <span className="pipeline-arrow">+</span>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Plugin 3</div>
                <div className="pipeline-step-name">solarTermPlugin</div>
                <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>节气标注</div>
              </div>
              <span className="pipeline-arrow">+</span>
              <div className="pipeline-step">
                <div className="pipeline-step-label">Plugin N</div>
                <div className="pipeline-step-name">holidayPlugin</div>
                <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>休假表</div>
              </div>
              <span className="pipeline-arrow">=</span>
              <div className="pipeline-step" style={{ borderColor: "var(--teal)", borderWidth: 2 }}>
                <div className="pipeline-step-label" style={{ color: "var(--vermilion)" }}>
                  Output
                </div>
                <div className="pipeline-step-name">dayMeta</div>
              </div>
            </div>
          </div>
        </div>

        {/* dayMeta 结构示例 */}
        <div className="demo-card">
          <div className="demo-card-header">
            <h4>dayMeta 对象结构</h4>
            <p>以 2026-10-01（国庆节）为例，合并后的完整 dayMeta。</p>
          </div>
          <div className="demo-card-stage">
            <dl className="meta-rows">
              <dt>ISO 日期</dt>
              <dd className="meta-iso">2026-10-01</dd>
              <dt>农历日期</dt>
              <dd>八月二十 · 丙午年</dd>
              <dt>干支</dt>
              <dd>丙午年 · 丁酉月 · 戊申日</dd>
              <dt>节日</dt>
              <dd style={{ color: "var(--vermilion)" }}>国庆节</dd>
              <dt>节气</dt>
              <dd>—</dd>
              <dt>休假标记</dt>
              <dd style={{ color: "var(--vermilion)" }}>休（1/8 天）</dd>
              <dt>宜忌</dt>
              <dd style={{ fontSize: 11 }}>
                <span style={{ color: "var(--teal)" }}>宜：</span>嫁娶 出行 开业 立约 祭祀
                <br />
                <span style={{ color: "var(--vermilion)" }}>忌：</span>动土 安葬 开渠 放水
              </dd>
            </dl>
          </div>
        </div>

        {/* 来源追溯 */}
        <div className="demo-card">
          <div className="demo-card-header">
            <h4>字段来源追溯</h4>
            <p>每条 dayMeta 字段都可追溯到具体插件来源，便于调试和验证。</p>
          </div>
          <div className="demo-card-stage">
            <div className="trace">
              <div className="trace-title">来源追溯</div>
              <ol>
                <li>
                  <code>lunarDate</code> → lunarPlugin（农历引擎）
                </li>
                <li>
                  <code>stemBranch</code> → lunarPlugin（天干地支计算）
                </li>
                <li>
                  <code>festival</code> → festivalPlugin（节日数据集）
                </li>
                <li>
                  <code>solarTerm</code> → solarTermPlugin（节气数据集）
                </li>
                <li>
                  <code>isHoliday</code> → holidayPlugin（用户 JSON 配置）
                </li>
                <li>
                  <code>isWorkday</code> → holidayPlugin（调班数据）
                </li>
                <li>
                  <code>almanac</code> → lunarPlugin（黄历宜忌）
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
