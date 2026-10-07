/** 青梧UI · 标签快捷插入组件类型定义（framework-agnostic type contracts） */

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

  /** 标签插入格式器（默认原样插入；标签间默认 ", " 分隔，自定义时需同步自定义 parseTags） */
  formatInsert?: (tag: string) => string;
  /** 从输入值解析已存在标签（驱动快捷栏显隐），默认逗号分割并 trim；仅 bar 模式生效 */
  parseTags?: (value: string) => string[];

  /** 标签栏最大行数，超出折叠为 "+N 更多"，0 表示不折叠，默认 2 */
  maxRows?: number;
  /** 折叠时 "+N 更多" 按钮文案，默认 `+N 更多` */
  moreLabel?: (count: number) => string;
  /** 展开时收起按钮文案，默认 "收起" */
  collapseLabel?: string;

  /** Enter 将输入文本作为新标签加入快捷栏（已存在忽略）并清空输入；inline 模式始终生效 */
  allowEnterCreate?: boolean;

  /** chip-in-input：已选标签以 chip 渲染在输入框内，× 删除即移除；inline 下 value 字符串不生效，已选以 selected 数组为准 */
  inline?: boolean;

  /** inline 专属：已选标签数组（受控）；提交/删除/点建议仅回调 onSelectedChange，调用方以 update({ selected }) 回灌 */
  selected?: string[];
  /** inline 模式专属：非受控初始已选标签数组 */
  defaultSelected?: string[];
  /** inline 模式专属：已选标签数组变化回调（提交 / × 删除 / 点建议时触发） */
  onSelectedChange?: (selected: string[]) => void;

  /** 标签数量上限，0 不限，默认 0；超出后插入 / 回车创建被忽略 */
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
  /** CSS font 字符串供测量（如 "14px system-ui"）；不传则读取容器 computed style */
  font?: string;
}

/** 标签栏可见项（chip 或 折叠/展开切换按钮） */
export interface TagBarItem {
  /** 标签文本 */
  tag: string;
  /** 是否在输入值中已存在（此时不显示） */
  active: boolean;
}
