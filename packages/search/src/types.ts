/* ============================================================
   青梧UI · 搜索框组件类型定义
   Qingwu Search — framework-agnostic type contracts
   ============================================================ */

/** 单个可搜索条目 */
export interface SearchItem {
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

/** 搜索框组件构造配置 */
export interface SearchOptions {
  /** 占位提示轮播词列表（为空数组时无轮播仅静态） */
  placeholders?: string[];
  /** 可搜索条目集 */
  items?: SearchItem[];
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
