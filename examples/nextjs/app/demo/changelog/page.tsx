import Link from "next/link";

/* 版本数据：新版本在上 */
const VERSIONS = [
  {
    version: "0.6.0",
    date: "2026-08-02",
    tag: "TagInput 首发 · 九包对齐",
    changes: [
      {
        type: "feat",
        text: "新增 @qingwu/tag-input 标签快捷插入组件：输入框 + 标签快捷栏，点击标签自动填入（逗号分隔），已插入自动隐藏、删除后重现",
      },
      {
        type: "feat",
        text: "Apple tinted 风格 chip（teal 品牌 tint、Lucide xmark、按压反馈、暗色 systemGray6 适配）",
      },
      {
        type: "feat",
        text: "allowEnterCreate：输入框回车将文本创建为新标签；createTag() 程序化创建",
      },
      {
        type: "feat",
        text: "inline chip-in-input 模式：已选标签 chip 内嵌输入框，× 删除即移除，回车添加已选；maxTags 数量上限",
      },
      {
        type: "improve",
        text: 'text-layout 驱动展开/收起（maxRows 折叠 + "+N 更多"）与标签栏高度；受控 / 非受控双模式',
      },
      {
        type: "improve",
        text: "九包版本统一对齐 0.6.0（tag-input 随本版首次发布，其余无功能变更）；演示页新增 TagInput / 骨架屏 API 属性表",
      },
    ],
  },
  {
    version: "0.5.1",
    date: "2026-08-01",
    tag: "Skeleton 骨架屏重设计",
    changes: [
      {
        type: "feat",
        text: "@qingwu/skeleton 块级渐变位移：每块独立 ::before 渐变层 transform 滑动（合成器线程零 repaint），错峰级联（负延迟，staggerDelay 可配）",
      },
      {
        type: "feat",
        text: "refetch 自适应：结构签名（structureSignature）+ MutationObserver，loading 期间内容结构变化骨架实时跟上",
      },
      {
        type: "feat",
        text: "视口增量渲染：只渲染 ±1 屏内骨架块，滚动增量补渲，已渲染上限 500 双向淘汰——长页面 DOM/合成层有界",
      },
      {
        type: "feat",
        text: "加载期位置守卫：文档坐标逐帧比对，路由回退/布局沉降自动重定位+重测，骨架与内容像素级对齐",
      },
      {
        type: "feat",
        text: "zIndex 选项（默认 9999，页面 chrome 在上时调低）；root 脱离文档自动自毁（防孤儿覆盖层）",
      },
      {
        type: "improve",
        text: "门槛过滤：宽≥48px 且高≥8px 的块才建动画层（头像/图标静态），reduced-motion 全关",
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-08-01",
    tag: "八包对齐",
    changes: [
      {
        type: "feat",
        text: "@qingwu/editor 更名 @qingwu/ai-editor，Toast 解耦为 onToast 事件通道",
      },
      {
        type: "feat",
        text: "@qingwu/upload 新增 URL 批量导入；@qingwu/toast 默认 top-center + 关键词强调 + error 震动；@qingwu/search 关闭键/清空键内嵌、遮罩挂 body",
      },
      { type: "improve", text: "文档站 EP 化改造；八包全部对齐 0.5.0（calendar 直升）" },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-31",
    tag: "Toast 组件",
    changes: [
      {
        type: "feat",
        text: "新增 @qingwu/toast 轻提示组件：零依赖、纯 TypeScript + 原生 DOM 渲染",
      },
      {
        type: "feat",
        text: "ARIA live region 内建（role=status + aria-live=polite），prefers-reduced-motion 自动克制",
      },
      {
        type: "feat",
        text: "6 种定位（top/bottom × left/center/right），4 种语义类型（info/success/warning/error）",
      },
      {
        type: "feat",
        text: "Promise 链：loading → success/error 三态自动流转，支持函数式消息生成",
      },
      { type: "feat", text: "队列管理：maxVisible 控制同时显示上限，超出自动排队，关闭后按序出队" },
      {
        type: "feat",
        text: "现代 UI 设计：毛玻璃质感卡片、实心彩色图标圆底、双层柔光阴影、弹簧曲线入场动画",
      },
      {
        type: "feat",
        text: "移动端适配：安全区 inset 偏移、窄屏自适应宽度与两行文本换行、44px 触控热区",
      },
      { type: "feat", text: "明暗双主题：自动响应用户主题偏好，CSS 自定义属性驱动，支持宿主覆盖" },
      { type: "feat", text: "演示页：语义类型卡片、3×2 定位可视化网格、5 种场景演示、操作日志" },
      {
        type: "improve",
        text: "优化 Toast 动画为纯 opacity 淡入淡出，不触发 GPU 合成层，多 toast 并发无显存膨胀",
      },
      { type: "improve", text: "全部组件统一版本号至 0.4.0" },
      { type: "fix", text: "修复 Promise 链不跟随用户选择定位属性变化的问题" },
    ],
  },
  {
    version: "0.3.1",
    date: "2026-07-30",
    tag: "工程加固",
    changes: [
      {
        type: "improve",
        text: "发版流程接入 publish-check 产物校验门禁：workspace 依赖残留检测 / CHANGELOG 版本一致性 / exports 产物齐全性",
      },
      {
        type: "improve",
        text: "新增 Playwright e2e 端到端测试：拖拽上传、压缩产出 WebP/AVIF、单张数量限制、按钮触发、真实 HTTP 上传",
      },
      { type: "improve", text: "README 同步 0.3.0 状态与 upload 组件完整文档" },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-07-29",
    tag: "Upload 上传",
    changes: [
      {
        type: "feat",
        text: "新增 @qingwu/upload 图片上传组件：拖拽区 / 按钮两种触发形态，按钮形态复用 @qingwu/button",
      },
      {
        type: "feat",
        text: "客户端压缩管线：支持原图 / WebP / AVIF 多份并行输出，AVIF 不支持时自动降级 WebP/PNG",
      },
      {
        type: "feat",
        text: "独立进度条组件，内置 XHR 上传与可插拔自定义上传函数，支持数量/大小/类型校验",
      },
      { type: "feat", text: "全部包统一版本号至 0.3.0" },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-07-28",
    tag: "首个公开版",
    changes: [
      { type: "feat", text: "首次发布青梧 UI 组件库，MIT 协议开源" },
      {
        type: "feat",
        text: "@qingwu/button 按钮：胶囊形（pill）风格，default / primary / amber / icon 四种变体，纯 DOM + CSS",
      },
      {
        type: "feat",
        text: "@qingwu/editor 编辑器：Tiptap/ProseMirror 内核，斜杠命令、AI 写作助手（OpenAI/DeepSeek/Qwen）、代码高亮、i18n、Web Clipper",
      },
      {
        type: "feat",
        text: "@qingwu/search 搜索：打字机占位轮播、Ctrl/⌘+K 全局唤起、全键盘导航+焦点陷阱、ARIA 完整语义、分类筛选",
      },
      {
        type: "feat",
        text: "@qingwu/calendar-core 日历引擎：headless 纯日期工具，零依赖零 DOM 副作用，tree-shakeable",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-27",
    tag: "内部先行",
    changes: [
      {
        type: "feat",
        text: "发布 @qingwu/calendar-core@0.1.0 与 @qingwu/search@0.1.0（私有 Nexus registry）",
      },
      {
        type: "feat",
        text: "Calendar 弹出日历组件：农历/节气/节日/黄历宜忌详情侧栏，日期/月份/年份三视图，键盘导航",
      },
      {
        type: "feat",
        text: "自研农历引擎 lunar.ts：零依赖，覆盖 1900-2100 年公农历互转、节气（基础日期+年份修正）、天干地支",
      },
      {
        type: "feat",
        text: "休假日历 JSON 配置：holidays/workdays 支持，日期格右上角「休/工」角标",
      },
      {
        type: "feat",
        text: "演示页 props 面板：属性实时修改 + 应用配置重新渲染，展开代码支持 React / HTML / Vue 三格式",
      },
      { type: "fix", text: "修复公农历转换中闰月定位算法错误（原实现存在边界 bug）" },
      {
        type: "fix",
        text: "节气数据从固定日期升级为基础日期 + 年份修正表（2020-2030 精度 ±0 天）",
      },
      { type: "fix", text: "修复「今天」按钮在当月时 pointer-events 拦截导致点击无效" },
      { type: "fix", text: "确认按钮现在会同步面板内修改的时间到选中日期并触发 onChange" },
    ],
  },
];

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  feat: { label: "新增", cls: "type-feat" },
  fix: { label: "修复", cls: "type-fix" },
  improve: { label: "改进", cls: "type-improve" },
};

export default function ChangelogPage() {
  return (
    <div className="changelog">
      <section style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>更新日志</h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--ink-2)" }}>
          记录青梧 UI 各组件的版本更新内容。
        </p>
      </section>

      {VERSIONS.map((v) => (
        <section key={v.version} className="changelog-version">
          <div className="changelog-head">
            <h2 className="changelog-ver">
              v{v.version}
              {v.tag && <span className="changelog-tag">{v.tag}</span>}
            </h2>
            <time className="changelog-date">{v.date}</time>
          </div>

          <ul className="changelog-list">
            {v.changes.map((c, i) => {
              const t = TYPE_LABELS[c.type] ?? TYPE_LABELS.improve;
              return (
                <li key={i} className="changelog-item">
                  <span className={`changelog-type ${t.cls}`}>{t.label}</span>
                  <span className="changelog-text">{c.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div style={{ marginTop: 28, fontSize: 13, color: "var(--ink-3)" }}>
        更多版本信息见各包 CHANGELOG.md 或{" "}
        <Link
          href="/"
          className="home-card-link"
          style={{ color: "var(--teal)", textDecoration: "underline" }}
        >
          回到首页
        </Link>
      </div>
    </div>
  );
}
