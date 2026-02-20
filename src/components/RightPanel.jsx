"use client";

import { useMemo } from "react";

function Card({ title, children }) {
  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-md)",
        padding: 14,
        boxShadow: "var(--shadow-soft)",
        backdropFilter: "blur(8px)",
      }}
    >
      {title && (
        <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export default function RightPanel({
  fullName = "Student",
  studentId = "",
  newsTitle = "ChatGPT Edu",
  newsDate = "10 February 2026",
  upcoming = [],
}) {
  const now = useMemo(() => new Date(), []);
  const dateStr = now.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <aside style={{ width: 320, display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900 }}>{fullName}</div>
            {studentId ? (
              <div style={{ color: "#6b7280", fontSize: 12 }}>Student ID: {studentId}</div>
            ) : (
              <div style={{ color: "#6b7280", fontSize: 12 }}>Student</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, color: "#6b7280" }}>
            <span title="Notifications">🔔</span>
            <span title="Logout">🚪</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            background: "rgba(0,0,0,.03)",
            border: "1px solid rgba(0,0,0,.06)",
            padding: "8px 10px",
            borderRadius: 12,
            fontSize: 12,
            color: "#111827",
          }}
        >
          🗓️ {dateStr}
        </div>
      </Card>

      <Card title="News">
        <div
          style={{
            height: 120,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,.06)",
            background: "linear-gradient(180deg, rgba(47,111,179,.18), rgba(87,180,71,.12))",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
          }}
        >
          OpenAI
        </div>
        <div style={{ marginTop: 10, fontWeight: 900 }}>{newsTitle}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{newsDate}</div>
      </Card>

      <Card title="Agenda">
        <div
          style={{
            border: "1px solid rgba(0,0,0,.06)",
            borderRadius: 14,
            padding: 10,
            background: "rgba(255,255,255,.7)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 12 }}>
            <span>◀</span>
            <span style={{ fontWeight: 900 }}>Sep 2025</span>
            <span>▶</span>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
              fontSize: 12,
            }}
          >
            {"SMTWTFS".split("").map((d) => (
              <div key={d} style={{ textAlign: "center", color: "#6b7280" }}>
                {d}
              </div>
            ))}

            {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                style={{
                  textAlign: "center",
                  padding: "6px 0",
                  borderRadius: 10,
                  background: n === 9 ? "rgba(0,0,0,.8)" : "transparent",
                  color: n === 9 ? "white" : "#111827",
                }}
              >
                {n}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {upcoming.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>No upcoming items.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcoming.map((u, idx) => (
                <div key={idx} style={{ borderTop: "1px solid rgba(0,0,0,.06)", paddingTop: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 12 }}>{u.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{u.when}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </aside>
  );
}