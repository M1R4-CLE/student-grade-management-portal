"use client";

// ============================================================
// FILE: src/app/teacher/ClassManagement/page.jsx
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

function getExt(fileName) {
  const parts = String(fileName || "").split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
  return ext === "jpeg" ? "jpg" : ext || "jpg";
}

const PAGE_SIZE = 4;

export default function TeacherClassManagementPage() {
  const router = useRouter();

  const [loading, setLoading]       = useState(true);
  const [teacherId, setTeacherId]   = useState(null);

  // Courses
  const [courses, setCourses]       = useState([]);
  const [page, setPage]             = useState(1);

  // Add-course form
  const [newCode, setNewCode]       = useState("");
  const [newTitle, setNewTitle]     = useState("");
  const [addErr, setAddErr]         = useState("");
  const [addBusy, setAddBusy]       = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCourseId, setDeleteCourseId] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr]   = useState("");
  const [courseMetaSupported, setCourseMetaSupported] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [editForm, setEditForm] = useState({ code: "", title: "", cover_path: "", cover_url: "" });

  // Selected course + roster
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [roster, setRoster]                 = useState([]);
  const [rosterLoading, setRosterLoading]   = useState(false);

  // ── Auth ────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "teacher") {
        router.replace("/student/Dashboard");
        return;
      }

      setTeacherId(user.id);
      await fetchCourses(user.id);
      setLoading(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Fetch courses ───────────────────────────────────────────
  const toCoverUrl = useCallback(async (path) => {
    if (!path) return "";
    const { data } = await supabase.storage.from("course-covers").createSignedUrl(path, 1800);
    return data?.signedUrl || "";
  }, []);

  const fetchCourses = useCallback(async (tid) => {
    const id = tid || teacherId;
    if (!id) return [];

    let rows = [];
    const withMeta = await supabase
      .from("courses")
      .select("id, code, title, cover_path")
      .eq("teacher_id", id)
      .order("id", { ascending: true });

    if (!withMeta.error) {
      setCourseMetaSupported(true);
      rows = withMeta.data || [];
    } else {
      setCourseMetaSupported(false);
      const basic = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("teacher_id", id)
        .order("id", { ascending: true });
      rows = (basic.data || []).map(c => ({ ...c, cover_path: "" }));
    }

    const withUrl = await Promise.all(
      rows.map(async c => ({
        ...c,
        cover_path: c.cover_path || "",
        cover_url: await toCoverUrl(c.cover_path || ""),
      }))
    );

    setCourses(withUrl);
    return withUrl;
  }, [teacherId, toCoverUrl]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(courses.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [courses.length, page]);

  // ── Add course ──────────────────────────────────────────────
  const handleAddCourse = async () => {
    const code  = newCode.trim();
    const title = newTitle.trim();
    if (!code || !title) { setAddErr("Please fill in both Course Code and Course Title."); return; }
    if (!teacherId) return;

    setAddBusy(true);
    setAddErr("");

    const { error } = await supabase
      .from("courses")
      .insert({ code, title, teacher_id: teacherId });

    if (error) {
      setAddErr(
        error.message.includes("duplicate") || error.message.includes("unique")
          ? "A course with that code already exists."
          : error.message
      );
    } else {
      setNewCode("");
      setNewTitle("");
      await fetchCourses();
    }
    setAddBusy(false);
  };

  const openDeleteModal = () => {
    if (courses.length === 0) return;
    setDeleteErr("");
    setDeleteCourseId(String(selectedCourse?.id || courses[0]?.id || ""));
    setDeleteOpen(true);
  };

  const handleDeleteCourse = async () => {
    if (!deleteCourseId) {
      setDeleteErr("Please select a course to delete.");
      return;
    }
    if (!teacherId) return;

    setDeleteBusy(true);
    setDeleteErr("");

    const courseId = Number(deleteCourseId);

    const { error: enrollErr } = await supabase
      .from("enrollments")
      .delete()
      .eq("course_id", courseId);

    if (enrollErr) {
      setDeleteErr(enrollErr.message);
      setDeleteBusy(false);
      return;
    }

    const { error: deleteCourseErr } = await supabase
      .from("courses")
      .delete()
      .eq("id", courseId)
      .eq("teacher_id", teacherId);

    if (deleteCourseErr) {
      setDeleteErr(deleteCourseErr.message);
      setDeleteBusy(false);
      return;
    }

    if (String(selectedCourse?.id) === String(courseId)) {
      setSelectedCourse(null);
      setRoster([]);
    }

    await fetchCourses();
    setDeleteOpen(false);
    setDeleteBusy(false);
  };

  const startEditCourse = () => {
    if (!selectedCourse) return;
    setEditErr("");
    setCoverFile(null);
    setEditForm({
      code: selectedCourse.code || "",
      title: selectedCourse.title || "",
      cover_path: selectedCourse.cover_path || "",
      cover_url: selectedCourse.cover_url || "",
    });
    setEditMode(true);
  };

  const cancelEditCourse = () => {
    setEditMode(false);
    setEditErr("");
    setCoverFile(null);
  };

  const onCoverSelected = async (file) => {
    if (!file) return;
    const okTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!okTypes.includes(file.type)) {
      setEditErr("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setEditErr("Cover image must be 3MB or less.");
      return;
    }
    setEditErr("");
    setCoverFile(file);
    setCoverBusy(true);
    const localUrl = URL.createObjectURL(file);
    setEditForm(prev => ({ ...prev, cover_url: localUrl }));
    setCoverBusy(false);
  };

  const saveEditCourse = async () => {
    if (!selectedCourse || !teacherId) return;
    const code = editForm.code.trim();
    const title = editForm.title.trim();
    if (!code || !title) {
      setEditErr("Course code and title are required.");
      return;
    }

    setEditBusy(true);
    setEditErr("");

    let coverPath = editForm.cover_path || "";
    if (coverFile) {
      if (!courseMetaSupported) {
        setEditErr("Cover image save needs a 'cover_path' column in courses table.");
        setEditBusy(false);
        return;
      }
      const ext = getExt(coverFile.name);
      const path = `${teacherId}/${selectedCourse.id}/cover-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("course-covers")
        .upload(path, coverFile, { cacheControl: "3600", upsert: true, contentType: coverFile.type });
      if (upErr) {
        setEditErr(`Cover upload failed: ${upErr.message}`);
        setEditBusy(false);
        return;
      }
      coverPath = path;
    }

    const payload = { code, title };
    if (courseMetaSupported) payload.cover_path = coverPath;

    const { error } = await supabase
      .from("courses")
      .update(payload)
      .eq("id", selectedCourse.id)
      .eq("teacher_id", teacherId);

    if (error) {
      setEditErr(error.message);
      setEditBusy(false);
      return;
    }

    const updatedCourses = await fetchCourses();
    const updatedSelected = updatedCourses.find(c => c.id === selectedCourse.id) || null;
    setSelectedCourse(updatedSelected);
    setEditMode(false);
    setCoverFile(null);
    setEditBusy(false);
  };

  useEffect(() => {
    if (!selectedCourse) {
      if (editMode) setEditMode(false);
      return;
    }
    const fresh = courses.find(c => c.id === selectedCourse.id);
    if (fresh && (fresh.code !== selectedCourse.code || fresh.title !== selectedCourse.title || fresh.cover_path !== selectedCourse.cover_path)) {
      setSelectedCourse(fresh);
    }
  }, [courses, selectedCourse, editMode]);

  // ── Load roster ─────────────────────────────────────────────
  const loadRoster = async (course) => {
    if (selectedCourse?.id === course.id) {
      setSelectedCourse(null);
      setRoster([]);
      setEditMode(false);
      return;
    }
    setSelectedCourse(course);
    setEditMode(false);
    setEditErr("");
    setCoverFile(null);
    setRosterLoading(true);
    setRoster([]);

    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id, enrolled_at,
        profiles!enrollments_student_id_fkey(id, full_name, student_no, email)
      `)
      .eq("course_id", course.id)
      .order("enrolled_at", { ascending: true });

    if (!error) {
      setRoster(
        (data || []).map(e => ({
          enrollId:   e.id,
          studentId:  e.profiles?.id,
          name:       e.profiles?.full_name  || "-",
          studentNo:  e.profiles?.student_no || "-",
          email:      e.profiles?.email      || "-",
          enrolledAt: new Date(e.enrolled_at).toLocaleDateString(),
        }))
      );
    }
    setRosterLoading(false);
  };

  // ── Pagination ──────────────────────────────────────────────
  const totalPages     = Math.max(1, Math.ceil(courses.length / PAGE_SIZE));
  const visibleCourses = courses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div style={{ padding: 40 }}>Loading Class Management...</div>;

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
    <div className="classMgmtScroll" style={pageScrollWrap}>

      {/* Title */}
      <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 20, color: "#111827" }}>
        Class Management
      </h1>

      {/* Add Course Bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <input
          value={newCode}
          onChange={e => { setNewCode(e.target.value); setAddErr(""); }}
          placeholder="Course Code (e.g., IT101)"
          style={inputStyle}
          maxLength={20}
        />
        <input
          value={newTitle}
          onChange={e => { setNewTitle(e.target.value); setAddErr(""); }}
          placeholder="Course Title (e.g., Programming 1)"
          style={{ ...inputStyle, minWidth: 220 }}
          maxLength={80}
          onKeyDown={e => e.key === "Enter" && handleAddCourse()}
        />
        <button onClick={handleAddCourse} disabled={addBusy} style={addBtn}>
          {addBusy ? "Adding..." : "Add Course"}
        </button>
        <button
          onClick={openDeleteModal}
          disabled={courses.length === 0 || addBusy || deleteBusy || editBusy}
          style={deleteBtn}
        >
          Delete Course
        </button>
        {selectedCourse && !editMode && (
          <button
            onClick={startEditCourse}
            disabled={addBusy || deleteBusy || editBusy}
            style={editBtn}
          >
            Edit Course
          </button>
        )}
        {selectedCourse && editMode && (
          <>
            <button
              onClick={saveEditCourse}
              disabled={editBusy || coverBusy}
              style={saveEditBtn}
            >
              {editBusy ? "Saving..." : "Save Edit"}
            </button>
            <button
              onClick={cancelEditCourse}
              disabled={editBusy}
              style={cancelEditBtn}
            >
              Cancel
            </button>
          </>
        )}
        {addErr && (
          <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 700 }}>{addErr}</span>
        )}
      </div>

      {/* Course Cards */}
      <div style={sectionCard}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: "#111827" }}>
          Select Course
        </div>

        {courses.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 14, padding: "20px 0" }}>
            No courses yet. Add your first course above.
          </div>
        ) : (
          <>
            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 18,
              }}
            >
              {visibleCourses.map(c => {
                const active = selectedCourse?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => loadRoster(c)}
                    style={{
                      cursor: "pointer",
                      borderRadius: 12,
                      overflow: "hidden",
                      border: active ? "2px solid #2f6fb3" : "2px solid transparent",
                      boxShadow: active
                        ? "0 6px 20px rgba(47,111,179,0.25)"
                        : "0 4px 12px rgba(0,0,0,0.10)",
                      background: "white",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {/* Book cover */}
                    <div style={{ height: 200, overflow: "hidden" }}>
                      {c.cover_url ? (
                        <img
                          src={c.cover_url}
                          alt={c.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div style={noCoverBox}>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>No cover yet</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                            Teacher can upload a cover
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Info below cover */}
                    <div style={{ padding: "10px 12px 12px" }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "#111827", lineHeight: 1.3 }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, fontWeight: 600 }}>
                        Class Code: {c.code}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 18 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={pageBtn}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  style={{
                    ...pageBtn,
                    background: page === i + 1 ? "#2f6fb3" : "white",
                    color:      page === i + 1 ? "white"   : "#374151",
                    fontWeight: page === i + 1 ? 800       : 600,
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={pageBtn}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {selectedCourse && editMode && (
        <div style={{ ...sectionCard, marginTop: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, color: "#111827" }}>
            Edit Course
          </div>

          <div style={editGrid}>
            <div>
              <div style={editLabel}>Course Title</div>
              <input
                value={editForm.title}
                onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                style={inputStyle}
                maxLength={80}
              />
            </div>

            <div>
              <div style={editLabel}>Course Code</div>
              <input
                value={editForm.code}
                onChange={e => setEditForm(prev => ({ ...prev, code: e.target.value }))}
                style={inputStyle}
                maxLength={20}
              />
            </div>

            <div>
              <div style={editLabel}>Cover Page</div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={e => onCoverSelected(e.target.files?.[0])}
                style={fileInputStyle}
              />
              {!courseMetaSupported && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#b45309", fontWeight: 700 }}>
                  DB note: add `cover_path` column in `courses` table to save covers.
                </div>
              )}
            </div>

            <div>
              <div style={editLabel}>Students</div>
              <div style={studentListBox}>
                {rosterLoading ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>Loading students...</div>
                ) : roster.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>No students enrolled yet.</div>
                ) : (
                  roster.map(s => (
                    <div key={s.enrollId} style={studentItem}>
                      <div style={{ fontWeight: 700, color: "#111827" }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {s.studentNo} - {s.email}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {editErr && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#dc2626", fontWeight: 700 }}>{editErr}</div>
          )}
        </div>
      )}

      {/* Roster */}
      <div style={{ ...sectionCard, marginTop: 18, minHeight: 60 }}>
        {!selectedCourse ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Select a course above to view the roster list.
          </div>
        ) : rosterLoading ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>Loading roster...</div>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
              Roster -{" "}
              <span style={{ color: "#2f6fb3" }}>{selectedCourse.title}</span>{" "}
              <span style={{ fontWeight: 600, color: "#6b7280", fontSize: 13 }}>
                ({selectedCourse.code})
              </span>
            </div>

            {roster.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                No students enrolled in this course yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["#", "Student No.", "Full Name", "Email", "Enrolled"].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s, i) => (
                      <tr key={s.enrollId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 700, color: "#2f6fb3" }}>{s.studentNo}</td>
                        <td style={td}>{s.name}</td>
                        <td style={{ ...td, color: "#6b7280" }}>{s.email}</td>
                        <td style={{ ...td, color: "#6b7280" }}>{s.enrolledAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {deleteOpen && (
        <div style={modalBackdrop}>
          <div style={modalCard}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#111827" }}>Delete Course</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
              Choose the course to delete.
            </div>

            <select
              value={deleteCourseId}
              onChange={e => { setDeleteCourseId(e.target.value); setDeleteErr(""); }}
              style={selectStyle}
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.code})
                </option>
              ))}
            </select>

            <div style={warnBox}>This action is permanent and cannot be undone.</div>

            {deleteErr && (
              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, marginTop: 10 }}>
                {deleteErr}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => { if (!deleteBusy) setDeleteOpen(false); }}
                disabled={deleteBusy}
                style={cancelBtn}
              >
                Cancel
              </button>
              <button onClick={handleDeleteCourse} disabled={deleteBusy} style={dangerBtn}>
                {deleteBusy ? "Deleting..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <style jsx>{`
      .classMgmtScroll {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .classMgmtScroll::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
    `}</style>
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────
const sectionCard = {
  background:    "rgba(255,255,255,0.75)",
  border:        "1px solid rgba(0,0,0,0.08)",
  borderRadius:  16,
  padding:       20,
  boxShadow:     "0 8px 20px rgba(0,0,0,0.06)",
};

const pageScrollWrap = {
  width: "100%",
  height: "100%",
  overflowY: "auto",
  paddingRight: 6,
  boxSizing: "border-box",
};

const inputStyle = {
  height:       40,
  padding:      "0 12px",
  borderRadius: 8,
  border:       "1px solid rgba(0,0,0,0.15)",
  background:   "white",
  fontSize:     13,
  outline:      "none",
  minWidth:     160,
};

const addBtn = {
  height:       40,
  padding:      "0 18px",
  borderRadius: 8,
  border:       "none",
  background:   "#2f6fb3",
  color:        "white",
  fontWeight:   800,
  fontSize:     13,
  cursor:       "pointer",
};

const deleteBtn = {
  height:       40,
  padding:      "0 18px",
  borderRadius: 8,
  border:       "1px solid #ef4444",
  background:   "white",
  color:        "#b91c1c",
  fontWeight:   800,
  fontSize:     13,
  cursor:       "pointer",
};

const editBtn = {
  height:       40,
  padding:      "0 18px",
  borderRadius: 8,
  border:       "1px solid #2f6fb3",
  background:   "white",
  color:        "#2f6fb3",
  fontWeight:   800,
  fontSize:     13,
  cursor:       "pointer",
};

const saveEditBtn = {
  height:       40,
  padding:      "0 18px",
  borderRadius: 8,
  border:       "none",
  background:   "#2f6fb3",
  color:        "white",
  fontWeight:   800,
  fontSize:     13,
  cursor:       "pointer",
};

const cancelEditBtn = {
  height:       40,
  padding:      "0 18px",
  borderRadius: 8,
  border:       "1px solid #d1d5db",
  background:   "white",
  color:        "#374151",
  fontWeight:   700,
  fontSize:     13,
  cursor:       "pointer",
};

const pageBtn = {
  height:    34,
  minWidth:  34,
  padding:   "0 10px",
  borderRadius: 8,
  border:    "1px solid #d1d5db",
  background:"white",
  color:     "#374151",
  fontSize:  13,
  cursor:    "pointer",
  fontWeight:600,
};

const th = {
  padding:      "9px 12px",
  textAlign:    "left",
  fontWeight:   800,
  color:        "#374151",
  borderBottom: "2px solid #e5e7eb",
  whiteSpace:   "nowrap",
  background:   "#f8fafc",
};

const td = {
  padding:       "9px 12px",
  verticalAlign: "middle",
};

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const modalCard = {
  width: "100%",
  maxWidth: 460,
  background: "white",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
  padding: 18,
};

const selectStyle = {
  marginTop: 14,
  width: "100%",
  height: 40,
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.2)",
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
  background: "white",
};

const warnBox = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 8,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 700,
};

const cancelBtn = {
  height: 36,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "white",
  color: "#374151",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerBtn = {
  height: 36,
  padding: "0 14px",
  borderRadius: 8,
  border: "none",
  background: "#dc2626",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const noCoverBox = {
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)",
  color: "#374151",
};

const editGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
  gap: 16,
  alignItems: "start",
};

const editLabel = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: ".3px",
};

const fileInputStyle = {
  width: "100%",
  fontSize: 13,
};

const studentListBox = {
  maxHeight: 180,
  overflowY: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#f8fafc",
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const studentItem = {
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: 8,
};

