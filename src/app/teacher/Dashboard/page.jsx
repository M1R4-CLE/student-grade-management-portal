"use client";

import LogoutButton from "@/components/LogoutButton";
import AgendaCalendar from "@/components/AgendaCalendar";

export default function TeacherDashboardPage() {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0 }}>
          Welcome to your <b>Teacher Dashboard</b>
        </p>
        <LogoutButton />
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,.06)",
          background: "rgba(255,255,255,.75)",
        }}
      >
        Use the sidebar to manage classes and enter grades.
      </div>
    </>
  );
}