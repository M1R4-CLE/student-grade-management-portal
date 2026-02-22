"use client";

import { useRouter } from "next/navigation";
import AgendaCalendar from "@/components/AgendaCalendar";

export default function TeacherDashboardPage() {
  const router = useRouter();

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <p style={{ margin: 0 }}>
          Welcome to your <b>Teacher Dashboard</b>
        </p>
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

      {/* Navigation Button */}
      <div
        style={{
          marginTop: 18,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/teacher/Class-Management")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,.15)",
            background: "white",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Manage My Classes →
        </button>
      </div>
    </>
  );
}