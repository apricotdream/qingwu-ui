/* ============================================================
   青梧UI · 搜索框组件类型定义
   Qingwu Search — framework-agnostic type contracts
   ============================================================ */

/** 单个可搜索条目 */
export interface SearchItem {
  /** 业务主键（可选，透传给 onSelect 供宿主跳转/操作，不参与匹配与渲染） */
  id?: string;
  /** 主标题（必填，用于全文匹配与渲染） */
  title: string;
  /** 副标题（可选，补充描述信息，参与搜索匹配） */
  sub?: string;
  /** 类别标签（节日 / 节气 / 功能 / 日期 / 农历 / 干支 等） */
  kind?: string;
  /** 左侧图标字符，默认取 title 首字 */
  glyph?: string;
}

/** 筛选类别配置 */
export interface SearchCategory {
  /** 类别标签文本 */
  label: string;
  /** 标记为「全部」类别（切换逻辑特殊处理） */
  all?: boolean;
}

/**
 * 异步搜索函数（服务端模式）。
 * 由宿主实现（如请求后端接口），返回匹配条目；组件内部负责防抖、
 * 竞态取消与 loading / 错误态渲染。signal 由组件创建：每次发起新请求
 * 前会 abort 上一次请求，宿主应监听 signal 并丢弃过期响应。
 */
export type SearchFn = (query: string, signal: AbortSignal) => Promise<SearchItem[]>;

/** 搜索框组件构造配置 */
export interface SearchOptions {
  /** 占位提示轮播词列表（为空数组时无轮播仅静态） */
  placeholders?: string[];
  /** 可搜索条目集（本地模式；与 search 同时提供时 search 优先） */
  items?: SearchItem[];
  /** 异步搜索函数（服务端模式）。提供时输入查询走防抖 + 该函数，结果直接
      渲染、不再做本地 title/sub 匹配；类别筛选仍作用于返回结果 */
  search?: SearchFn;
  /** 异步搜索防抖间隔 ms，默认 200 */
  debounceMs?: number;
  /** 触发异步搜索的最小查询长度（trim 后），默认 1 */
  minQuery?: number;
  /** 加载态精灵图 URL（横向帧铺开的 sprite 图，如博客列表页同款）。
      提供时请求在途显示精灵条 steps 帧动画；缺省降级为纯文案 */
  loadingSpriteUrl?: string;
  /** 精灵图横向帧数（默认 5），与 CSS 的 steps()/精灵条宽度一致 */
  loadingSpriteFrames?: number;
  /** 筛选类别列表（首项建议为「全部」），默认 ["全部","节日","节气","功能","日期"] */
  categories?: string[];
  /** 用户选中某条目时回调 */
  onSelect?: (item: SearchItem) => void;
  /** 输入框查询文本变化时回调（可用于异步搜索） */
  onQueryChange?: (query: string) => void;
  /** 是否启用打字机循环轮播动画，默认 true */
  typewriter?: boolean;
  /** 是否渲染内置触发条，默认 true；设为 false 时由宿主自定义入口（需自行调用 open()，
      全局快捷键 ⌘K 与 / 仍生效），避免用 CSS 隐藏 .qs-trigger 的 hack */
  trigger?: boolean;
}

/** 打字机引擎配置 */
export interface TypewriterOptions {
  /** 是否减弱动效（通常由 prefers-reduced-motion 派生） */
  reduced?: boolean;
  /** 逐字打入间隔 ms，默认 80 */
  typeMs?: number;
  /** 逐字删除间隔 ms，默认 38 */
  delMs?: number;
  /** 全文停顿 ms，默认 1500 */
  holdFull?: number;
  /** 空文停顿 ms，默认 320 */
  holdEmpty?: number;
}
