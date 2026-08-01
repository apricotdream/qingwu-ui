/**
 * 日历组件类型定义
 */

/** 节假日配置 */
export interface HolidayConfig {
  /** 放假日期列表（"YYYY-MM-DD"） */
  holidays?: string[];
  /** 调休上班日期列表（"YYYY-MM-DD"，周末需要上班的日子） */
  workdays?: string[];
}

/** 日历组件选项 */
export interface CalendarUiOptions {
  /** 初始选中日期 */
  selected?: Date | string;
  /** 最小可选日期 */
  min?: Date | string;
  /** 最大可选日期 */
  max?: Date | string;
  /** 占位文本 */
  placeholder?: string;
  /** 输入框名称 */
  inputName?: string;
  /** 日期变更回调 */
  onChange?: (date: string) => void;
  /** 日历面板打开/关闭回调 */
  onOpenChange?: (open: boolean) => void;
  /** 是否开启日历详情面板（右侧农历/节气/节日/黄历信息；默认 true） */
  showDetailPanel?: boolean;
  /** 节假日配置（放假日期 + 调休上班日期；默认无） */
  holidays?: HolidayConfig;
}
