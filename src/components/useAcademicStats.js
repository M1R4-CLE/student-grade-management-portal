"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

function letterFromScore(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return null; // IMPORTANT: ignore null/NaN
  if (s >= 93) return "A";
  if (s >= 90) return "A-";
  if (s >= 87) return "B+";
  if (s >= 83) return "B";
  if (s >= 80) return "B-";
  if (s >= 77) return "C+";
  if (s >= 73) return "C";
  if (s >= 70) return "C-";
  if (s >= 67) return "D+";
  if (s >= 63) return "D";
  if (s >= 60) return "D-";
  return "F";
}

function pointsFromLetter(letter) {
  const map = {
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    "D+": 1.3,
    D: 1.0,
    "D-": 0.7,
    F: 0.0,
  };
  return map[letter] ?? 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function useAcademicStats({ limit = 300, assumeUnitsPerCourse = 3 } = {}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [grades, setGrades] = useState([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let channel;

    async function loadForUser(userId, showLoading = false) {
      if (showLoading && !cancelled) setLoading(true);
      const [{ data: gData, error: gErr }, { data: eData, error: eErr }] = await Promise.all([
        supabase
          .from("grades")
          .select("course_id, final_grade")
          .eq("student_id", userId)
          .order("course_id", { ascending: true })
          .limit(limit),
        supabase.from("enrollments").select("course_id").eq("student_id", userId),
      ]);

      if (cancelled) return;

      if (gErr) {
        setErr(gErr.message);
        setGrades([]);
      } else {
        setGrades(Array.isArray(gData) ? gData : []);
      }

      if (eErr) {
        // don’t block GPA if enrollments fails
        setEnrolledCourseIds([]);
      } else {
        const distinct = Array.from(new Set((eData || []).map((x) => x.course_id).filter(Boolean)));
        setEnrolledCourseIds(distinct);
      }

      setLoading(false);
    }

    async function run() {
      setLoading(true);
      setErr("");

      const { data: ures, error: uerr } = await supabase.auth.getUser();
      const user = ures?.user;

      if (!user || uerr) {
        if (!cancelled) {
          setGrades([]);
          setEnrolledCourseIds([]);
          setErr(uerr?.message || "Not logged in.");
          setLoading(false);
        }
        return;
      }

      await loadForUser(user.id);
      if (cancelled) return;

      channel = supabase
        .channel(`academic-stats-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "grades", filter: `student_id=eq.${user.id}` },
          () => {
            loadForUser(user.id);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "enrollments", filter: `student_id=eq.${user.id}` },
          () => {
            loadForUser(user.id);
          }
        )
        .subscribe();
    }

    run();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [limit]);

  const computed = useMemo(() => {
    const buckets = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];
    const counts = Object.fromEntries(buckets.map((b) => [b, 0]));

    // ✅ only include rows with a real final_grade
    const validGrades = (grades || [])
      .map((g) => ({ ...g, num: Number(g.final_grade) }))
      .filter((g) => Number.isFinite(g.num)); // <-- critical fix

    let sumPoints = 0;
    let n = 0;

    for (const g of validGrades) {
      const letter = letterFromScore(g.num);
      if (!letter) continue;

      counts[letter] = (counts[letter] ?? 0) + 1;
      sumPoints += pointsFromLetter(letter);
      n += 1;
    }

    const gpaRaw = n > 0 ? sumPoints / n : 0;
    const gpa = Math.round(gpaRaw * 100) / 100;

    const distribution = buckets.map((label) => {
      const c = counts[label] ?? 0;
      const percent = n > 0 ? Math.round((c / n) * 100) : 0;
      return { label, count: c, percent };
    });

    // ✅ not hard-coded: computed from enrollments
    const completedUnits = enrolledCourseIds.length * assumeUnitsPerCourse;

    // Donut percent based on GPA out of 4
    const gpaPercent = clamp((gpa / 4) * 100, 0, 100);

    return {
      hasGrades: n > 0,
      gpa,
      gpaPercent,
      completedUnits,
      attendancePercent: null,
      distribution,
    };
  }, [grades, enrolledCourseIds, assumeUnitsPerCourse]);

  return { loading, err, ...computed };
}
