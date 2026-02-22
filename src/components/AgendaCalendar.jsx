"use client";

import { useMemo, useState } from "react";

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toKey(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

export default function AgendaCalendar({ byDay = new Map(), onSelectDate }) {
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

  const pick = (day) => {
    const d = new Date(year, month, day);
    setSelectedDate(d);
    onSelectDate?.(d);
  };

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,.06)",
        borderRadius: 14,
        padding: 10,
        background: "rgba(255,255,255,.7)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={goPrevMonth}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          ‹
        </button>

        <div style={{ fontWeight: 900 }}>{monthTitle}</div>

        <button
          type="button"
          onClick={goNextMonth}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          ›
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
          fontSize: 12,
          textAlign: "center",
        }}
      >
        {WEEK_DAYS.map((d) => (
          <div key={d} style={{ fontWeight: 700, color: "#6b7280" }}>
            {d}
          </div>
        ))}

        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;

          const active = isSelected(day);
          const key = toKey(year, month, day);
          const hasEvents = (byDay.get(key) || []).length > 0;

          return (
            <button
              key={day}
              onClick={() => pick(day)}
              style={{
                border: "none",
                borderRadius: 10,
                padding: "6px 0",
                cursor: "pointer",
                background: active ? "#111827" : "transparent",
                color: active ? "white" : "#111827",
                fontWeight: active ? 800 : 500,
                position: "relative",
              }}
            >
              {day}

              {hasEvents && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 3,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: active ? "white" : "var(--blue-main)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}