"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

/* ------------------ helpers ------------------ */

const LETTER_ORDER = ["A", "A-", "B+", "B", "C+", "D", "F"];

function percentToLetter(pct) {
  if (pct >= 90) return "A";
  if (pct >= 85) return "A-";
  if (pct >= 80) return "B+";
  if (pct >= 75) return "B";
  if (pct >= 70) return "C+";
  if (pct >= 60) return "D";
  return "F";
}

function letterToPoints(letter) {
  switch (letter) {
    case "A":
      return 4.0;
    case "A-":
      return 3.7;
    case "B+":
      return 3.3;
    case "B":
      return 3.0;
    case "C+":
      return 2.3;
    case "D":
      return 1.0;
    case "F":
      return 0.0;
    default:
      return 0.0;
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/* ------------------ UI pieces ------------------ */

function Donut({ valueText, percent, size = 74, thickness = 10 }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const p = clamp(percent, 0, 100);
  const dash = (p / 100) * c;

  const isZero = p === 0;
  const ringColor = isZero ? "#d1d5db" : "#22c55e";

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#e5e7eb"
          strokeWidth={thickness}
          fill="none"
        />

        {/* progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ringColor}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontWeight: 900,
          fontSize: 14,
          color: isZero ? "#9ca3af" : "#111827",
        }}
      >
        {valueText}
      </div>
    </div>
  );
}

function ProgressRow({ label, percent, color }) {
  const p = clamp(percent, 0, 100);
  const isZero = p === 0;

  const finalColor = isZero ? "#d1d5db" : color;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "34px 1fr 44px",
        gap: 10,
        alignItems: "center",
        marginTop: 10,
      }}
    >
      <div style={{ fontWeight: 900 }}>{label}</div>

      <div style={{ height: 8, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${p}%`, height: "100%", background: finalColor, borderRadius: 999 }} />
      </div>

      <div style={{ textAlign: "right", fontWeight: 900, color: isZero ? "#9ca3af" : "#111827" }}>
        {p}%
      </div>
    </div>
  );
}

/* ------------------ shared stats (single fetch) ------------------ */

const AcademicStatsContext = createContext(null);

export function AcademicStatsProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [grades, setGrades] = useState([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user || userErr) {
        if (!cancelled) {
          setGrades([]);
          setEnrolledCourseIds([]);
          setErr(userErr?.message || "Not logged in.");
          setLoading(false);
        }
        return;
      }

      const [{ data: gData, error: gErr }, { data: eData, error: eErr }] = await Promise.all([
        supabase.from("grades").select("final_grade").eq("student_id", user.id),
        supabase.from("enrollments").select("course_id").eq("student_id", user.id),
      ]);

      if (cancelled) return;

      if (gErr) {
        setErr(gErr.message);
        setGrades([]);
      } else {
        setGrades(Array.isArray(gData) ? gData : []);
      }

      if (eErr) {
        setEnrolledCourseIds([]);
      } else {
        const distinct = Array.from(new Set((eData || []).map((x) => x.course_id).filter(Boolean)));
        setEnrolledCourseIds(distinct);
      }

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const computed = useMemo(() => {
    // only include rows with real numeric final_grade
    const numericGrades = (grades || [])
      .map((g) => Number(g.final_grade))
      .filter((n) => Number.isFinite(n));

    const hasGrades = numericGrades.length > 0;

    const counts = Object.fromEntries(LETTER_ORDER.map((k) => [k, 0]));
    let pointsSum = 0;

    for (const pct of numericGrades) {
      const letter = percentToLetter(pct);
      counts[letter] += 1;
      pointsSum += letterToPoints(letter);
    }

    const gpa = hasGrades ? pointsSum / numericGrades.length : 0;
    const gpaRounded = Math.round(gpa * 100) / 100;

    const distribution = LETTER_ORDER.map((label) => ({
      label,
      percent: hasGrades ? Math.round((counts[label] / numericGrades.length) * 100) : 0,
    }));

    // No "units" column in your schema, so assume 3 units per enrolled course
    const completedUnits = enrolledCourseIds.length * 3;

    return {
      hasGrades,
      gpa: gpaRounded,
      completedUnits,
      attendancePercent: null,
      distribution,
    };
  }, [grades, enrolledCourseIds]);

  const value = useMemo(() => ({ loading, err, ...computed }), [loading, err, computed]);

  return <AcademicStatsContext.Provider value={value}>{children}</AcademicStatsContext.Provider>;
}

function useAcademicStats() {
  const ctx = useContext(AcademicStatsContext);
  if (!ctx) {
    return {
      loading: false,
      err: "AcademicStatsProvider missing. Wrap cards in <AcademicStatsProvider>.",
      gpa: 0,
      completedUnits: 0,
      attendancePercent: null,
      distribution: LETTER_ORDER.map((label) => ({ label, percent: 0 })),
      hasGrades: false,
    };
  }
  return ctx;
}

/* ------------------ exported cards ------------------ */

export function AcademicPerformanceCard() {
  const { loading, err, gpa, completedUnits, attendancePercent, hasGrades } = useAcademicStats();
  const gpaPercent = clamp((gpa / 4) * 100, 0, 100);
  const isZero = gpaPercent === 0;

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid rgba(0,0,0,.08)" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Academic Performance</div>

      {loading ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Loading...</div>
      ) : err ? (
        <div style={{ color: "red", fontSize: 13 }}>{err}</div>
      ) : (
        <div style={{ display: "flex", gap: 12 }}>
          <Donut valueText={gpa.toFixed(2)} percent={gpaPercent} />

          <div style={{ flex: 1 }}>
            <div style={{ textAlign: "center", fontWeight: 900, color: "#111827" }}>Overall GPA</div>

            <div
              style={{
                textAlign: "center",
                fontSize: 22,
                fontWeight: 900,
                color: gpa === 0 ? "#9ca3af" : "#111827",
              }}
            >
              {gpa.toFixed(2)}
            </div>

            <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, marginTop: 10, overflow: "hidden" }}>
              <div
                style={{
                  width: `${gpaPercent}%`,
                  height: "100%",
                  background: isZero ? "#d1d5db" : "#22c55e",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13, color: "#374151" }}>
              <div>
                <div style={{ color: "#6b7280" }}>Completed Units</div>
                <div style={{ fontWeight: 900 }}>{completedUnits}</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#6b7280" }}>Attendance</div>
                <div style={{ fontWeight: 900 }}>{attendancePercent == null ? "—" : `${attendancePercent}%`}</div>
              </div>
            </div>

            {!hasGrades && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                (No grades yet — enter grades to see real GPA and distribution.)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GradeDistributionCard() {
  const { loading, err, distribution, hasGrades } = useAcademicStats();

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid rgba(0,0,0,.08)" }}>
      <div style={{ fontWeight: 900, marginBottom: 4 }}>Grade Distribution</div>

      {loading ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Loading...</div>
      ) : err ? (
        <div style={{ color: "red", fontSize: 13 }}>{err}</div>
      ) : (
        <>
          {distribution.map((d) => (
            <ProgressRow
              key={d.label}
              label={d.label}
              percent={d.percent}
              color={d.label.startsWith("A") ? "#22c55e" : d.label.startsWith("B") ? "#3b82f6" : "#9ca3af"}
            />
          ))}

          {!hasGrades && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              (No grades yet — distribution will populate once grades exist.)
            </div>
          )}
        </>
      )}
    </div>
  );
}