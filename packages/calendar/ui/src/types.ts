/**
 * 日历组件类型定义
 */

import type { DayMetaProvider, PanelProvider } from "./providers";

/** 节假日配置 */
export interface HolidayConfig {
  /** 放假日期列表（"YYYY-MM-DD"） */
  holidays?: string[];
  /** 调休上班日期列表（"YYYY-MM-DD"，周末需要上班的日子） */
  workdays?: string[];
}

/** 展示形态：modal（默认，全屏居中弹窗）/ popover（紧凑浮层，锚定输入框下方） */
export type CalendarMode = "modal" | "popover";

/** 日历组件选项 */
export interface CalendarUiOptions {
  /** 展示形态：modal（默认，全屏居中弹窗）/ popover（紧凑浮层，锚定输入框下方） */
  mode?: CalendarMode;
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
  /** 自定义日期格 meta Provider（追加在内置 provider 之后） */
  dayMetaProviders?: DayMetaProvider[];
  /** 自定义详情面板内容块 Provider（追加在内置 provider 之后） */
  panelProviders?: PanelProvider[];
}
