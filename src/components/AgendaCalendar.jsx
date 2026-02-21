"use client";

import { useMemo, useState } from "react";

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function AgendaCalendar() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
      }).format(viewDate),
    [viewDate]
  );

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(
    () => [
      ...Array(firstDayIndex).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ],
    [firstDayIndex, daysInMonth]
  );

  const goPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const goNextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isSelected = (day) =>
    selectedDate.getFullYear() === year &&
    selectedDate.getMonth() === month &&
    selectedDate.getDate() === day;

  return (
    <div className="rounded-2xl bg-white/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          className="px-2 text-slate-500 hover:text-slate-700"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-slate-600">{monthTitle}</p>
        <button
          type="button"
          onClick={goNextMonth}
          className="px-2 text-slate-500 hover:text-slate-700"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-2 text-center text-sm text-slate-500">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="text-xs font-medium">
            {day}
          </div>
        ))}

        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;

          const active = isSelected(day);

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDate(new Date(year, month, day))}
              className={`mx-auto h-7 w-7 rounded-lg text-sm transition ${
                active
                  ? "bg-slate-800 font-semibold text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}