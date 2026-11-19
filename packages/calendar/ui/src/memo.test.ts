import { afterEach, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";

let calendar: Calendar;
const mount = () => {
  const root = document.createElement("div");
  document.body.append(root);
  return root;
};
const cell = (date: string) => document.querySelector<HTMLElement>(`[data-date="${date}"]`)!;
const click = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();
const edit = (value: string) => {
  const textarea = document.querySelector<HTMLTextAreaElement>(".qw-cal-note-input")!;
  textarea.value = value;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  return textarea;
};
afterEach(() => {
  calendar?.destroy();
  document.body.textContent = "";
  vi.useRealTimers();
});

it("范围含起止日期，仅今天变红的状态与节日/调休标记共存", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 1, 12));
  calendar = new Calendar(mount(), {
    selected: "2026-10-01",
    markedRanges: [{ start: "2026-10-01", end: "2026-10-10" }],
    holidays: { holidays: ["2026-10-01"], workdays: ["2026-10-10"] },
    enableNotes: true,
    notes: { "2026-10-01": "假日记事" },
  });
  calendar.open();
  expect(cell("2026-10-01").className).toContain("is-today");
  expect(document.querySelectorAll(".is-marked-range.is-today")).toHaveLength(1);
  expect(cell("2026-10-01").textContent).toContain("国庆节");
  expect(cell("2026-10-01").querySelector(".qw-cal-cell-badge")?.textContent).toBe("休");
  expect(cell("2026-10-01").querySelector(".qw-cal-note-dot")).not.toBeNull();
  expect(cell("2026-10-10").classList.contains("is-marked-range")).toBe(true);
  expect(cell("2026-10-10").querySelector(".qw-cal-cell-badge")?.textContent).toBe("工");
  expect(cell("2026-10-11").classList.contains("is-marked-range")).toBe(false);
});

it("跨日期记事草稿统一确认，删除通过空 content 回发", () => {
  const onNotesChange = vi.fn();
  calendar = new Calendar(mount(), {
    selected: "2026-11-19",
    enableNotes: true,
    notes: { "2026-11-19": "旧记事" },
    onNotesChange,
  });
  calendar.open();
  edit("");
  cell("2026-11-20").click();
  edit("新记事");
  expect(calendar.getNotes()).toEqual({ "2026-11-19": "旧记事" });
  expect(onNotesChange).not.toHaveBeenCalled();
  click(".qw-cal-confirm-btn");
  expect(calendar.getNotes()).toEqual({ "2026-11-20": "新记事" });
  expect(onNotesChange).toHaveBeenCalledExactlyOnceWith([
    { date: "2026-11-19", content: "" },
    { date: "2026-11-20", content: "新记事" },
  ]);
  calendar.open();
  click(".qw-cal-confirm-btn");
  expect(onNotesChange).toHaveBeenCalledTimes(1);
});

it.each(["取消", "Escape", "外部点击", "close"])("%s 丢弃未确认的记事", (action) => {
  const onNotesChange = vi.fn();
  calendar = new Calendar(mount(), {
    selected: "2026-11-19",
    enableNotes: true,
    notes: { "2026-11-19": "已保存" },
    onNotesChange,
  });
  calendar.open();
  edit("草稿");
  if (action === "取消") click(".qw-cal-cancel-btn");
  else if (action === "Escape")
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  else if (action === "close") calendar.close();
  else document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  calendar.open();
  expect(document.querySelector<HTMLTextAreaElement>(".qw-cal-note-input")!.value).toBe("已保存");
  expect(onNotesChange).not.toHaveBeenCalled();
});

it("默认关闭记事，初始内容不会被解析为 HTML", () => {
  const notes = { "2026-11-19": '<img src=x onerror="alert(1)">' };
  calendar = new Calendar(mount(), { selected: "2026-11-19", notes });
  calendar.open();
  expect(document.querySelector(".qw-cal-note-input,.qw-cal-note-dot")).toBeNull();
  calendar.destroy();
  calendar = new Calendar(mount(), { selected: "2026-11-19", notes, enableNotes: true });
  calendar.open();
  expect(document.querySelector(".qw-cal-note img")).toBeNull();
  expect(document.querySelector<HTMLTextAreaElement>(".qw-cal-note-input")!.value).toBe(
    notes["2026-11-19"],
  );
});

it("同月选日和连续输入不重算整月 meta，也不替换已有日期节点", () => {
  const getDayMeta = vi.fn(() => null);
  calendar = new Calendar(mount(), {
    selected: "2026-11-19",
    enableNotes: true,
    dayMetaProviders: [{ id: "perf", getDayMeta }],
  });
  calendar.open();
  const previous = cell("2026-11-19"),
    count = getDayMeta.mock.calls.length;
  cell("2026-11-20").click();
  const textarea = edit("记事");
  edit("连续输入");
  expect(cell("2026-11-19")).toBe(previous);
  expect(getDayMeta).toHaveBeenCalledTimes(count);
  for (const key of ["Enter", "ArrowLeft", "ArrowRight"]) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    textarea.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(cell("2026-11-20").hasAttribute("data-selected")).toBe(true);
  expect(document.querySelector(".qw-cal-overlay")!.hasAttribute("hidden")).toBe(false);
});

it("选择补齐的下月日期时更新月份并保留记事草稿", () => {
  calendar = new Calendar(mount(), { selected: "2026-11-19", enableNotes: true });
  calendar.open();
  edit("十一月草稿");
  cell("2026-12-01").click();
  expect(document.querySelector(".qw-cal-title-month")!.textContent).toBe("12月");
  expect(cell("2026-12-01").hasAttribute("data-selected")).toBe(true);
  click(".qw-cal-prev");
  cell("2026-11-19").click();
  expect(document.querySelector<HTMLTextAreaElement>(".qw-cal-note-input")!.value).toBe(
    "十一月草稿",
  );
});
