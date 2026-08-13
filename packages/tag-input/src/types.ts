/* ============================================================
   青梧UI · 标签快捷插入组件类型定义
   Qingwu TagInput — framework-agnostic type contracts
   ============================================================ */

/** TagInput 构造配置 */
export interface TagInputOptions {
  /** 受控输入值（传入后组件进入受控模式，输入变化仅回调不内部改值） */
  value?: string;
  /** 非受控初始输入值 */
  defaultValue?: string;
  /** 输入值变化回调（用户输入 / 点击标签插入 / 程序化 insertTag） */
  onChange?: (value: string) => void;

  /** 受控可用标签列表（传入后组件进入受控模式，删除仅回调不内部改值） */
  tags?: string[];
  /** 非受控初始可用标签列表 */
  defaultTags?: string[];
  /** 可用标签列表变化回调（用户点击 × 删除时触发） */
  onTagsChange?: (tags: string[]) => void;

  /**
   * 标签插入格式器：点击标签后以何种文本拼入输入框，默认原样插入；
   * 标签之间默认以 ", " 分隔，自定义格式时通常需要同步自定义 parseTags
   * 例：`(tag) => "#" + tag` 得到 "#React, #TypeScript"
   */
  formatInsert?: (tag: string) => string;
  /**
   * 从输入值解析已存在标签（驱动快捷栏显隐：已存在的标签按钮消失），
   * 默认按逗号分割并 trim 去空。
   * 仅 bar 模式生效；inline 模式已选为精确数组，不经此解析
   */
  parseTags?: (value: string) => string[];

  /** 标签栏最大行数，超出折叠为 "+N 更多"，0 表示不折叠，默认 2 */
  maxRows?: number;
  /** 折叠时 "+N 更多" 按钮文案，默认 `+N 更多` */
  moreLabel?: (count: number) => string;
  /** 展开时收起按钮文案，默认 "收起" */
  collapseLabel?: string;

  /**
   * 输入框按 Enter 时，将当前输入文本作为新标签加入快捷栏
   * （已存在的标签忽略），并清空输入框；默认 false。
   * inline 模式下不依赖此开关：Enter 始终将输入文本加入已选标签
   */
  allowEnterCreate?: boolean;

  /**
   * chip-in-input 模式：已选标签以 chip 渲染在输入框内部，× 删除即
   * 从已选数组移除；下方标签栏仍显示可用标签（建议），点击插入。
   * 默认 false（标签栏在输入框下方）。
   * inline 模式下 value / defaultValue 字符串不生效，已选以
   * selected / defaultSelected 数组为准，input 文本仅承载草稿。
   */
  inline?: boolean;

  /**
   * inline 模式专属：已选标签数组（一等公民，受控）。
   * 传入后组件进入受控模式，提交 / × 删除 / 点建议仅回调
   * onSelectedChange，由调用方同步后以 update({ selected }) 回灌。
   * 草稿经 Enter / 逗号 / 失焦 / 点建议提交进已选。
   */
  selected?: string[];
  /** inline 模式专属：非受控初始已选标签数组 */
  defaultSelected?: string[];
  /** inline 模式专属：已选标签数组变化回调（提交 / × 删除 / 点建议时触发） */
  onSelectedChange?: (selected: string[]) => void;

  /**
   * 标签数量上限（输入值中的标签数），0 表示不限，默认 0；
   * 超出后插入 / 回车创建被忽略
   */
  maxTags?: number;

  /** 输入框占位符 */
  placeholder?: string;
  /** 禁用（输入框与标签按钮均不可交互） */
  disabled?: boolean;
  /** 只读（输入框只读，标签按钮禁用但可见） */
  readOnly?: boolean;
  /** 标签 chip 是否带 × 移除按钮，默认 true */
  removable?: boolean;
  /** 自定义类名（追加到根容器） */
  className?: string;
  /**
   * CSS font 字符串，供 @qingwu-ui/text-layout 测量（如 "14px system-ui"）；
   * 不传则读取容器 computed style（字体加载完成后自动重排）
   */
  font?: string;
}

/** 标签栏可见项（chip 或 折叠/展开切换按钮） */
export interface TagBarItem {
  /** 标签文本 */
  tag: string;
  /** 是否在输入值中已存在（此时不显示） */
  active: boolean;
}
