"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

const TERM_OPTIONS = [
  { value: "prelim", label: "Prelim" },
  { value: "midterm", label: "Midterm" },
  { value: "final_exam", label: "Final" },
];
const TERM_WEIGHTS = {
  Attendance: 0.2,
  Quiz: 0.2,
  Activity: 0.3,
  Exam: 0.4,
};
const TERM_WEIGHT_TOTAL = Object.values(TERM_WEIGHTS).reduce((s, w) => s + w, 0);
const ATTENDANCE_STATUS_OPTIONS = ["Present", "Late", "Absent", "Exempted", "Excused"];
const ATTENDANCE_STATUS_POINTS = {
  Present: 1,
  Late: 0.5,
  Absent: 0,
  Exempted: null,
  Excused: null,
};
const ADDABLE_SCORE_TYPES = ["Quiz", "Activity", "Exam"];

function normalizePct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

function computeFinal(prelim, midterm, finalExam) {
  const p = normalizePct(prelim);
  const m = normalizePct(midterm);
  const f = normalizePct(finalExam);
  return +(p * 0.3 + m * 0.3 + f * 0.4).toFixed(2);
}

function todayInputDate() {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

function buildActivity(partial = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item: partial.item || "Attendance",
    date: partial.date || todayInputDate(),
    term: partial.term || "prelim",
    type: partial.type || "Attendance",
    maxScore: partial.maxScore || "100",
  };
}

function parseRawScore(scoreText) {
  if (!scoreText) return "";
  const raw = String(scoreText).split("/")[0];
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

function parseMaxScore(scoreText) {
  if (!scoreText) return "100";
  const parts = String(scoreText).split("/");
  const max = Number(parts[1]);
  if (!Number.isFinite(max) || max <= 0) return "100";
  return String(max);
}

function parseTermFromNote(noteText) {
  const txt = String(noteText || "").toLowerCase();
  if (txt.includes("midterm")) return "midterm";
  if (txt.includes("final")) return "final_exam";
  return "prelim";
}

function parseScoreToPct(scoreText) {
  const s = String(scoreText || "").trim();
  if (!s) return null;

  if (s.includes("/")) {
    const [rawText, maxText] = s.split("/");
    const raw = Number(rawText);
    const max = Number(maxText);
    if (!Number.isFinite(raw) || !Number.isFinite(max) || max <= 0) return null;
    return +((raw / max) * 100).toFixed(2);
  }

  if (s.endsWith("%")) {
    const n = Number(s.replace("%", "").trim());
    if (!Number.isFinite(n)) return null;
    return +n.toFixed(2);
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return +n.toFixed(2);
}

function hasAnyScoreValue(scores) {
  const attendance = String(scores?.Attendance ?? "").trim();
  const quiz = String(scores?.Quiz ?? "").trim();
  const activity = String(scores?.Activity ?? "").trim();
  const exam = String(scores?.Exam ?? "").trim();
  return Boolean(attendance || quiz || activity || exam);
}

function hasVisibleInputForSave(scores, visibleTypes) {
  return visibleTypes.some((type) => {
    const value = String(scores?.[type] ?? "").trim();
    return value !== "";
  });
}

function getActivityKey(activity) {
  return `${activity?.date || ""}|${activity?.item || ""}`;
}

function getAttendanceColors(status) {
  if (!status) return { background: "#ffffff", color: "#374151", border: "#d1d5db" };
  if (status === "Present") return { background: "#dcfce7", color: "#166534", border: "#86efac" };
  if (status === "Late") return { background: "#fef9c3", color: "#854d0e", border: "#fde047" };
  if (status === "Absent") return { background: "#fee2e2", color: "#991b1b", border: "#fca5a5" };
  return { background: "#f3f4f6", color: "#4b5563", border: "#d1d5db" }; // Exempted/Excused
}

function getScoreColors(rawText, max) {
  const text = String(rawText ?? "").trim();
  if (!text) {
    return { background: "#ffffff", color: "#111827", border: "#d1d5db" };
  }
  const raw = Number(text);
  if (!Number.isFinite(raw) || !Number.isFinite(max) || max <= 0) {
    return { background: "#ffffff", color: "#111827", border: "#d1d5db" };
  }
  const pct = (raw / max) * 100;
  if (pct >= 90) return { background: "#16a34a", color: "#ffffff", border: "#15803d" }; // highest
  if (pct >= 85) return { background: "#bbf7d0", color: "#14532d", border: "#86efac" }; // lower-highest
  if (pct >= 75) return { background: "#fef08a", color: "#854d0e", border: "#fde047" }; // passing
  if (pct >= 60) return { background: "#fed7aa", color: "#9a3412", border: "#fdba74" }; // below passing
  return { background: "#ef4444", color: "#ffffff", border: "#dc2626" }; // failed
}

function computeNormalizedTermGrade(attendanceAvg, quizAvg, activityAvg, examAvg) {
  const rawWeighted =
    (attendanceAvg ?? 0) * TERM_WEIGHTS.Attendance +
    (quizAvg ?? 0) * TERM_WEIGHTS.Quiz +
    (activityAvg ?? 0) * TERM_WEIGHTS.Activity +
    (examAvg ?? 0) * TERM_WEIGHTS.Exam;
  if (!Number.isFinite(rawWeighted)) return null;
  const normalized = TERM_WEIGHT_TOTAL > 0 ? rawWeighted / TERM_WEIGHT_TOTAL : rawWeighted;
  return +Math.max(0, Math.min(100, normalized)).toFixed(2);
}

export default function TeacherGradeEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState(null);
  const [err, setErr] = useState("");

  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const initialCourseId = searchParams.get("courseId") || "";

  // rows: { studentId, name, studentNo, prelim, midterm, final_exam, scores: { Attendance, Quiz, Activity, Exam } }
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [locked, setLocked] = useState({});
  const [supportsPerformanceLogs, setSupportsPerformanceLogs] = useState(true);

  const [showBuilder, setShowBuilder] = useState(false);
  const [showComputePanel, setShowComputePanel] = useState(false);
  const [computeCourseId, setComputeCourseId] = useState("");
  const [computeTerm, setComputeTerm] = useState("prelim");
  const [computeRows, setComputeRows] = useState([]);
  const [computeLoading, setComputeLoading] = useState(false);
  const [computeErr, setComputeErr] = useState("");
  const [folderSearch, setFolderSearch] = useState("");
  const [showAddColumnMenu, setShowAddColumnMenu] = useState(false);
  const [scoreColumns, setScoreColumns] = useState([
    { id: "attendance-col", type: "Attendance", required: true },
  ]);
  const [activityColumnTypes, setActivityColumnTypes] = useState({});
  const nextColIdRef = useRef(1);
  const [activities, setActivities] = useState([]);
  const [activeActivityId, setActiveActivityId] = useState("");
  const [activityForm, setActivityForm] = useState({
    item: "",
    date: todayInputDate(),
    term: "prelim",
    type: "Attendance",
    maxScore: "",
  });
  const activeActivity = activities.find((a) => a.id === activeActivityId) || activities[0] || null;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = String(profile?.role || "").trim().toLowerCase();
      if (!profile || role !== "teacher") {
        router.replace("/student/dashboard");
        return;
      }
      setTeacherId(user.id);

      const { data: coursesData } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("teacher_id", user.id)
        .order("id");
      setCourses(coursesData || []);
      if (initialCourseId && (coursesData || []).some((c) => String(c.id) === String(initialCourseId))) {
        setSelectedId(String(initialCourseId));
      }

      const { error: logsCheckError } = await supabase
        .from("student_performance_logs")
        .select("id")
        .limit(1);
      if (logsCheckError) {
        setSupportsPerformanceLogs(false);
      }

      setLoading(false);
    };
    run();
  }, [router, initialCourseId]);

  const loadGrades = useCallback(async (courseId, activity, logsEnabled) => {
    if (!courseId) {
      setRows([]);
      return;
    }
    setErr("");
    const termKey = activity?.term || "prelim";
    const activityItem = String(activity?.item || activity?.type || "").trim();
    const activityDate = activity?.date || todayInputDate();

    const { data: enrollData, error: eErr } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", courseId)
      .order("student_id");
    if (eErr) {
      setErr(eErr.message);
      setRows([]);
      return;
    }

    const studentIds = [...new Set((enrollData || []).map((e) => e.student_id).filter(Boolean))];
    const { data: profileRows, error: pErr } = studentIds.length
      ? await supabase.from("profiles").select("id, full_name, student_no").in("id", studentIds)
      : { data: [], error: null };
    if (pErr) {
      setErr(pErr.message);
      setRows([]);
      return;
    }
    const profileMap = new Map((profileRows || []).map((p) => [p.id, p]));

    const students = (enrollData || []).map((e) => {
      const p = profileMap.get(e.student_id);
      return {
        studentId: e.student_id,
        name: p?.full_name || "-",
        studentNo: p?.student_no || "-",
      };
    });

    const { data: gradesData } = await supabase
      .from("grades")
      .select("student_id, prelim, midterm, final_exam")
      .eq("course_id", courseId);
    const gradeMap = {};
    (gradesData || []).forEach((g) => {
      gradeMap[g.student_id] = g;
    });

    let perfMap = {};
    if (logsEnabled && studentIds.length && activityItem) {
      const { data: perfRows, error: perfErr } = await supabase
        .from("student_performance_logs")
        .select("student_id, type, score, status")
        .eq("course_id", courseId)
        .eq("event_date", activityDate)
        .eq("item", activityItem)
        .in("student_id", studentIds);

      if (perfErr) {
        const msg = String(perfErr.message || "").toLowerCase();
        if (msg.includes("does not exist")) {
          setSupportsPerformanceLogs(false);
        }
      } else {
        const dbTypes = Array.from(new Set((perfRows || []).map((x) => x.type).filter(Boolean)));
        const key = getActivityKey(activity);
        const localTypes = activityColumnTypes[key];
        const chosenTypes = Array.isArray(localTypes) && localTypes.length
          ? localTypes
          : dbTypes.length
          ? ["Attendance", ...dbTypes.filter((t) => t !== "Attendance")]
          : ["Attendance"];
        setScoreColumns(chosenTypes.map((t, i) => ({ id: `${t}-${i}`, type: t, required: t === "Attendance" })));
        if ((!Array.isArray(localTypes) || !localTypes.length) && dbTypes.length) {
          setActivityColumnTypes((prev) => ({ ...prev, [key]: chosenTypes }));
        }

        perfMap = (perfRows || []).reduce((acc, x) => {
          if (!acc[x.student_id]) acc[x.student_id] = {};
          acc[x.student_id][x.type] = x.type === "Attendance"
            ? String(x.status || "Present")
            : parseRawScore(x.score);
          return acc;
        }, {});
      }
    }

    setRows(
      students.map((s) => ({
        ...s,
        prelim: String(gradeMap[s.studentId]?.prelim ?? ""),
        midterm: String(gradeMap[s.studentId]?.midterm ?? ""),
        final_exam: String(gradeMap[s.studentId]?.final_exam ?? ""),
        scores: {
          Attendance: String(perfMap[s.studentId]?.Attendance ?? ""),
          Quiz: String(perfMap[s.studentId]?.Quiz ?? ""),
          Activity: String(perfMap[s.studentId]?.Activity ?? ""),
          Exam: String(perfMap[s.studentId]?.Exam ?? ""),
        },
      }))
    );
    setSaving({});
    setSaved({});
    setLocked(
      students.reduce((acc, s) => {
        const scores = {
          Attendance: String(perfMap[s.studentId]?.Attendance ?? ""),
          Quiz: String(perfMap[s.studentId]?.Quiz ?? ""),
          Activity: String(perfMap[s.studentId]?.Activity ?? ""),
          Exam: String(perfMap[s.studentId]?.Exam ?? ""),
        };
        acc[s.studentId] = hasAnyScoreValue(scores);
        return acc;
      }, {})
    );
  }, [activityColumnTypes]);

  const fetchActivityFolders = useCallback(async (courseId) => {
    if (!courseId || !supportsPerformanceLogs) return [];

    const { data, error } = await supabase
      .from("student_performance_logs")
      .select("id, event_date, type, item, note, score")
      .eq("course_id", courseId)
      .order("event_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("does not exist")) {
        setSupportsPerformanceLogs(false);
      }
      return [];
    }

    const seen = new Set();
    const folders = [];
    for (const row of data || []) {
      const key = `${row.event_date}|${row.item}`;
      if (seen.has(key)) continue;
      seen.add(key);
      folders.push(
        buildActivity({
          date: row.event_date || todayInputDate(),
          type: row.type || "Attendance",
          item: row.item || row.type || "Activity",
          term: parseTermFromNote(row.note),
          maxScore: parseMaxScore(row.score),
        })
      );
    }
    return folders;
  }, [supportsPerformanceLogs]);

  const refreshSelectedCourseGrades = useCallback(() => {
    loadGrades(selectedId, activeActivity, supportsPerformanceLogs);
  }, [loadGrades, selectedId, activeActivity, supportsPerformanceLogs]);

  useEffect(() => {
    const t = setTimeout(() => {
      refreshSelectedCourseGrades();
    }, 0);
    return () => clearTimeout(t);
  }, [refreshSelectedCourseGrades]);

  useEffect(() => {
    const t = setTimeout(() => {
      const run = async () => {
        if (!selectedId) {
          setActivities([]);
          setActiveActivityId("");
          return;
        }
        const folders = await fetchActivityFolders(selectedId);
        if (!folders.length) {
          setActivities([]);
          setActiveActivityId("");
          return;
        }

        setActivities(folders);
        setActiveActivityId((prev) =>
          prev && folders.some((f) => f.id === prev) ? prev : folders[0].id
        );
      };
      run();
    }, 0);
    return () => clearTimeout(t);
  }, [selectedId, fetchActivityFolders]);

  useEffect(() => {
    const t = setTimeout(() => {
      const key = getActivityKey(activeActivity);
      const localTypes = activityColumnTypes[key];
      if (Array.isArray(localTypes) && localTypes.length) {
        setScoreColumns(localTypes.map((x, i) => ({ id: `${x}-${i}`, type: x, required: x === "Attendance" })));
      } else {
        setScoreColumns([{ id: "attendance-col", type: "Attendance", required: true }]);
      }
      setShowAddColumnMenu(false);
    }, 0);
    return () => clearTimeout(t);
  }, [activeActivityId, activeActivity, activityColumnTypes]);

  useEffect(() => {
    if (!activeActivityId) return;
    const t = setTimeout(() => {
      // Clear previous folder values immediately while loading the selected folder.
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          scores: { Attendance: "", Quiz: "", Activity: "", Exam: "" },
        }))
      );
      setSaved({});
      setLocked({});
    }, 0);
    return () => clearTimeout(t);
  }, [activeActivityId]);

  const updateEntryScore = (studentId, type, value) => {
    if (locked[studentId]) return;
    let clean = type === "Attendance" ? value : value.replace(/[^0-9.]/g, "");
    if (type !== "Attendance" && clean !== "") {
      const maxScoreNum = Number(activeActivity?.maxScore || 0);
      const n = Number(clean);
      if (Number.isFinite(n) && Number.isFinite(maxScoreNum) && maxScoreNum > 0 && n > maxScoreNum) {
        clean = String(maxScoreNum);
      }
    }
    setRows((prev) =>
      prev.map((r) =>
        r.studentId === studentId
          ? { ...r, scores: { ...(r.scores || {}), [type]: clean } }
          : r
      )
    );
    setSaved((prev) => ({ ...prev, [studentId]: false }));
  };

  const savePerformanceLog = async (row, type, rawScoreText) => {
    if (!activeActivity) return;
    if (!supportsPerformanceLogs) return;
    if (!selectedId || !teacherId) return;

    const item = String(activeActivity.item || activeActivity.type).trim();
    const eventDate = activeActivity.date || todayInputDate();
    const statusValue = type === "Attendance" ? String(rawScoreText || "Present") : "Graded";
    const points = ATTENDANCE_STATUS_POINTS[statusValue];
    const score =
      type === "Attendance"
        ? points == null
          ? "EXEMPTED"
          : `${points}/1`
        : `${rawScoreText || "0"}/${activeActivity.maxScore || "100"}`;

    const { data: existing, error: findErr } = await supabase
      .from("student_performance_logs")
      .select("id")
      .eq("student_id", row.studentId)
      .eq("course_id", selectedId)
      .eq("event_date", eventDate)
      .eq("type", type)
      .eq("item", item)
      .order("id", { ascending: false })
      .limit(1);

    if (findErr) {
      const msg = String(findErr.message || "").toLowerCase();
      if (msg.includes("does not exist")) setSupportsPerformanceLogs(false);
      return;
    }

    const payload = {
      student_id: row.studentId,
      course_id: selectedId,
      event_date: eventDate,
      type,
      item,
      status: statusValue,
      score,
      note: `${type} (${TERM_OPTIONS.find((t) => t.value === activeActivity.term)?.label || "Term"})`,
      created_by: teacherId,
    };

    if (existing?.[0]?.id) {
      await supabase.from("student_performance_logs").update(payload).eq("id", existing[0].id);
      return;
    }

    const { error: insertErr } = await supabase.from("student_performance_logs").insert(payload);
    if (insertErr) {
      const msg = String(insertErr.message || "").toLowerCase();
      if (msg.includes("does not exist")) setSupportsPerformanceLogs(false);
    }
  };

  const computeWeightedTermGrade = async (studentId, courseId, termKey) => {
    if (!supportsPerformanceLogs) return null;

    const { data: logs, error } = await supabase
      .from("student_performance_logs")
      .select("type, score, note")
      .eq("student_id", studentId)
      .eq("course_id", courseId);

    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("does not exist")) setSupportsPerformanceLogs(false);
      return null;
    }

    const grouped = {
      Attendance: [],
      Quiz: [],
      Activity: [],
      Exam: [],
    };

    for (const log of logs || []) {
      const logTerm = parseTermFromNote(log.note);
      if (logTerm !== termKey) continue;
      if (!Object.prototype.hasOwnProperty.call(grouped, log.type)) continue;
      const pct = parseScoreToPct(log.score);
      if (pct == null) continue;
      grouped[log.type].push(pct);
    }

    const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
    const attendanceAvg = avg(grouped.Attendance);
    const quizAvg = avg(grouped.Quiz);
    const activityAvg = avg(grouped.Activity);
    const examAvg = avg(grouped.Exam);

    return computeNormalizedTermGrade(attendanceAvg, quizAvg, activityAvg, examAvg);
  };

  const recomputeTermForAllStudents = async (courseId, termKey) => {
    if (!courseId) return;
    if (!supportsPerformanceLogs) return;

    for (const row of rows) {
      const weightedTerm = await computeWeightedTermGrade(row.studentId, Number(courseId), termKey);
      if (weightedTerm == null) continue;

      const nextPrelim = termKey === "prelim" ? weightedTerm : normalizePct(row.prelim);
      const nextMidterm = termKey === "midterm" ? weightedTerm : normalizePct(row.midterm);
      const nextFinalExam = termKey === "final_exam" ? weightedTerm : normalizePct(row.final_exam);

      let { error } = await supabase
        .from("grades")
        .upsert(
          {
            course_id: Number(courseId),
            student_id: row.studentId,
            prelim: nextPrelim,
            midterm: nextMidterm,
            final_exam: nextFinalExam,
          },
          { onConflict: "course_id,student_id" }
        );

      if (
        error &&
        String(error.message || "")
          .toLowerCase()
          .includes('record "new" has no field "updated_at"')
      ) {
        const { error: delErr } = await supabase
          .from("grades")
          .delete()
          .eq("course_id", Number(courseId))
          .eq("student_id", row.studentId);
        if (!delErr) {
          const { error: insErr } = await supabase.from("grades").insert({
            course_id: Number(courseId),
            student_id: row.studentId,
            prelim: nextPrelim,
            midterm: nextMidterm,
            final_exam: nextFinalExam,
          });
          error = insErr || null;
        }
      }

      if (error) {
        console.error("Recompute term failed:", error.message);
      }
    }
  };

  const saveRow = async (row) => {
    if (!selectedId) return;
    if (locked[row.studentId]) return;
    setErr("");

    const maxScoreNum = Number(activeActivity?.maxScore || 100);
    if (!Number.isFinite(maxScoreNum) || maxScoreNum <= 0) {
      setErr("Max score must be greater than 0.");
      return;
    }

    setSaving((prev) => ({ ...prev, [row.studentId]: true }));

    const termField = activeActivity?.term || "prelim";
    let nextPrelim = normalizePct(row.prelim);
    let nextMidterm = normalizePct(row.midterm);
    let nextFinalExam = normalizePct(row.final_exam);

    let error = null;
    const visibleTypes = Array.from(new Set(scoreColumns.map((c) => c.type)));
    let hasAnyInput = false;

    for (const type of visibleTypes) {
      const value = String(row.scores?.[type] ?? "");
      if (type === "Attendance") {
        const attendanceStatus = value;
        if (!attendanceStatus) continue;
        hasAnyInput = true;
        if (!ATTENDANCE_STATUS_OPTIONS.includes(attendanceStatus)) {
          setErr("Invalid attendance status.");
          setSaving((prev) => ({ ...prev, [row.studentId]: false }));
          return;
        }
        await savePerformanceLog(row, "Attendance", attendanceStatus);
        continue;
      }

      if (!value) continue;
      hasAnyInput = true;
      const raw = Number(value);
      if (!Number.isFinite(raw) || raw < 0) {
        setErr(`Invalid ${type} score.`);
        setSaving((prev) => ({ ...prev, [row.studentId]: false }));
        return;
      }
      if (raw > maxScoreNum) {
        setErr(`${type} score cannot be greater than max score.`);
        setSaving((prev) => ({ ...prev, [row.studentId]: false }));
        return;
      }
      await savePerformanceLog(row, type, value);
    }

    if (!hasAnyInput) {
      setErr("This new activity is blank. Select attendance or enter a score first.");
      setSaving((prev) => ({ ...prev, [row.studentId]: false }));
      return;
    }

    const weightedTerm = await computeWeightedTermGrade(row.studentId, Number(selectedId), termField);
    const attendanceStatus = String(row.scores?.Attendance || "");
    const attendancePoints = ATTENDANCE_STATUS_POINTS[attendanceStatus];
    const rawPct = attendancePoints == null ? 0 : +(attendancePoints * 100).toFixed(2);
    const termValue = weightedTerm == null ? rawPct : weightedTerm;
    if (termField === "prelim") nextPrelim = termValue;
    if (termField === "midterm") nextMidterm = termValue;
    if (termField === "final_exam") nextFinalExam = termValue;

    const gradePayload = {
      course_id: Number(selectedId),
      student_id: row.studentId,
      prelim: nextPrelim,
      midterm: nextMidterm,
      final_exam: nextFinalExam,
    };

    ({ error } = await supabase
      .from("grades")
      .upsert(gradePayload, { onConflict: "course_id,student_id" }));

    if (
      error &&
      String(error.message || "")
        .toLowerCase()
        .includes('record "new" has no field "updated_at"')
    ) {
      const { error: delErr } = await supabase
        .from("grades")
        .delete()
        .eq("course_id", Number(selectedId))
        .eq("student_id", row.studentId);

      if (!delErr) {
        const { error: insErr } = await supabase.from("grades").insert(gradePayload);
        error = insErr || null;
      }
    }

    if (error) {
      setErr(error.message);
      setSaving((prev) => ({ ...prev, [row.studentId]: false }));
      return;
    }

    const selectedCourse = courses.find((c) => String(c.id) === String(selectedId));
    const finalGrade = computeFinal(nextPrelim, nextMidterm, nextFinalExam);
    const notifPayload = {
      user_id: row.studentId,
      type: "grade",
      title: "Grade updated",
      body: `${selectedCourse?.code || "Course"}: ${selectedCourse?.title || "Course"} - Final Grade: ${finalGrade}%`,
      link: `/student/grades?course=${encodeURIComponent(selectedCourse?.code || "")}`,
    };
    const { error: notifError } = await supabase.from("notifications").insert(notifPayload);
    if (notifError) {
      console.error("Grade saved but notification failed:", notifError.message);
    }

    setRows((prev) =>
      prev.map((r) =>
        r.studentId === row.studentId
          ? {
              ...r,
              prelim: String(nextPrelim),
              midterm: String(nextMidterm),
              final_exam: String(nextFinalExam),
            }
          : r
      )
    );
    setSaved((prev) => ({ ...prev, [row.studentId]: true }));
    setLocked((prev) => ({ ...prev, [row.studentId]: true }));
    setSaving((prev) => ({ ...prev, [row.studentId]: false }));
  };

  const addScoreColumn = (type) => {
    if (scoreColumns.some((c) => c.type === type)) {
      setShowAddColumnMenu(false);
      return;
    }
    const nextCols = [...scoreColumns, { id: `${type}-${nextColIdRef.current++}`, type, required: false }];
    setScoreColumns(nextCols);
    const key = getActivityKey(activeActivity);
    setActivityColumnTypes((prev) => ({ ...prev, [key]: nextCols.map((c) => c.type) }));
    setShowAddColumnMenu(false);
  };

  const removeScoreColumn = (id) => {
    const col = scoreColumns.find((c) => c.id === id);
    if (!col || col.required) return;
    const nextCols = scoreColumns.filter((c) => c.id !== id);
    setScoreColumns(nextCols);
    const key = getActivityKey(activeActivity);
    setActivityColumnTypes((prev) => ({ ...prev, [key]: nextCols.map((c) => c.type) }));
  };

  const saveAll = async () => {
    const visibleTypes = Array.from(new Set(scoreColumns.map((c) => c.type)));
    const rowsToSave = rows.filter(
      (r) => !locked[r.studentId] && hasVisibleInputForSave(r.scores, visibleTypes)
    );
    for (const row of rowsToSave) {
      await saveRow(row);
    }
  };

  const editRow = (studentId) => {
    setLocked((prev) => ({ ...prev, [studentId]: false }));
    setSaved((prev) => ({ ...prev, [studentId]: false }));
  };

  const applyActivityForm = () => {
    const item = String(activityForm.item || activityForm.type).trim();
    if (!item) {
      setErr("Activity name is required.");
      return;
    }
    const maxScore = Number(activityForm.maxScore || 0);
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      setErr("Max score must be greater than 0.");
      return;
    }

    setErr("");
    const newActivity = buildActivity({ ...activityForm, type: "Attendance", item, maxScore: String(maxScore) });
    setActivities((prev) => [...prev, newActivity]);
    setActiveActivityId(newActivity.id);
    const key = getActivityKey(newActivity);
    setActivityColumnTypes((prev) => ({ ...prev, [key]: ["Attendance"] }));
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        scores: { Attendance: "", Quiz: "", Activity: "", Exam: "" },
      }))
    );
    setSaved({});
    setLocked({});
    setShowBuilder(false);
    setActivityForm({
      item: "",
      date: todayInputDate(),
      term: "prelim",
      type: "Attendance",
      maxScore: "",
    });
  };

  const deleteActiveActivity = async () => {
    if (!activeActivity || !selectedId) return;
    const ok = window.confirm(`Delete "${activeActivity.item}" on ${activeActivity.date}?`);
    if (!ok) return;

    setErr("");

    if (supportsPerformanceLogs) {
      const { error: delLogErr } = await supabase
        .from("student_performance_logs")
        .delete()
        .eq("course_id", selectedId)
        .eq("event_date", activeActivity.date)
        .eq("item", activeActivity.item);

      if (delLogErr) {
        setErr(delLogErr.message);
        return;
      }
    }

    const remaining = activities.filter((a) => a.id !== activeActivity.id);
    if (!remaining.length) {
      setActivities([]);
      setActiveActivityId("");
      setLocked({});
    } else {
      setActivities(remaining);
      setActiveActivityId(remaining[0].id);
    }

    await recomputeTermForAllStudents(selectedId, activeActivity.term);
    await refreshSelectedCourseGrades();
  };

  const computeTermSummaryForCourse = useCallback(async (courseId, termKey) => {
    if (!courseId) {
      setComputeRows([]);
      return;
    }
    if (!supportsPerformanceLogs) {
      setComputeErr("Timeline table `student_performance_logs` is not available.");
      setComputeRows([]);
      return;
    }

    setComputeLoading(true);
    setComputeErr("");

    const { data: enrollData, error: enrollErr } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", courseId)
      .order("student_id");

    if (enrollErr) {
      setComputeErr(enrollErr.message);
      setComputeRows([]);
      setComputeLoading(false);
      return;
    }

    const studentIds = [...new Set((enrollData || []).map((e) => e.student_id).filter(Boolean))];
    if (!studentIds.length) {
      setComputeRows([]);
      setComputeLoading(false);
      return;
    }

    const [{ data: profileRows, error: profileErr }, { data: logRows, error: logsErr }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, student_no").in("id", studentIds),
      supabase
        .from("student_performance_logs")
        .select("student_id, type, score, note")
        .eq("course_id", courseId)
        .in("student_id", studentIds),
    ]);

    if (profileErr) {
      setComputeErr(profileErr.message);
      setComputeRows([]);
      setComputeLoading(false);
      return;
    }
    if (logsErr) {
      setComputeErr(logsErr.message);
      setComputeRows([]);
      setComputeLoading(false);
      return;
    }

    const profileMap = new Map((profileRows || []).map((p) => [p.id, p]));
    const grouped = {};
    for (const sid of studentIds) {
      grouped[sid] = { Attendance: [], Quiz: [], Activity: [], Exam: [] };
    }

    for (const log of logRows || []) {
      if (parseTermFromNote(log.note) !== termKey) continue;
      if (!grouped[log.student_id]) continue;
      if (!Object.prototype.hasOwnProperty.call(grouped[log.student_id], log.type)) continue;
      const pct = parseScoreToPct(log.score);
      if (pct == null) continue;
      grouped[log.student_id][log.type].push(pct);
    }

    const avg = (arr) => (arr.length ? +(arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(2) : null);
    const out = studentIds.map((sid) => {
      const p = profileMap.get(sid);
      const attendance = avg(grouped[sid].Attendance);
      const quiz = avg(grouped[sid].Quiz);
      const activity = avg(grouped[sid].Activity);
      const exam = avg(grouped[sid].Exam);
      const hasAny = [attendance, quiz, activity, exam].some((v) => v != null);
      const weighted = hasAny
        ? computeNormalizedTermGrade(attendance, quiz, activity, exam)
        : null;
      return {
        studentId: sid,
        studentNo: p?.student_no || "-",
        name: p?.full_name || "-",
        attendance,
        quiz,
        activity,
        exam,
        weighted,
      };
    });

    out.sort((a, b) => String(a.studentNo).localeCompare(String(b.studentNo)));
    setComputeRows(out);
    setComputeLoading(false);
  }, [supportsPerformanceLogs]);

  useEffect(() => {
    if (!showComputePanel) return;
    const run = async () => {
      if (!computeCourseId) {
        setComputeRows([]);
        return;
      }
      await computeTermSummaryForCourse(computeCourseId, computeTerm);
    };
    run();
  }, [showComputePanel, computeCourseId, computeTerm, computeTermSummaryForCourse]);

  const openComputePanel = () => {
    setComputeCourseId((prev) => prev || selectedId || String(courses[0]?.id || ""));
    setComputeTerm(activeActivity?.term || "prelim");
    setShowComputePanel(true);
  };

  if (loading) return <div style={{ padding: 40 }}>Loading Grade Entry...</div>;

  const activeTermLabel = TERM_OPTIONS.find((t) => t.value === activeActivity?.term)?.label || "Prelim";
  const filteredActivities = activities.filter((activity) => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return true;
    const hay = `${activity.item} ${activity.date}`.toLowerCase();
    return hay.includes(q);
  });
  const groupedByDate = filteredActivities.reduce((acc, activity) => {
    if (!acc[activity.date]) acc[activity.date] = [];
    acc[activity.date].push(activity);
    return acc;
  }, {});
  const orderedDates = Object.keys(groupedByDate).sort((a, b) => String(b).localeCompare(String(a)));

  return (
    <div style={{ width: "100%" }}>
      <h1 style={{ fontWeight: 900, fontSize: isMobile ? 22 : 26, marginBottom: 20, color: "#111827" }}>
        Grade Entry
      </h1>

      <div style={topCard}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            flexDirection: isMobile ? "column" : "row",
            alignContent: isMobile ? "stretch" : "initial",
          }}
        >
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              height: 42,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 13,
              background: "white",
              minWidth: isMobile ? 0 : 260,
              width: isMobile ? "100%" : "auto",
              fontWeight: 600,
            }}
          >
            <option value="">- Select a Course -</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.code}] {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              setShowBuilder((v) => {
                const next = !v;
                if (next) {
                  setActivityForm({
                    item: "",
                    date: todayInputDate(),
                    term: "prelim",
                    type: "Attendance",
                    maxScore: "",
                  });
                }
                return next;
              })
            }
            style={btnBlue}
          >
            {showBuilder ? "Close Activity" : "New Grade Activity"}
          </button>

          {rows.length > 0 && (
            <button
              onClick={saveAll}
              disabled={!rows.some((r) => !locked[r.studentId])}
              style={{ ...btnGreen, opacity: rows.some((r) => !locked[r.studentId]) ? 1 : 0.6 }}
            >
              Save All
            </button>
          )}

          <button onClick={openComputePanel} style={btnSlate}>
            Compute
          </button>
        </div>

      </div>

      <div style={folderBoard}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#374151", marginBottom: 8 }}>Activity Folders</div>
          <div style={searchWrap}>
            <input
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
              placeholder="Search date or activity..."
              style={searchInput}
            />
          </div>
        </div>
        {orderedDates.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6b7280" }}>No activity folders found.</div>
        ) : (
          orderedDates.map((dateKey) => (
            <div key={dateKey} style={folderDateGroup}>
              <div style={folderDateLabel}>{dateKey}</div>
              <div style={folderWrap}>
                {groupedByDate[dateKey].map((activity, idx) => {
                  const isActive = activity.id === activeActivityId;
                  return (
                    <button
                      key={activity.id}
                      onClick={() => setActiveActivityId(activity.id)}
                      style={{
                        ...folderButton,
                        border: isActive ? "1px solid #2f6fb3" : "1px solid rgba(0,0,0,0.14)",
                        background: isActive ? "#eff6ff" : "#ffffff",
                        color: isActive ? "#1d4ed8" : "#374151",
                      }}
                      title={`${activity.type} | ${activity.item} | ${activity.date}`}
                    >
                      {activity.item} #{idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {showBuilder && (
        <div style={builderCard}>
          <div style={{ fontWeight: 900, color: "#111827", marginBottom: 10 }}>Create Working Grade Activity</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr 1fr auto", gap: 8 }}>
            <input
              value={activityForm.item}
              onChange={(e) => setActivityForm((p) => ({ ...p, item: e.target.value }))}
              placeholder="Activity name (e.g., Attendance)"
              style={inputBox}
            />

            <input
              type="date"
              value={activityForm.date}
              onChange={(e) => setActivityForm((p) => ({ ...p, date: e.target.value }))}
              style={inputBox}
            />

            <select
              value={activityForm.term}
              onChange={(e) => setActivityForm((p) => ({ ...p, term: e.target.value }))}
              style={inputBox}
            >
              {TERM_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={1}
              step="any"
              value={activityForm.maxScore}
              onChange={(e) => setActivityForm((p) => ({ ...p, maxScore: e.target.value.replace(/[^0-9.]/g, "") }))}
              placeholder="Max score"
              style={inputBox}
            />

            <button onClick={applyActivityForm} style={btnBlue}>
              Add Activity Folder
            </button>
          </div>
        </div>
      )}

      <div style={activityMetaRow}>
        <div style={activityMeta}>
          {activeActivity
            ? (<>{activeTermLabel} | {activeActivity.item} | {activeActivity.date} | Points: {activeActivity.maxScore}</>)
            : (<>No activity folder selected yet.</>)}
        </div>
        {selectedId && activeActivity && (
          <button onClick={deleteActiveActivity} style={btnDanger}>
            Delete Folder
          </button>
        )}
      </div>

      {err && <div style={errBox}>{err}</div>}

      {!supportsPerformanceLogs && (
        <div style={warnBox}>
          Timeline table `student_performance_logs` is not available. Scores still save to grades.
        </div>
      )}

      {!selectedId ? (
        <div style={emptyBox}>Select a course above to enter grades.</div>
      ) : !activeActivity ? (
        <div style={emptyBox}>No activity folder yet. Click <b>New Grade Activity</b> to create one.</div>
      ) : rows.length === 0 ? (
        <div style={emptyBox}>No students enrolled in this course yet.</div>
      ) : (
        <div style={tableWrap}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
  <thead>
    <tr style={{ background: "#f8fafc" }}>
      <th style={thCenter}>Student ID</th>
      <th style={thLeft}>Student Name</th>
      <th style={{ ...thCenter, position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span>{activeTermLabel} Attendance</span>
          <button onClick={() => setShowAddColumnMenu((v) => !v)} style={scoreTypeToggle} title="Add column">
            {showAddColumnMenu ? "x" : "+"}
          </button>
        </div>
        {showAddColumnMenu && (
          <div style={columnMenu}>
            {ADDABLE_SCORE_TYPES.map((type) => (
              <button key={type} onClick={() => addScoreColumn(type)} style={columnChoiceBtn}>
                {type}
              </button>
            ))}
          </div>
        )}
      </th>
      {scoreColumns
        .filter((c) => c.type !== "Attendance")
        .map((col) => (
          <th key={col.id} style={thCenter}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>{col.type}</span>
              <button style={colDeleteBtn} onClick={() => removeScoreColumn(col.id)} title={`Remove ${col.type}`}>
                x
              </button>
            </div>
          </th>
        ))}
      <th style={thCenter}>Average</th>
      <th style={thCenter}>Action</th>
    </tr>
  </thead>
  <tbody>
    {rows.map((row) => {
      const status = String(row.scores?.Attendance || "");
      const attendanceColors = getAttendanceColors(status);
      const max = Number(activeActivity.maxScore || 0);
      const pctValues = [];
      const attendancePts = ATTENDANCE_STATUS_POINTS[status];
      if (attendancePts != null) pctValues.push(+(attendancePts * 100).toFixed(2));
      const extraCols = scoreColumns.filter((c) => c.type !== "Attendance");
      let hasBlankExtra = false;
      for (const col of extraCols) {
        const rawText = String(row.scores?.[col.type] ?? "").trim();
        if (!rawText) {
          hasBlankExtra = true;
          continue;
        }
        const raw = Number(row.scores?.[col.type] ?? "");
        if (Number.isFinite(raw) && max > 0) pctValues.push(+((raw / max) * 100).toFixed(2));
      }
      const dayAvg = hasBlankExtra
        ? null
        : pctValues.length
        ? +(pctValues.reduce((s, n) => s + n, 0) / pctValues.length).toFixed(2)
        : null;
      const isSaved = saved[row.studentId];
      const isSaving = saving[row.studentId];
      const isLocked = !!locked[row.studentId];
      return (
        <tr key={row.studentId} style={{ borderBottom: "1px solid #f1f5f9" }}>
          <td style={{ ...tdC, fontWeight: 700, color: "#2f6fb3", whiteSpace: "nowrap" }}>{row.studentNo}</td>
          <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{row.name}</td>
          <td style={tdC}>
            <select
              value={status}
              onChange={(e) => updateEntryScore(row.studentId, "Attendance", e.target.value)}
              disabled={isLocked}
              style={{
                ...scoreInput,
                width: 130,
                background: attendanceColors.background,
                color: attendanceColors.color,
                border: `1px solid ${attendanceColors.border}`,
                fontWeight: 700,
                opacity: isLocked ? 0.8 : 1,
              }}
            >
              <option value="">Select</option>
              {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </td>
          {scoreColumns
            .filter((c) => c.type !== "Attendance")
            .map((col) => (
              <td key={col.id} style={tdC}>
                {(() => {
                  const rawText = String(row.scores?.[col.type] ?? "");
                  const colors = getScoreColors(rawText, Number(activeActivity.maxScore) || 0);
                  return (
                <input
                  type="number"
                  min={0}
                  step="any"
                  max={Number(activeActivity.maxScore) || undefined}
                  value={row.scores?.[col.type] ?? ""}
                  onChange={(e) => updateEntryScore(row.studentId, col.type, e.target.value)}
                  disabled={isLocked}
                  style={{
                    ...scoreInput,
                    background: colors.background,
                    color: colors.color,
                    border: `1px solid ${colors.border}`,
                    fontWeight: 700,
                    opacity: isLocked ? 0.8 : 1,
                  }}
                  placeholder=""
                />
                  );
                })()}
              </td>
            ))}
          <td style={tdC}>
            <span
              style={{
                fontWeight: 900,
                fontSize: 14,
                color: dayAvg == null ? "#9ca3af" : dayAvg >= 75 ? "#16a34a" : "#dc2626",
              }}
            >
              {dayAvg == null ? "-" : `${dayAvg}%`}
            </span>
          </td>
          <td style={tdC}>
            {isLocked ? (
              <button
                onClick={() => editRow(row.studentId)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#111827",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => saveRow(row)}
                disabled={isSaving}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: isSaved ? "#dcfce7" : "#2f6fb3",
                  color: isSaved ? "#166534" : "white",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {isSaving ? "Saving..." : isSaved ? "Saved" : "Save"}
              </button>
            )}
          </td>
        </tr>
      );
    })}
  </tbody>
</table>

          <div style={{ marginTop: 10, fontSize: 11, color: "#9ca3af" }}>
            Average column shows the selected activity/day score converted to percent.
          </div>
          <div style={weightsHint}>
            Term Weights: Attendance 20%, Quiz 20%, Activities/Projects 30%, Exam 40%.
            Attendance colors: Present=Green, Late=Yellow, Absent=Red, Exempted/Excused=Gray.
          </div>
        </div>
      )}

      {showComputePanel && (
        <div style={computeOverlay} onClick={() => setShowComputePanel(false)}>
          <div style={computePanel} onClick={(e) => e.stopPropagation()}>
            <div style={computeHeader}>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#111827" }}>Compute Term Grades</div>
              <button onClick={() => setShowComputePanel(false)} style={computeCloseBtn}>
                x
              </button>
            </div>

            <div style={computeControls}>
              <select
                value={computeCourseId}
                onChange={(e) => setComputeCourseId(e.target.value)}
                style={{ ...inputBox, minWidth: 220 }}
              >
                <option value="">Select subject</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {c.title}
                  </option>
                ))}
              </select>

              <select value={computeTerm} onChange={(e) => setComputeTerm(e.target.value)} style={inputBox}>
                {TERM_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => computeTermSummaryForCourse(computeCourseId, computeTerm)}
                style={btnBlue}
                disabled={!computeCourseId || computeLoading}
              >
                {computeLoading ? "Computing..." : "Refresh"}
              </button>
            </div>

            {computeErr && <div style={{ ...errBox, marginBottom: 10 }}>{computeErr}</div>}

            {!computeCourseId ? (
              <div style={emptyBox}>Select a subject to compute grades.</div>
            ) : computeLoading ? (
              <div style={emptyBox}>Computing term grades...</div>
            ) : computeRows.length === 0 ? (
              <div style={emptyBox}>No student data found for this subject/term.</div>
            ) : (
              <div style={computeTableWrap}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={thCenter}>#</th>
                      <th style={thCenter}>Student No.</th>
                      <th style={thLeft}>Student Name</th>
                      <th style={thCenter}>Attendance</th>
                      <th style={thCenter}>Quiz</th>
                      <th style={thCenter}>Activity</th>
                      <th style={thCenter}>Exam</th>
                      <th style={thCenter}>
                        {TERM_OPTIONS.find((t) => t.value === computeTerm)?.label || "Term"} Grade
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {computeRows.map((r, idx) => (
                      <tr key={r.studentId} style={{ borderBottom: "1px solid #eef2f7" }}>
                        <td style={tdC}>{idx + 1}</td>
                        <td style={tdC}>{r.studentNo}</td>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r.name}</td>
                        <td style={tdC}>{r.attendance == null ? "-" : `${r.attendance.toFixed(2)}%`}</td>
                        <td style={tdC}>{r.quiz == null ? "-" : `${r.quiz.toFixed(2)}%`}</td>
                        <td style={tdC}>{r.activity == null ? "-" : `${r.activity.toFixed(2)}%`}</td>
                        <td style={tdC}>{r.exam == null ? "-" : `${r.exam.toFixed(2)}%`}</td>
                        <td style={tdC}>
                          <span
                            style={{
                              fontWeight: 900,
                              color: r.weighted == null ? "#9ca3af" : r.weighted >= 75 ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {r.weighted == null ? "-" : `${r.weighted.toFixed(2)}%`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={weightsHint}>
                  Formula: Attendance 20% + Quiz 20% + Activity 30% + Exam 40% (per selected term).
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const topCard = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  padding: 10,
  marginBottom: 12,
};

const btnBlue = {
  height: 42,
  padding: "0 18px",
  borderRadius: 10,
  border: "none",
  background: "#111827",
  color: "white",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const btnGreen = {
  height: 42,
  padding: "0 18px",
  borderRadius: 10,
  border: "none",
  background: "#57b447",
  color: "white",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const btnSlate = {
  height: 42,
  padding: "0 18px",
  borderRadius: 10,
  border: "none",
  background: "#334155",
  color: "white",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const btnDanger = {
  height: 34,
  padding: "0 14px",
  borderRadius: 10,
  border: "none",
  background: "#dc2626",
  color: "white",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};

const builderCard = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
};

const searchWrap = {
  marginBottom: 0,
  width: "100%",
};

const searchInput = {
  width: "min(100%, 360px)",
  height: 34,
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  padding: "0 12px",
  fontSize: 13,
  background: "white",
};

const folderBoard = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  padding: 10,
  marginBottom: 12,
};

const folderDateGroup = {
  marginBottom: 8,
};

const folderDateLabel = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 800,
  marginBottom: 6,
};

const folderWrap = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 4,
};

const folderButton = {
  height: 34,
  padding: "0 12px",
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const activityMeta = {
  padding: "8px 10px",
  borderRadius: 10,
  marginBottom: 0,
  fontSize: 12,
  color: "#1f2937",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  flex: 1,
};

const activityMetaRow = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  marginBottom: 12,
  flexWrap: "wrap",
};

const weightsHint = {
  marginTop: 8,
  fontSize: 11,
  color: "#6b7280",
};

const inputBox = {
  height: 38,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.15)",
  fontSize: 13,
  background: "white",
};

const errBox = {
  padding: "10px 14px",
  borderRadius: 8,
  background: "#fee2e2",
  color: "#991b1b",
  marginBottom: 12,
  fontWeight: 700,
  fontSize: 13,
};

const warnBox = {
  padding: "10px 14px",
  borderRadius: 8,
  background: "#fff7ed",
  color: "#9a3412",
  marginBottom: 12,
  fontWeight: 700,
  fontSize: 12,
};

const tableWrap = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  overflowX: "auto",
};

const computeOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.28)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1100,
  padding: 16,
};

const computePanel = {
  width: "min(1100px, 96vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#ffffff",
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
};

const computeHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const computeCloseBtn = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
  lineHeight: "1",
};

const computeControls = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 10,
  alignItems: "center",
};

const computeTableWrap = {
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 10,
  overflowX: "auto",
  background: "#fff",
};

const scoreInput = {
  width: 90,
  textAlign: "center",
  padding: "4px 6px",
  borderRadius: 6,
  border: "1px solid rgba(0,0,0,0.15)",
  fontSize: 13,
  outline: "none",
};

const scoreTypeToggle = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "none",
  background: "#111827",
  color: "#fff",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  fontWeight: 900,
};

const columnMenu = {
  position: "absolute",
  top: 34,
  right: 0,
  zIndex: 5,
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 10,
  boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
  padding: 6,
  display: "grid",
  gap: 4,
  minWidth: 120,
};

const columnChoiceBtn = {
  height: 32,
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.1)",
  background: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const colDeleteBtn = {
  width: 18,
  height: 18,
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff",
  color: "#111827",
  fontSize: 10,
  lineHeight: "16px",
  fontWeight: 900,
  cursor: "pointer",
  padding: 0,
};

const emptyBox = {
  padding: "40px 20px",
  textAlign: "center",
  color: "#6b7280",
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  fontSize: 13,
};

const tdC = {
  padding: "8px 12px",
  verticalAlign: "middle",
  textAlign: "center",
};

const thLeft = {
  padding: "10px 12px",
  textAlign: "left",
  fontWeight: 800,
  color: "#374151",
  borderBottom: "2px solid #e5e7eb",
  whiteSpace: "nowrap",
  background: "#f8fafc",
};

const thCenter = {
  padding: "10px 12px",
  textAlign: "center",
  fontWeight: 800,
  color: "#374151",
  borderBottom: "2px solid #e5e7eb",
  whiteSpace: "nowrap",
  background: "#f8fafc",
};


