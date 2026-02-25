"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function gradeColor(n) {
  if (!Number.isFinite(n)) return "#e5e7eb";
  if (n >= 90) return "#22c55e"; // green
  if (n >= 85) return "#1d4ed8"; // dark blue
  if (n >= 75) return "#60a5fa"; // light blue
  if (n >= 60) return "#f59e0b"; // orange
  return "#ef4444"; // red
}

function gradePillStyle(n) {
  const ok = Number.isFinite(n);
  const bg = ok ? gradeColor(n) : "#e5e7eb";
  const fg = ok ? "#fff" : "#6b7280";

  return {
    background: bg,
    color: fg,
    padding: "6px 12px",
    borderRadius: 999,
    fontWeight: 900,
    display: "inline-block",
    minWidth: 60,
    textAlign: "center",
  };
}

function Donut({ value }) {
  const percent = clamp(Number(value || 0), 0, 100);

  const size = 82;
  const thickness = 10;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;

  const isZero = percent === 0;
  const ring = isZero ? "#d1d5db" : "#22c55e";

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={thickness} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ring}
          strokeWidth={thickness}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontWeight: 900,
          color: isZero ? "#9ca3af" : "#111827",
        }}
      >
        {percent.toFixed(1)}
      </div>
    </div>
  );
}

const pill = {
  height: 34,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  padding: "0 10px",
  fontWeight: 800,
  outline: "none",
  background: "#fff",
};

const headerRow = {
  display: "grid",
  gridTemplateColumns: "110px 1.6fr 1fr 80px 130px 130px",
  background: "#f3f4f6",
  padding: 10,
  fontWeight: 900,
  fontSize: 12,
};

const dataRow = {
  display: "grid",
  gridTemplateColumns: "110px 1.6fr 1fr 80px 130px 130px",
  padding: 10,
  borderTop: "1px solid #eef0f3",
  alignItems: "center",
};

export default function GradebookPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]); // { course_id, code, title, teacherName, credits, midterm, final }
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("Courses");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");

      const { data: ures, error: uerr } = await supabase.auth.getUser();
      const user = ures?.user;
      if (!user || uerr) {
        if (!cancelled) {
          setErr(uerr?.message || "Not logged in.");
          setRows([]);
          setLoading(false);
        }
        return;
      }

      // 1) get enrolled course ids
      const { data: enrolls, error: eErr } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user.id);

      if (cancelled) return;

      if (eErr) {
        setErr(eErr.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const courseIds = Array.from(new Set((enrolls || []).map((x) => x.course_id).filter((v) => v != null)));

      // no courses yet => keep layout, show empty state
      if (courseIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 2) load courses (YOUR schema: code, title, teacher_id)
      const { data: courses, error: cErr } = await supabase
        .from("courses")
        .select("id, code, title, teacher_id")
        .in("id", courseIds);

      if (cancelled) return;

      if (cErr) {
        setErr(cErr.message);
        setRows([]);
        setLoading(false);
        return;
      }

      // 3) load grades for this student (YOUR schema: midterm, final_grade)
      const { data: grades, error: gErr } = await supabase
        .from("grades")
        .select("course_id, midterm, final_grade")
        .eq("student_id", user.id)
        .in("course_id", courseIds);

      // grades may not exist yet for each course; don’t block UI
      if (gErr && !cancelled) {
        // optional: setErr(gErr.message);
      }

      // 4) load teacher name(s) from profiles (so Instructor column is real)
      const teacherIds = Array.from(new Set((courses || []).map((c) => c.teacher_id).filter(Boolean)));
      let teacherNameMap = new Map();
      if (teacherIds.length) {
        const { data: teachers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherIds);

        teacherNameMap = new Map((teachers || []).map((t) => [t.id, t.full_name || "Teacher"]));
      }

      const gradeMap = new Map((grades || []).map((g) => [g.course_id, g]));
      const courseMap = new Map((courses || []).map((c) => [c.id, c]));

      const merged = courseIds
        .map((cid) => {
          const c = courseMap.get(cid);
          const g = gradeMap.get(cid);

          const mid = Number(g?.midterm);
          const fin = Number(g?.final_grade);

          return {
            course_id: cid,
            code: c?.code ?? "—",
            title: c?.title ?? "—",
            teacherName: teacherNameMap.get(c?.teacher_id) ?? "Teacher",
            credits: "—", // you do NOT have a credits column in your schema
            midterm: Number.isFinite(mid) ? mid : null,
            final: Number.isFinite(fin) ? fin : null,
          };
        })
        .sort((a, b) => String(a.code).localeCompare(String(b.code)));

      if (!cancelled) {
        setRows(merged);
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;

    if (courseFilter !== "Courses") out = out.filter((r) => r.code === courseFilter);
    if (q) out = out.filter((r) => `${r.code} ${r.title} ${r.teacherName}`.toLowerCase().includes(q));

    return out;
  }, [rows, courseFilter, query]);

  const totalScore = useMemo(() => {
    const finals = filtered.map((r) => r.final).filter((n) => Number.isFinite(n));
    if (!finals.length) return 0;
    return finals.reduce((a, b) => a + b, 0) / finals.length;
  }, [filtered]);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #e5e7eb" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>
          IS 201 - Data Structures and Algorithm
        </div>
        <Donut value={totalScore} />
      </div>

      {/* FILTERS */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} style={pill}>
          <option>Courses</option>
          {Array.from(new Set(rows.map((r) => r.code))).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* You don't have semester column; keep as UI-only for now */}
        <select disabled style={{ ...pill, opacity: 0.7, cursor: "not-allowed" }}>
          <option>Semester</option>
        </select>

        <input
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...pill, width: 240 }}
        />
      </div>

      {/* TABLE */}
      <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={headerRow}>
          <div>Course Code</div>
          <div>Course Name</div>
          <div>Instructor</div>
          <div>Credits</div>
          <div>Midterm Grade</div>
          <div>Final Grade</div>
        </div>

        {loading ? (
          <div style={{ padding: 16, color: "#6b7280" }}>Loading...</div>
        ) : err ? (
          <div style={{ padding: 16, color: "#b91c1c", fontWeight: 800 }}>{err}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 22, textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontWeight: 900, color: "#111827", marginBottom: 6 }}>No courses yet</div>
            <div style={{ fontSize: 13 }}>Once you enroll in courses, they will appear here.</div>
          </div>
        ) : (
          <>
            {filtered.map((r) => (
              <div key={r.course_id} style={dataRow}>
                <div style={{ fontWeight: 900, color: "#2563eb" }}>{r.code}</div>
                <div style={{ fontWeight: 900 }}>{r.title}</div>
                <div style={{ color: "#6b7280", fontWeight: 800 }}>{r.teacherName}</div>
                <div style={{ fontWeight: 800 }}>{r.credits}</div>
                <div style={{ fontWeight: 800 }}>{r.midterm == null ? "—" : `${r.midterm}%`}</div>
                <div>
                  <span style={gradePillStyle(r.final)}>{r.final == null ? "—" : `${r.final}%`}</span>
                </div>
              </div>
            ))}

            <div style={{ ...dataRow, background: "#f9fafb", fontWeight: 900 }}>
              <div>Total Score</div>
              <div />
              <div />
              <div />
              <div />
              <div>{totalScore.toFixed(2)}%</div>
            </div>
          </>
        )}
      </div>

      {/* LEGEND */}
      <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Legend color="#22c55e" text="90-100%" />
        <Legend color="#1d4ed8" text="85-89%" />
        <Legend color="#60a5fa" text="75-84%" />
        <Legend color="#f59e0b" text="60-69%" />
        <Legend color="#ef4444" text="Below 60" />
      </div>
    </div>
  );
}

function Legend({ color, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      {text}
    </div>
  );
}