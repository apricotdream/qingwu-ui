"use client";

import { Calendar } from "@apricotdream/calendar";
import { useEffect, useRef } from "react";

export default function CalendarPopup({
  placeholder = "选择日期",
  selected: initial,
}: {
  placeholder?: string;
  selected?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const cal = new Calendar(el, {
      placeholder,
      selected: initial ?? new Date().toISOString().slice(0, 10),
      onChange: (date) => console.log("[Calendar]", date),
    });
    return () => cal.destroy();
  }, [placeholder, initial]);

  return <div ref={rootRef} className="qw-cal-root" />;
}
