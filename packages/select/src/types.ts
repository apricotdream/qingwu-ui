/** 青梧UI 下拉选择器类型定义（framework-agnostic type contracts） */

/** 单个下拉选项 */
export interface SelectOption {
  /** 唯一值（必填，选中后作为 value 返回） */
  value: string;
  /** 显示文本（必填） */
  label: string;
  /** 禁用：置灰、不可选中、键盘导航跳过 */
  disabled?: boolean;
  /** 辅助说明（可选，渲染在 label 下方小字） */
  hint?: string;
  /** 左侧图标字符，默认取 label 首字 */
  glyph?: string;
}

/** 下拉选择器构造配置 */
export interface SelectOptions {
  /** 选项列表 */
  options?: SelectOption[];
  /** 受控值（传入后进入受控模式：用户选择仅回调 onChange，显示值由外部经 update({ value }) 同步） */
  value?: string | null;
  /** 非受控初始值 */
  defaultValue?: string | null;
  /** 未选中时的占位文本 */
  placeholder?: string;
  /** 整体禁用 */
  disabled?: boolean;
  /** 受控展开 */
  open?: boolean;
  /** 非受控初始展开 */
  defaultOpen?: boolean;
  /** 附加到根容器的自定义类名 */
  className?: string;
  /** 面板宽度：trigger 跟随触发器宽度 / auto 内容自适应（min-width 至少等于触发器） */
  width?: "trigger" | "auto";
  /** 单个选项错峰动画时长 ms，默认 380 */
  duration?: number;
  /** 选项错峰间隔 ms，默认 28 */
  stagger?: number;
  /** 是否启用手风琴错峰动画，默认 true（自动尊重 prefers-reduced-motion） */
  animate?: boolean;
  /** 错峰动画最大选项数：超过即降级为面板整体淡入（性能/体验保护），0 表示不降级，默认 12 */
  maxStagger?: number;
  /** 面板半透明磨砂质感：半透明底 + backdrop-filter 毛玻璃；false 为不透明实体面板，默认 true */
  frosted?: boolean;
  /** 无障碍标签（trigger aria-label），缺省取 placeholder */
  ariaLabel?: string;
  /** 展开状态变化回调 */
  onOpenChange?: (open: boolean) => void;
  /** 选中值变化回调（取消为 null） */
  onChange?: (value: string | null, option: SelectOption | null) => void;
}
