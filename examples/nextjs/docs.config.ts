/* ============================================================
   青梧 UI · 文档站单一数据源
   侧栏 / 头部导航 / 页面标题区 / 本页目录 / 上一页下一页 / 搜索索引
   全部由此配置生成，新增页面只需在此登记。
   ============================================================ */

import {
  ICON_BELL,
  ICON_BOX,
  ICON_CALENDAR,
  ICON_EDIT,
  ICON_FILE,
  ICON_INFO,
  ICON_LIST,
  ICON_SEARCH,
  ICON_TAG,
  ICON_TYPE,
  ICON_UPLOAD,
} from "@icon/icons";

export interface DocPage {
  /** 页面路由（同时作为搜索跳转目标） */
  href: string;
  /** 中文名 / 组件名（标题区主标题） */
  title: string;
  /** 英文名（标题区灰字，若 title 已包含则省略） */
  en: string;
  /** 一句话描述（标题区 + 搜索索引） */
  desc: string;
  /** 搜索关键词（参与全文匹配，弥补 SearchBox 仅匹配 title/sub 的局限） */
  keywords: string[];
  /** 侧栏图标 */
  icon: string;
  /** 组件 API 属性表（demo 页渲染，分组见 ApiGroup） */
  api?: ApiGroup[];
}

/** 一个 API 属性 */
export interface ApiProp {
  /** 属性名（代码字体） */
  name: string;
  /** 说明 */
  desc: string;
  /** TS 类型（代码字体） */
  type: string;
  /** 默认值；"-" 表示无 */
  default: string;
}

/** API 属性表分组（如「配置项」「事件」） */
export interface ApiGroup {
  /** 分组标题 */
  title: string;
  props: ApiProp[];
}

export interface DocSection {
  id: string;
  title: string;
  icon: string;
  pages: DocPage[];
}

/* ---- 指南区 ---- */
export const GUIDE_SECTION: DocSection = {
  id: "guide",
  title: "指南",
  icon: ICON_BOX,
  pages: [
    {
      href: "/guide/install",
      title: "安装",
      en: "Installation",
      desc: "按需安装组件包，零依赖、纯 TypeScript、原生 DOM 渲染，React / Vue / 原生 HTML 均可使用。",
      keywords: [
        "npm",
        "pnpm",
        "bun",
        "安装",
        "快速开始",
        "quick start",
        "CDN",
        "unpkg",
        "ESM",
        "CJS",
        "style.css",
      ],
      icon: ICON_BOX,
    },
    {
      href: "/guide/lunar",
      title: "历法说明",
      en: "Lunar Calendar",
      desc: "1900-2100 年农历引擎：查表法推算、节气近似算法、节日习俗数据、干支生肖与休假表注入。",
      keywords: [
        "农历",
        "节气",
        "节日",
        "干支",
        "生肖",
        "宜忌",
        "黄历",
        "lunar",
        "solar term",
        "festival",
        "holiday",
      ],
      icon: ICON_CALENDAR,
    },
    {
      href: "/guide/cover-upload",
      title: "封面图接入范式",
      en: "Cover Upload Pattern",
      desc: "单值字段（如封面 URL）接入 Upload 的完整范式：默认值覆盖、uploadFn 真进度、URL 生命周期、换图删旧、提交校验联动。",
      keywords: [
        "封面",
        "cover",
        "单值字段",
        "upload",
        "onProgress",
        "uploadFn",
        "生命周期",
        "换图",
        "接入范式",
      ],
      icon: ICON_UPLOAD,
    },
  ],
};

/* ---- 组件区（Element Plus 式分类） ---- */
export const COMPONENT_SECTIONS: DocSection[] = [
  {
    id: "basic",
    title: "基础组件",
    icon: ICON_BOX,
    pages: [
      {
        href: "/demo/button",
        title: "Button 按钮",
        en: "Button",
        desc: "药丸风格按钮：默认 / 主色 / 琥珀 / 图标四变体。",
        keywords: ["按钮", "button", "主色", "琥珀", "图标", "药丸"],
        icon: ICON_BOX,
      },
      {
        href: "/demo/input",
        title: "Input 输入框",
        en: "Input",
        desc: "CSS 流光边框动画 + 简约经典两种样式。",
        keywords: ["输入框", "input", "流光", "边框", "表单"],
        icon: ICON_EDIT,
      },
      {
        href: "/demo/tag-input",
        title: "TagInput 标签快捷插入",
        en: "TagInput",
        desc: "输入框 + 标签快捷栏：点击标签自动填入，已插入自动隐藏，删除后重现；text-layout 驱动展开/收起。",
        keywords: [
          "标签",
          "tag",
          "tag input",
          "快捷插入",
          "chip",
          "标签栏",
          "展开收起",
          "formatInsert",
        ],
        icon: ICON_TAG,
        api: [
          {
            title: "配置项",
            props: [
              {
                name: "value",
                desc: "受控输入值（传入后进入受控模式，用户操作仅回调不内部改值；inline 模式下不生效）",
                type: "string",
                default: "-",
              },
              {
                name: "defaultValue",
                desc: "非受控初始输入值（inline 模式下不生效）",
                type: "string",
                default: '""',
              },
              {
                name: "tags",
                desc: "受控可用标签列表（传入后 × 删除仅回调不内部改值）",
                type: "string[]",
                default: "-",
              },
              {
                name: "defaultTags",
                desc: "非受控初始可用标签列表",
                type: "string[]",
                default: "[]",
              },
              {
                name: "formatInsert",
                desc: '标签插入格式器，默认原样；标签间默认以 ", " 分隔（自定义格式时需同步 parseTags）',
                type: "(tag: string) => string",
                default: "原样",
              },
              {
                name: "parseTags",
                desc: "从输入值解析已存在标签，驱动快捷栏显隐（已插入的标签按钮消失、删除后重现）",
                type: "(value: string) => string[]",
                default: "逗号分割",
              },
              {
                name: "maxRows",
                desc: "标签栏最大行数（layoutChips 计算），超出折叠为 +N 更多；0 不折叠",
                type: "number",
                default: "2",
              },
              {
                name: "moreLabel",
                desc: "折叠时按钮文案",
                type: "(count: number) => string",
                default: "+N 更多",
              },
              {
                name: "collapseLabel",
                desc: "展开后收起按钮文案",
                type: "string",
                default: "收起",
              },
              { name: "placeholder", desc: "输入框占位符", type: "string", default: "-" },
              {
                name: "allowEnterCreate",
                desc: "输入框按 Enter 时，将当前输入文本作为新标签加入快捷栏（已存在则忽略）并清空输入；inline 模式下 Enter 始终加入已选标签，无需此开关",
                type: "boolean",
                default: "false",
              },
              {
                name: "inline",
                desc: "chip-in-input 模式：已选标签以 chip 内嵌输入框，× 删除即从已选数组移除；下方标签栏仍为可用标签建议；inline 下 value 字符串不生效，已选以 selected / defaultSelected 为准，input 仅承载草稿（Enter / 逗号 / 失焦 / 点建议提交）",
                type: "boolean",
                default: "false",
              },
              {
                name: "selected",
                desc: "inline 专属：已选标签数组（受控，传入后提交/删除仅回调 onSelectedChange，由调用方以 update({ selected }) 回灌）",
                type: "string[]",
                default: "-",
              },
              {
                name: "defaultSelected",
                desc: "inline 专属：非受控初始已选标签数组",
                type: "string[]",
                default: "[]",
              },
              {
                name: "maxTags",
                desc: "输入值中标签数量上限，0 不限；超出后插入 / 回车添加被忽略",
                type: "number",
                default: "0",
              },
              {
                name: "disabled",
                desc: "禁用（输入框与标签按钮均不可交互）",
                type: "boolean",
                default: "false",
              },
              {
                name: "readOnly",
                desc: "只读（输入框只读，标签按钮禁用但可见）",
                type: "boolean",
                default: "false",
              },
              { name: "removable", desc: "是否渲染 × 移除按钮", type: "boolean", default: "true" },
              {
                name: "className",
                desc: "自定义类名（追加到根容器）",
                type: "string",
                default: "-",
              },
              {
                name: "font",
                desc: "CSS font 字符串（text-layout 测量用），不传则读取容器 computed style",
                type: "string",
                default: "computed",
              },
            ],
          },
          {
            title: "事件",
            props: [
              {
                name: "onChange",
                desc: "输入值变化回调（bar 模式：逗号拼接串；inline 模式：草稿文本）",
                type: "(value: string) => void",
                default: "-",
              },
              {
                name: "onTagsChange",
                desc: "标签列表变化回调（× 移除快捷标签时）",
                type: "(tags: string[]) => void",
                default: "-",
              },
              {
                name: "onSelectedChange",
                desc: "inline 专属：已选标签数组变化回调（提交 / × 删除 / 点建议时触发）",
                type: "(selected: string[]) => void",
                default: "-",
              },
            ],
          },
          {
            title: "实例方法",
            props: [
              {
                name: "insertTag(tag)",
                desc: "程序化插入标签到输入框（已存在则忽略；inline 模式为提交到已选数组并清空草稿）",
                type: "(tag: string) => void",
                default: "-",
              },
              {
                name: "createTag(tag)",
                desc: "程序化创建新标签加入快捷栏（allowEnterCreate 的内部逻辑；已存在则忽略并清空输入）",
                type: "(tag: string) => void",
                default: "-",
              },
              {
                name: "removeTag(tag)",
                desc: "从快捷栏移除标签（不改动输入值）",
                type: "(tag: string) => void",
                default: "-",
              },
              {
                name: "update({ value?, tags? })",
                desc: "受控模式下外部同步值",
                type: "(opts) => void",
                default: "-",
              },
              {
                name: "setDisabled(v) / setReadOnly(v)",
                desc: "动态切换禁用 / 只读状态",
                type: "(v: boolean) => void",
                default: "-",
              },
              {
                name: "destroy()",
                desc: "销毁组件，清空宿主容器",
                type: "() => void",
                default: "-",
              },
            ],
          },
        ],
      },
      {
        href: "/demo/text-layout",
        title: "Text Layout 排版",
        en: "Text Layout",
        desc: "精准文字排版引擎：截断 / 分栏 / 虚拟滚动。",
        keywords: ["排版", "text layout", "截断", "分栏", "虚拟滚动", "文字"],
        icon: ICON_TYPE,
        api: [
          {
            title: "核心引擎",
            props: [
              {
                name: "prepare(text, font?)",
                desc: "预处理文本：字素分割 + Canvas 宽度测量 + LRU 缓存，返回可复用的排版段",
                type: "(text, font?) => Segment[]",
                default: "font 16px system-ui",
              },
              {
                name: "layout(text, options, font?)",
                desc: "核心排版：按 maxWidth 换行（Unicode 感知断行），返回行 / 高度 / 截断信息",
                type: "(text, options, font?) => LayoutResult",
                default: "-",
              },
              {
                name: "layoutSegments(segments, options)",
                desc: "对已 prepare 的段排版，纯算术可每帧调用",
                type: "(segments, options) => LayoutResult",
                default: "-",
              },
              {
                name: "measure(text, maxWidth, lineHeight, font?)",
                desc: "快速计算行数与总高度",
                type: "(text, maxWidth, lineHeight, font?) => { lineCount, totalHeight }",
                default: "-",
              },
              {
                name: "measureWidth(text, font?)",
                desc: "获取文本宽度（带全局缓存）",
                type: "(text, font?) => number",
                default: "-",
              },
              {
                name: "clearCache()",
                desc: "清除全局宽度缓存（字体变更后调用）",
                type: "() => void",
                default: "-",
              },
            ],
          },
          {
            title: "布局工具",
            props: [
              {
                name: "layoutChips(items, maxWidth, font?, chipPaddingX?, lineHeight?)",
                desc: "芯片流 inline 排版：chip 作为不可断行原子元素与文本混合换行",
                type: "(items, maxWidth, ...) => ChipLayoutResult",
                default: "chipPaddingX 16 / lineHeight 24",
              },
              {
                name: "truncateToLines(text, maxWidth, maxLines, font?, ellipsis?)",
                desc: "多行截断：超出 maxLines 按字符截断并追加省略号",
                type: "(text, maxWidth, maxLines, font?, ellipsis?) => TruncateResult",
                default: "ellipsis …",
              },
              {
                name: "truncateToHeight(text, maxWidth, maxHeight, lineHeight, font?, ellipsis?)",
                desc: "截断到最大高度（由行高换算行数）",
                type: "(text, maxWidth, maxHeight, lineHeight, ...) => TruncateResult",
                default: "-",
              },
              {
                name: "computeVirtualHeights(items, containerWidth, lineHeight, font?, paddingVertical?, maxLines?)",
                desc: "虚拟滚动高度预计算：id → 高度映射 + 累计偏移 + 总高度",
                type: "(items, containerWidth, lineHeight, ...) => VirtualHeightResult",
                default: "-",
              },
              {
                name: "findVisibleRange(offsets, scrollTop, viewportHeight, overscan?)",
                desc: "按滚动偏移二分查找可见项范围（含 overscan）",
                type: "(offsets, scrollTop, viewportHeight, overscan?) => [number, number]",
                default: "overscan 3",
              },
              {
                name: "computeColumnWidths(rows, availableWidth, font?, minColumnWidth?, maxColumnWidth?)",
                desc: "表格列宽自动分配：按内容比例 + 最小 / 最大宽度约束",
                type: "(rows, availableWidth, font?, ...) => ColumnWidthResult",
                default: "min 60",
              },
              {
                name: "fitRowToColumns(row, columnWidths, font?)",
                desc: "将行数据按分配列宽逐格截断适配",
                type: "(row, columnWidths, font?) => string[]",
                default: "-",
              },
            ],
          },
          {
            title: "类型",
            props: [
              {
                name: "LayoutOptions",
                desc: "排版参数：maxWidth / lineHeight / maxLines / overflowWrap",
                type: "interface",
                default: "-",
              },
              {
                name: "LayoutResult",
                desc: "排版结果：lines / totalHeight / lineCount / truncated",
                type: "interface",
                default: "-",
              },
              {
                name: "ChipItem",
                desc: "芯片流元素：type(text|chip) / text / extraWidth（边框、内边距等额外宽度）",
                type: "interface",
                default: "-",
              },
              {
                name: "TruncateResult",
                desc: "截断结果：text / truncated / lineCount / fullLineCount",
                type: "interface",
                default: "-",
              },
              {
                name: "VirtualItem / VirtualHeightResult",
                desc: "虚拟滚动项与高度计算结果",
                type: "interface",
                default: "-",
              },
              {
                name: "ColumnWidthResult",
                desc: "列宽分配结果：widths / total / truncated",
                type: "interface",
                default: "-",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "data",
    title: "数据组件",
    icon: ICON_CALENDAR,
    pages: [
      {
        href: "/demo/calendar-popup",
        title: "Calendar 日历",
        en: "Calendar",
        desc: "弹出式日期选择：农历 / 节气 / 节日 / 黄历宜忌 / 休假表 / 禁用规则。",
        keywords: [
          "日历",
          "calendar",
          "农历",
          "节气",
          "节假日",
          "禁用规则",
          "date picker",
          "日期选择",
        ],
        icon: ICON_CALENDAR,
      },
      {
        href: "/demo/skeleton",
        title: "Skeleton 骨架屏",
        en: "Skeleton",
        desc: "自动 DOM 测量骨架屏：零布局重复，SSR 可选。",
        keywords: ["骨架屏", "skeleton", "加载", "loading", "SSR", "占位"],
        icon: ICON_TYPE,
        api: [
          {
            title: "配置项（AutoSkeletonOptions）",
            props: [
              { name: "loading", desc: "是否处于加载态", type: "boolean", default: "必填" },
              { name: "shimmerColor", desc: "流光颜色", type: "string", default: '"#f0f0f0"' },
              {
                name: "backgroundColor",
                desc: "骨架块背景色",
                type: "string",
                default: '"#e0e0e0"',
              },
              { name: "duration", desc: "流光动画时长 (ms)", type: "number", default: "1500" },
              {
                name: "timingFunction",
                desc: "动画时序函数（CSS animation-timing-function），如 linear / ease-out / cubic-bezier",
                type: "string",
                default: '"ease-in-out"',
              },
              {
                name: "staggerDelay",
                desc: "错峰步进 (ms)：动画块按文档序递增负 delay 形成级联流水感；0 关闭错峰",
                type: "number",
                default: "80",
              },
              {
                name: "zIndex",
                desc: "覆盖层 z-index（portal 挂载于 body）；页面 sticky 头部需显示在骨架之上时调低",
                type: "number",
                default: "9999",
              },
              {
                name: "fallbackBorderRadius",
                desc: "默认圆角 (px)，用于 borderRadius 为 0 的元素",
                type: "number",
                default: "-",
              },
              {
                name: "reducedMotion",
                desc: "禁用动画（不传时自动检测 prefers-reduced-motion）",
                type: "boolean",
                default: "auto",
              },
              {
                name: "maxElements",
                desc: "骨架最大元素数量（性能保护）",
                type: "number",
                default: "500",
              },
            ],
          },
          {
            title: "静态骨架（RenderSkeletonSnapshotOptions）",
            props: [
              { name: "width", desc: "容器宽度 (px)", type: "number", default: "必填" },
              {
                name: "height",
                desc: "容器高度 (px)，未提供时按块几何自动计算",
                type: "number",
                default: "-",
              },
              {
                name: "shimmerColor",
                desc: "流光颜色（与 AutoSkeleton 同名配置一致）",
                type: "string",
                default: '"#f0f0f0"',
              },
              {
                name: "backgroundColor",
                desc: "骨架块背景色（与 AutoSkeleton 同名配置一致）",
                type: "string",
                default: '"#e0e0e0"',
              },
              {
                name: "duration",
                desc: "流光动画时长 (ms，与 AutoSkeleton 同名配置一致)",
                type: "number",
                default: "1500",
              },
              {
                name: "timingFunction",
                desc: "动画时序函数（与 AutoSkeleton 同名配置一致）",
                type: "string",
                default: '"ease-in-out"',
              },
              {
                name: "staggerDelay",
                desc: "错峰步进 (ms，与 AutoSkeleton 同名配置一致)",
                type: "number",
                default: "80",
              },
              {
                name: "reducedMotion",
                desc: "禁用动画（与 AutoSkeleton 同名配置一致）",
                type: "boolean",
                default: "auto",
              },
              {
                name: "maxBlocks",
                desc: "最大骨架块数（性能保护，超出截断）",
                type: "number",
                default: "200",
              },
            ],
          },
          {
            title: "函数与实例方法",
            props: [
              {
                name: "new AutoSkeleton(el, options)",
                desc: "构造：原地测量 DOM 生成骨架覆盖层",
                type: "(el: HTMLElement, options) => AutoSkeleton",
                default: "-",
              },
              {
                name: "sk.update({ loading })",
                desc: "切换加载态（数据就绪后移除骨架）",
                type: "(opts: Partial<AutoSkeletonOptions>) => void",
                default: "-",
              },
              {
                name: "sk.overlay",
                desc: "骨架覆盖层 DOM（可手动加 .is-exiting 触发退出动画）",
                type: "HTMLElement",
                default: "-",
              },
              {
                name: "sk.destroy()",
                desc: "销毁实例，移除覆盖层与监听器",
                type: "() => void",
                default: "-",
              },
              {
                name: "extractElementInfo(root)",
                desc: "测量 DOM 结构，返回骨架块快照（SSR 管线第一步）",
                type: "(root: HTMLElement) => SkeletonElement[]",
                default: "-",
              },
              {
                name: "renderSkeletonSnapshot(snapshot, options)",
                desc: "将测量快照渲染为纯 CSS 静态骨架 HTML（SSR 管线第二步）",
                type: "(snapshot, options) => string",
                default: "-",
              },
              {
                name: "isLeafElement / structureSignature",
                desc: "叶子元素判定 / DOM 结构签名（测试与比对用）",
                type: "(el) => boolean / (el) => string",
                default: "-",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "form",
    title: "表单组件",
    icon: ICON_SEARCH,
    pages: [
      {
        href: "/demo/search",
        title: "Search 搜索",
        en: "Search",
        desc: "打字机轮播占位 + 类别筛选 + 全键盘导航的模态搜索框。",
        keywords: ["搜索", "search", "打字机", "筛选", "键盘", "Cmd+K"],
        icon: ICON_SEARCH,
      },
      {
        href: "/demo/select",
        title: "Select 下拉选择",
        en: "Select",
        desc: "手风琴错峰动画下拉选择器：单选、选项禁用、向上/向下自适应翻转、受控/非受控双模式。",
        keywords: [
          "下拉",
          "select",
          "dropdown",
          "手风琴",
          "错峰",
          "combobox",
          "listbox",
          "选项禁用",
          "单选",
          "占位",
          "翻转",
        ],
        icon: ICON_LIST,
        api: [
          {
            title: "配置项",
            props: [
              {
                name: "options",
                desc: "选项列表（value/label 必填；disabled 禁用、hint 副文本、glyph 图标字符）",
                type: "SelectOption[]",
                default: "[]",
              },
              {
                name: "value",
                desc: "受控值（传入后进入受控模式：用户选择仅回调 onChange，显示值由 update({ value }) 同步）",
                type: "string | null",
                default: "-",
              },
              {
                name: "defaultValue",
                desc: "非受控初始值",
                type: "string | null",
                default: "null",
              },
              { name: "placeholder", desc: "未选中时占位文本", type: "string", default: '""' },
              { name: "disabled", desc: "整体禁用", type: "boolean", default: "false" },
              {
                name: "open",
                desc: "受控展开状态（外部经 update({ open }) 驱动）",
                type: "boolean",
                default: "false",
              },
              {
                name: "defaultOpen",
                desc: "非受控初始展开",
                type: "boolean",
                default: "false",
              },
              {
                name: "className",
                desc: "附加到根容器的自定义类名",
                type: "string",
                default: '""',
              },
              {
                name: "width",
                desc: "面板宽度：trigger 跟随触发器 / auto 内容自适应（min-width 至少等于触发器）",
                type: '"trigger" | "auto"',
                default: '"trigger"',
              },
              {
                name: "duration",
                desc: "单个选项错峰动画时长 (ms)",
                type: "number",
                default: "380",
              },
              {
                name: "stagger",
                desc: "选项错峰间隔 (ms)，越大琴键越疏",
                type: "number",
                default: "28",
              },
              {
                name: "animate",
                desc: "手风琴错峰动画开关（自动尊重 prefers-reduced-motion）",
                type: "boolean",
                default: "true",
              },
              {
                name: "maxStagger",
                desc: "错峰动画最大选项数：超过即降级为面板整体淡入，0 表示不降级",
                type: "number",
                default: "12",
              },
              {
                name: "ariaLabel",
                desc: "触发器无障碍标签（缺省取 placeholder）",
                type: "string",
                default: "placeholder",
              },
            ],
          },
          {
            title: "事件",
            props: [
              {
                name: "onOpenChange",
                desc: "展开状态变化回调",
                type: "(open: boolean) => void",
                default: "-",
              },
              {
                name: "onChange",
                desc: "选中值变化回调（取消为 null）",
                type: "(value: string | null, option: SelectOption | null) => void",
                default: "-",
              },
            ],
          },
          {
            title: "实例方法",
            props: [
              {
                name: "open() / close() / toggle()",
                desc: "展开 / 关闭 / 切换",
                type: "() => void",
                default: "-",
              },
              {
                name: "update(patch)",
                desc: "外部同步值 / 选项 / 禁用 / 占位 / 展开（value 同步显示但不触发 onChange）",
                type: "(patch: Partial<SelectOptions>) => void",
                default: "-",
              },
              {
                name: "setValue(value)",
                desc: "程序化选中（等价 update({ value })）",
                type: "(value: string | null) => void",
                default: "-",
              },
              {
                name: "setDisabled(v)",
                desc: "动态切换整体禁用",
                type: "(v: boolean) => void",
                default: "-",
              },
              {
                name: "destroy()",
                desc: "销毁组件，清空宿主容器并移除 body 上的面板",
                type: "() => void",
                default: "-",
              },
            ],
          },
          {
            title: "实例属性",
            props: [
              {
                name: "value",
                desc: "当前选中值（无选中为 null）",
                type: "string | null",
                default: "-",
              },
              {
                name: "expanded",
                desc: "是否展开",
                type: "boolean",
                default: "-",
              },
            ],
          },
        ],
      },
      {
        href: "/demo/action-menu",
        title: "ActionMenu 扇形动作菜单",
        en: "Action Menu",
        desc: "悬浮展开的扇形快捷菜单：两段式披露（打开仅图标，hover 扇区伸出该扇区切向 label）、hover 不收起、点击扇区触发动作、FAB 与外部 trigger 双模式、全键盘导航。",
        keywords: [
          "动作菜单",
          "action-menu",
          "radial-menu",
          "扇形",
          "悬浮球",
          "FAB",
          "快捷操作",
          "切向",
          "键盘",
        ],
        icon: ICON_EDIT,
        api: [
          {
            title: "配置项",
            props: [
              {
                name: "items",
                desc: "菜单项（id/icon/label 必填；onClick 点击动作、disabled 禁用）",
                type: "ActionMenuItem[]",
                default: "[]",
              },
              {
                name: "direction",
                desc: "展开方向：left | right",
                type: '"left" | "right"',
                default: '"right"',
              },
              {
                name: "spread",
                desc: "扇形张角（度），扇区均分",
                type: "number",
                default: "180",
              },
              {
                name: "radius",
                desc: "扇区图标圆心到触发中心的距离 px",
                type: "number",
                default: "56",
              },
              {
                name: "position",
                desc: "内置 FAB 悬浮位置（仅 trigger 缺省时生效）",
                type: "ActionMenuPosition",
                default: "{ right: 24, bottom: 24 }",
              },
              {
                name: "trigger",
                desc: "外部触发元素：传入后菜单锚定其中心展开；缺省则生成 FAB 悬浮球",
                type: "HTMLElement | null",
                default: "null",
              },
              {
                name: "closeRadius",
                desc: "悬浮保持半径 px：指针离开该区域即收起（默认覆盖展开后的 label）",
                type: "number",
                default: "radius + 130",
              },
              {
                name: "ariaLabel",
                desc: "无障碍标签（trigger aria-label）",
                type: "string",
                default: '"快捷操作"',
              },
              {
                name: "animate",
                desc: "是否启用动画（自动尊重 prefers-reduced-motion）",
                type: "boolean",
                default: "true",
              },
              {
                name: "onAction",
                desc: "任意菜单项触发时的回调（在 item.onClick 之前调用）",
                type: "(item, index) => void",
                default: "-",
              },
              {
                name: "onOpenChange",
                desc: "展开状态变化回调",
                type: "(open: boolean) => void",
                default: "-",
              },
            ],
          },
          {
            title: "实例方法 / 属性",
            props: [
              {
                name: "new ActionMenu(root, options)",
                desc: "构造：root 为宿主容器，options 见配置项",
                type: "(el: HTMLElement, options) => ActionMenu",
                default: "-",
              },
              {
                name: "menu.open() / close() / toggle()",
                desc: "程序化展开 / 收起 / 切换",
                type: "() => void",
                default: "-",
              },
              {
                name: "menu.update(patch)",
                desc: "更新配置：换 items / direction / spread / radius / closeRadius / ariaLabel",
                type: "(patch: Partial<ActionMenuOptions>) => void",
                default: "-",
              },
              {
                name: "menu.expanded",
                desc: "是否展开",
                type: "boolean",
                default: "-",
              },
              {
                name: "menu.destroy()",
                desc: "销毁组件，移除监听与 body 上的面板",
                type: "() => void",
                default: "-",
              },
            ],
          },
        ],
      },
      {
        href: "/demo/upload",
        title: "Upload 上传",
        en: "Upload",
        desc: "拖拽 / 按钮触发，WebP / AVIF 客户端压缩，内置 XHR 字节级真实上传进度。",
        keywords: ["上传", "upload", "拖拽", "压缩", "webp", "avif", "图片", "onProgress", "进度"],
        icon: ICON_UPLOAD,
        api: [
          {
            title: "配置项",
            props: [
              {
                name: "trigger",
                desc: "触发形态：大拖拽区或小按钮（复用 @apricotdream/button 样式）",
                type: "dropzone | button",
                default: "dropzone",
              },
              { name: "accept", desc: "接受的类型", type: "string[]", default: '["image/*"]' },
              {
                name: "supportedFormats",
                desc: "图片格式白名单（无点扩展名，如 jpg/png/webp/gif/avif）；指定后映射为 input accept 并驱动提示文案",
                type: "string[]",
                default: "全支持",
              },
              { name: "multiple", desc: "是否允许多选 / 多拖", type: "boolean", default: "true" },
              {
                name: "maxCount",
                desc: "最多保留的上传项总数，0 表示不限",
                type: "number",
                default: "0",
              },
              { name: "maxSizeMB", desc: "单文件大小上限（MB）", type: "number", default: "10" },
              {
                name: "url",
                desc: "内置 XHR 上传地址（与 uploadFn 二选一；均不传则仅压缩不上传）",
                type: "string",
                default: "-",
              },
              { name: "fieldName", desc: "FormData 字段名", type: "string", default: '"file"' },
              {
                name: "headers",
                desc: "自定义请求头",
                type: "Record<string, string>",
                default: "-",
              },
              {
                name: "uploadFn",
                desc: "自定义上传函数，onProgress 由宿主驱动进度条",
                type: "UploadFn",
                default: "-",
              },
              {
                name: "urlImport",
                desc: "URL 导入入口开关（仅 dropzone 形态）",
                type: "boolean",
                default: "true",
              },
              {
                name: "initialUrls",
                desc: "编辑态回显：已存在的资源 URL 列表，渲染为成功项（缩略图 + 已上传 + 删除）",
                type: "string[]",
                default: "-",
              },
              {
                name: "persist",
                desc: "持久化策略：未完成的上传项（File + 元数据）存 IndexedDB，刷新后恢复列表并自动重传；成功项不持久化（URL 由宿主经 initialUrls 回显）",
                type: '"session" | "local" | "off"',
                default: '"off"',
              },
              {
                name: "previewFit",
                desc: "单文件模式容器大图适配：cover 铺满裁切 / contain 等比例缩小完整显示 / auto 按比例自适应（与容器比例接近铺满，差异大完整显示避免裁切主体）",
                type: '"cover" | "contain" | "auto"',
                default: '"cover"',
              },
              {
                name: "urlImportTimeout",
                desc: "URL 导入单次请求超时（ms）",
                type: "number",
                default: "10000",
              },
              {
                name: "compress",
                desc: "压缩总开关；关闭时仅按原图上传",
                type: "boolean",
                default: "true",
              },
              {
                name: "formats",
                desc: "输出格式（三选一 / 都要）",
                type: "OutputFormat[]",
                default: '["original","webp","avif"]',
              },
              { name: "quality", desc: "压缩质量", type: "number", default: "0.8" },
              { name: "maxWidth", desc: "缩放上限宽度", type: "number", default: "2048" },
              { name: "maxHeight", desc: "缩放上限高度", type: "number", default: "2048" },
            ],
          },
          {
            title: "事件",
            props: [
              {
                name: "onStart",
                desc: "上传项开始上传时触发",
                type: "(item: UploadItem) => void",
                default: "-",
              },
              {
                name: "onProgress",
                desc: "上传进度回调：内置 XHR 为字节级真实进度；uploadFn 模式下由宿主调用 onProgress 驱动",
                type: "(item: UploadItem) => void",
                default: "-",
              },
              {
                name: "onSuccess",
                desc: "上传成功时触发",
                type: "(item: UploadItem) => void",
                default: "-",
              },
              {
                name: "onError",
                desc: "上传失败时触发",
                type: "(item: UploadItem, error: Error) => void",
                default: "-",
              },
              {
                name: "onChange",
                desc: "列表增删时触发；细粒度状态变化请用 onStart / onProgress / onSuccess / onError",
                type: "(items: UploadItem[]) => void",
                default: "-",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "feedback",
    title: "反馈组件",
    icon: ICON_INFO,
    pages: [
      {
        href: "/demo/toast",
        title: "Toast 轻提示",
        en: "Toast",
        desc: "ARIA live region 内建 · 6 种定位 · Promise 链 · 队列管理。",
        keywords: ["toast", "轻提示", "提示", "通知", "定位", "队列"],
        icon: ICON_INFO,
      },
      {
        href: "/demo/notifications",
        title: "Notifications 通知铃铛",
        en: "Notifications",
        desc: "铃铛触发器 + 未读红点 + 手风琴错峰下拉面板，全键盘导航。",
        keywords: [
          "通知",
          "铃铛",
          "notifications",
          "bell",
          "未读",
          "badge",
          "红点",
          "下拉",
          "错峰",
          "消息中心",
          "键盘",
        ],
        icon: ICON_BELL,
        api: [
          {
            title: "配置项",
            props: [
              {
                name: "items",
                desc: "通知条目列表（id/title 必填；sub 摘要、glyph 左侧字符、unread 未读圆点、其余字段透传）",
                type: "NotificationItem[]",
                default: "[]",
              },
              {
                name: "unreadCount",
                desc: "未读数：> 0 时触发器右上角显示红点徽标",
                type: "number",
                default: "0",
              },
              { name: "emptyText", desc: "空列表文案", type: "string", default: '"暂无消息"' },
              {
                name: "triggerContent",
                desc: "触发器内容：默认内置铃铛图标；传 HTML 字符串或节点可完全自定义",
                type: "string | HTMLElement",
                default: "内置铃铛",
              },
              {
                name: "ariaLabel",
                desc: "触发器无障碍标签",
                type: "string",
                default: '"消息"',
              },
              { name: "className", desc: "附加到根容器的自定义类名", type: "string", default: '""' },
              {
                name: "width",
                desc: "面板宽度：trigger 跟随触发器 / auto 内容自适应（min-width 至少等于触发器）",
                type: '"trigger" | "auto"',
                default: '"auto"',
              },
              {
                name: "duration",
                desc: "单个条目错峰动画时长 (ms)",
                type: "number",
                default: "380",
              },
              {
                name: "stagger",
                desc: "条目错峰间隔 (ms)，越大琴键越疏",
                type: "number",
                default: "28",
              },
              {
                name: "animate",
                desc: "是否启用手风琴错峰动画（自动尊重 prefers-reduced-motion）",
                type: "boolean",
                default: "true",
              },
              {
                name: "maxStagger",
                desc: "错峰动画最大条目数：超过即降级为面板整体淡入，0 表示不降级",
                type: "number",
                default: "12",
              },
              {
                name: "open",
                desc: "受控展开状态（外部经 update({ open }) 驱动）",
                type: "boolean",
                default: "false",
              },
              {
                name: "defaultOpen",
                desc: "非受控初始展开",
                type: "boolean",
                default: "false",
              },
              {
                name: "renderItem",
                desc: "自定义条目渲染（返回节点；缺省渲染 title/sub/glyph/unread）",
                type: "(item) => HTMLElement",
                default: "-",
              },
            ],
          },
          {
            title: "事件",
            props: [
              {
                name: "onItemClick",
                desc: "点击条目回调（组件自动收起面板）",
                type: "(item: NotificationItem) => void",
                default: "-",
              },
              {
                name: "onOpenChange",
                desc: "展开状态变化回调（宿主可在打开时标记全部已读）",
                type: "(open: boolean) => void",
                default: "-",
              },
            ],
          },
          {
            title: "实例方法 / 属性",
            props: [
              {
                name: "new Notifications(root, options)",
                desc: "构造：root 为宿主容器，options 见配置项",
                type: "(el: HTMLElement, options) => Notifications",
                default: "-",
              },
              {
                name: "ntf.open() / close() / toggle()",
                desc: "程序化展开 / 收起 / 切换",
                type: "() => void",
                default: "-",
              },
              {
                name: "ntf.update(patch)",
                desc: "外部同步：换 items / unreadCount / emptyText / ariaLabel / 受控展开",
                type: "(patch: Partial<NotificationsOptions>) => void",
                default: "-",
              },
              {
                name: "ntf.expanded",
                desc: "是否展开",
                type: "boolean",
                default: "-",
              },
              {
                name: "ntf.destroy()",
                desc: "销毁组件，移除 body 上的面板与监听",
                type: "() => void",
                default: "-",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "business",
    title: "业务组件",
    icon: ICON_FILE,
    pages: [
      {
        href: "/demo/editor",
        title: "AI Editor 编辑器",
        en: "AI Editor",
        desc: "AI 辅助 Markdown / WYSIWYG 编辑器。",
        keywords: ["编辑器", "editor", "ai editor", "markdown", "wysiwyg", "AI"],
        icon: ICON_EDIT,
      },
    ],
  },
];

/* ---- 更新日志（头部导航） ---- */
export const CHANGELOG_PAGE: DocPage = {
  href: "/demo/changelog",
  title: "更新日志",
  en: "Changelog",
  desc: "青梧 UI 的版本历史与更新内容。",
  keywords: ["更新日志", "changelog", "版本", "release", "0.4.0"],
  icon: ICON_FILE,
};

/* ---- 头部中心导航 ---- */
export const HEADER_NAV: { label: string; href: string; match: (pathname: string) => boolean }[] = [
  { label: "指南", href: "/guide/install", match: (p) => p.startsWith("/guide") },
  {
    label: "组件",
    href: "/demo/button",
    match: (p) => p.startsWith("/demo") && !p.startsWith("/demo/changelog"),
  },
  { label: "更新日志", href: "/demo/changelog", match: (p) => p === "/demo/changelog" },
];

/* ---- 全站页面顺序（prev / next 依据） ---- */
export const DOC_FLOW: DocPage[] = [
  ...GUIDE_SECTION.pages,
  ...COMPONENT_SECTIONS.flatMap((s) => s.pages),
  CHANGELOG_PAGE,
];

/* ---- 搜索索引（title 为 SearchBox 主匹配字段，sub 承载全文内容） ---- */
export const SEARCH_ITEMS = DOC_FLOW.map((page) => {
  const kind = page.href.startsWith("/guide")
    ? "指南"
    : page.href === CHANGELOG_PAGE.href
      ? "更新日志"
      : "组件";
  return {
    title: page.title,
    sub: [page.desc, ...page.keywords].join(" · "),
    kind,
    glyph: page.title.slice(0, 1),
  };
});

export const HREF_BY_TITLE = new Map(DOC_FLOW.map((p) => [p.title, p.href]));

/* ---- 查找工具 ---- */
export function findPage(href: string): DocPage | undefined {
  return DOC_FLOW.find((p) => p.href === href);
}

export function findPrevNext(href: string): { prev?: DocPage; next?: DocPage } {
  const i = DOC_FLOW.findIndex((p) => p.href === href);
  if (i < 0) return {};
  return { prev: DOC_FLOW[i - 1], next: DOC_FLOW[i + 1] };
}
