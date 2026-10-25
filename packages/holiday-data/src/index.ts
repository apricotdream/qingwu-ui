import data from "../data.json";
import { parseHolidayData } from "./schema";

export * from "./schema";
export const holidayData = parseHolidayData(data);
export function getHolidayYear(year: number) {
  return holidayData.years.find((item) => item.year === year) ?? null;
}
