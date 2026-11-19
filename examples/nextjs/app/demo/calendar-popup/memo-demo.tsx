"use client";

import { Calendar, type CalendarNotes } from "@qingwu-ui/calendar";
import { useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";

const format = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function MemoDemo() {
  const root = useRef<HTMLDivElement>(null);
  const holidayRoot = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("点击日期，在详情中修改记事，确认后保存到此浏览器。");

  useEffect(() => {
    if (!root.current || !holidayRoot.current) return;
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 3);
    const end = new Date(today);
    end.setDate(end.getDate() + 3);
    const storageKey = "qingwu-calendar-memo-demo";
    let notes: CalendarNotes = { [format(today)]: "确认日历组件的日期范围与记事功能。" };
    try {
      notes = JSON.parse(localStorage.getItem(storageKey) || "null") || notes;
    } catch {
      /* 保留演示初始记事 */
    }
    const calendar = new Calendar(root.current, {
      mode: "modal",
      dateOnly: true,
      selected: today,
      markedRanges: [{ start: format(start), end: format(end) }],
      enableNotes: true,
      notes,
      onNotesChange: (changes) => {
        for (const { date, content } of changes) {
          if (content) notes[date] = content;
          else delete notes[date];
        }
        localStorage.setItem(storageKey, JSON.stringify(notes));
        setMessage(`已保存：${JSON.stringify(changes)}`);
      },
    });
    const holiday = new Calendar(holidayRoot.current, {
      mode: "modal",
      dateOnly: true,
      selected: "2026-10-01",
      markedRanges: [{ start: "2026-10-01", end: "2026-10-10" }],
      enableNotes: true,
      notes: { "2026-10-01": "出门前检查行李。" },
    });
    return () => {
      calendar.destroy();
      holiday.destroy();
    };
  }, []);

  return (
    <DemoCard
      title="日期范围与备忘记事"
      desc="范围内显示绿底，只有今天落在范围内才显示红底；选中态为描边，节日名称、休/工角标和记事圆点分别保留。取消不保存，换行和方向键可正常编辑记事。"
      full
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
        <div>
          <p>今天与日期记事</p>
          <div ref={root} />
        </div>
        <div>
          <p>国庆与调休叠加</p>
          <div ref={holidayRoot} />
        </div>
      </div>
      <p role="status" style={{ marginTop: 16, fontSize: 13, overflowWrap: "anywhere" }}>
        {message}
      </p>
    </DemoCard>
  );
}
