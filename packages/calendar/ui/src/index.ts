import { holidayData } from "@qingwu-ui/holiday-data";
import { Calendar as CoreCalendar } from "./calendar";
import { mergeHolidayData } from "./holiday-data";
import type { CalendarUiOptions } from "./types";

export * from "./core";
export { holidayData };

/** 默认入口读取可选数据包；未安装该包的应用应使用独立的 /core 入口。 */
export class Calendar extends CoreCalendar {
  constructor(root: HTMLElement, opts: CalendarUiOptions = {}) {
    const data =
      opts.holidayData === false
        ? false
        : opts.holidayData
          ? mergeHolidayData(holidayData, opts.holidayData)
          : holidayData;
    super(root, { ...opts, holidayData: data });
  }
}
