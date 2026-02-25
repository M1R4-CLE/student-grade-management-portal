"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

function getCourseImg(title = "") {
  const t = title.toLowerCase();
  if (t.includes("data struct") || t.includes("algorithm")) return "/images/dsa.jpg";
  if (t.includes("database") || t.includes("dbms")) return "/images/dms.jpg";
  if (t.includes("systems analysis") || t.includes("sad")) return "/images/sad.jpg";
  if (t.includes("object") || t.includes("oop")) return "/images/oop.jpg";
  if (t.includes("ethics")) return "/images/ethics.jpg";
  if (t.includes("quantitative") || t.includes("statistic")) return "/images/qms.jpg";
  if (t.includes("web")) return "/images/wed.jpg";
  if (t.includes("human") || t.includes("hci")) return "/images/hci.jpg";
  if (t.includes("software")) return "/images/soe.jpg";
  return "/images/dsa.jpg";
}

export default function StudentCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { router.replace("/login"); return; }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (pErr || !profile) { router.replace("/login"); return; }
      if (profile.role !== "student") { router.replace("/teacher/Dashboard"); return; }

      // Join enrollments → courses → teacher profile
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id, courses(id, code, title, profiles!courses_teacher_id_fkey(full_name))")
        .eq("student_id", user.id);

      if (error) {
        setErr(error.message);
        setCourses([]);
      } else {
        const mapped = (data || [])
          .map((r) => r.courses)
          .filter(Boolean)
          .map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            instructor: c.profiles?.full_name || "Instructor",
            img: getCourseImg(c.title),
          }));
        setCourses(mapped);
      }

      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) return <div style={{ padding: 24 }}>Loading courses...</div>;

  return (
    <div style={{ width: "100%" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 20 }}>My Courses</div>
        <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
          {courses.length} enrolled course{courses.length !== 1 ? "s" : ""}
        </div>
      </div>

      {err && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", marginBottom: 12, fontWeight: 700, fontSize: 13 }}>
          {err}
        </div>
      )}

      {courses.length === 0 ? (
        <div className="glassCard" style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
          You are not enrolled in any courses yet. Please contact your teacher or administrator.
        </div>
      ) : (
        <div className="courseGrid">
          {courses.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Card image */}
              <div className="courseCardImg">
                <img src={c.img} alt={c.title} />
                <div className="courseOverlay">
                  <div className="courseOverlayText">
                    <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>{c.code}</div>
                    {c.title}
                  </div>
                </div>
              </div>

              {/* Card info below image */}
              <div
                style={{
                  background: "rgba(255,255,255,.85)",
                  border: "1px solid rgba(0,0,0,.07)",
                  borderTop: "none",
                  borderRadius: "0 0 22px 22px",
                  padding: "10px 14px",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 13, color: "#111827" }}>{c.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  👤 {c.instructor}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}