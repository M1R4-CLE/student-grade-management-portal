"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

const emptyForm = {
  full_name: "",
  email: "",
  student_no: "",

  company: "",
  job_title: "",
  pronoun: "",
  department: "",

  mailing_address: "",
  phone_number: "",
  business_fax: "",

  gender: "",
  education_level: "",
  additional_name: "",
  website: "",
  birthday: "",
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function percent(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function bucketFromFinal(finalGrade) {
  const g = Number(finalGrade);
  if (!Number.isFinite(g)) return null;
  if (g >= 95) return "A";
  if (g >= 90) return "A-";
  if (g >= 85) return "B+";
  if (g >= 80) return "B";
  if (g >= 75) return "C+";
  if (g >= 60) return "D";
  return "F";
}

function toGpa(avgFinal) {
  const v = clamp(Number(avgFinal || 0), 0, 100);
  return Math.round(((v / 100) * 4) * 100) / 100;
}

function getExt(fileName) {
  const parts = String(fileName || "").split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "png";
  if (ext === "jpeg") return "jpg";
  return ext || "png";
}

export default function StudentProfilePage() {
  const router = useRouter();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  // Avatar
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  // For right-side cards
  const [finalGrades, setFinalGrades] = useState([]);

  const setMsg = (txt) => setMessage(txt || "");

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const refreshAvatarSignedUrl = async (path) => {
    if (!path) {
      setAvatarUrl("");
      return;
    }

    const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 30);
    if (error) {
      setMsg(error.message);
      setAvatarUrl("");
      return;
    }
    setAvatarUrl(data?.signedUrl || "");
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const meta = user.user_metadata || {};

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select(
          [
            "id",
            "role",
            "full_name",
            "email",
            "student_no",
            "avatar_path",
            "program",
            "year_level",
            "company",
            "job_title",
            "pronoun",
            "department",
            "mailing_address",
            "phone_number",
            "fax_number",
          ].join(",")
        )
        .eq("id", user.id)
        .single();

      if (pErr) {
        setMsg(pErr.message);
        setLoading(false);
        return;
      }

      if (profile?.role === "teacher") {
        router.replace("/teacher/Dashboard");
        return;
      }

      // avatar
      setAvatarPath(profile?.avatar_path || "");
      if (profile?.avatar_path) {
        await refreshAvatarSignedUrl(profile.avatar_path);
      } else {
        setAvatarUrl("");
      }

      setForm({
        full_name: profile?.full_name || meta.full_name || "Student User",
        email: profile?.email || user.email || "",
        student_no: profile?.student_no || meta.student_no || "2024-130839",

        company: profile?.company || meta.company || "",
        job_title: profile?.job_title || meta.job_title || "",
        pronoun: profile?.pronoun || meta.pronoun || "",
        department: profile?.department || meta.department || "",

        mailing_address: profile?.mailing_address || meta.mailing_address || "",
        phone_number: profile?.phone_number || meta.phone_number || "",
        business_fax: profile?.fax_number || meta.business_fax || "",

        gender: meta.gender || "",
        education_level: meta.education_level || "",
        additional_name: meta.additional_name || "",
        website: meta.website || "",
        birthday: meta.birthday || "",
      });

      const { data: gradesData } = await supabase
        .from("grades")
        .select("final_grade")
        .eq("student_id", user.id);

      // IMPORTANT: keep only valid numeric grades
      const numeric = (gradesData || [])
        .map((x) => Number(x.final_grade))
        .filter((n) => Number.isFinite(n));

      setFinalGrades(numeric);

      setLoading(false);
    };

    load();
  }, [router]);

  const stats = useMemo(() => {
    const list = finalGrades || [];
    const count = list.length;

    const avg = count ? list.reduce((a, b) => a + b, 0) / count : 0;
    const gpa = toGpa(avg);

    const buckets = { A: 0, "A-": 0, "B+": 0, B: 0, "C+": 0, D: 0, F: 0 };

    for (const g of list) {
      const b = bucketFromFinal(g);
      if (!b) continue;
      buckets[b] = (buckets[b] || 0) + 1;
    }

    const hasData = count > 0;

    // ✅ If no grades, everything stays ZERO so it greys out.
    const dist = {
      A: percent(buckets.A, count),
      "A-": percent(buckets["A-"], count),
      "B+": percent(buckets["B+"], count),
      B: percent(buckets.B, count),
      "C+": percent(buckets["C+"], count),
      D: percent(buckets.D, count),
      F: percent(buckets.F, count),
    };

    const completedUnits = hasData ? count * 3 : 0;
    const attendance = hasData ? 92 : 0; // adjust or set null if you add attendance later

    return { avgFinal: avg, gpa, dist, completedUnits, attendance, hasData };
  }, [finalGrades]);

  const saveProfile = async () => {
    if (!userId) return;

    setSaving(true);
    setMsg("");

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({
        full_name: (form.full_name || "").trim(),
        email: (form.email || "").trim(),
        student_no: (form.student_no || "").trim(),

        company: form.company || "",
        job_title: form.job_title || "",
        pronoun: form.pronoun || "",
        department: form.department || "",

        mailing_address: form.mailing_address || "",
        phone_number: form.phone_number || "",
        fax_number: form.business_fax || "",
      })
      .eq("id", userId);

    if (dbErr) {
      setMsg(dbErr.message);
      setSaving(false);
      return;
    }

    const { error: metaErr } = await supabase.auth.updateUser({
      data: {
        gender: form.gender || "",
        education_level: form.education_level || "",
        additional_name: form.additional_name || "",
        website: form.website || "",
        birthday: form.birthday || "",
      },
    });

    if (metaErr) {
      setMsg(metaErr.message);
      setSaving(false);
      return;
    }

    setMsg("Profile saved successfully.");
    setEditing(false);
    setSaving(false);
  };

  const pickAvatar = () => {
    setMsg("");
    if (fileRef.current) fileRef.current.click();
  };

  const onAvatarSelected = async (file) => {
    if (!file || !userId) return;

    const okTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!okTypes.includes(file.type)) {
      setMsg("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg("Avatar must be 2MB or less.");
      return;
    }

    setAvatarBusy(true);
    setMsg("");

    const ext = getExt(file.name);
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

    if (upErr) {
      setMsg(`Upload failed: ${upErr.message}`);
      setAvatarBusy(false);
      return;
    }

    const { error: dbErr } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);

    if (dbErr) {
      setMsg(`Saving avatar failed: ${dbErr.message}`);
      setAvatarBusy(false);
      return;
    }

    setAvatarPath(path);
    await refreshAvatarSignedUrl(path);

    setMsg("Avatar updated successfully.");
    setAvatarBusy(false);
  };

  if (loading) return <div style={{ padding: 24 }}>Loading profile...</div>;

  return (
    <div style={wrap}>
      <div style={grid}>
        {/* LEFT SIDE */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Top profile header card */}
          <div style={card}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {/* avatar */}
              <div style={avatarCircle}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                  />
                ) : (
                  <span style={{ fontSize: 34, opacity: 0.9 }}>👤</span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={titleText}>{form.full_name || "Student User"}</div>
                <div style={subText}>Student ID: {form.student_no || "-"}</div>
                <div style={subText}>BS Information - 2nd Year</div>

                {/* Avatar controls */}
                <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={pickAvatar} disabled={avatarBusy} style={btnWhite}>
                    {avatarBusy ? "Uploading..." : " Change Avatar"}
                  </button>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => onAvatarSelected(e.target.files?.[0])}
                  />

                  {avatarPath ? <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Saved</span> : null}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => {
                    setMsg("");
                    setEditing((p) => !p);
                  }}
                  style={btnBlue}
                >
                  {editing ? "Cancel Edit" : "Edit Profile"}
                </button>
              </div>
            </div>
          </div>

          <Section title="Basic Information" editing={editing}>
            <Field label="Full Name" value={form.full_name} editing={editing} onChange={(v) => handleChange("full_name", v)} />
            <Field label="Company" value={form.company} editing={editing} onChange={(v) => handleChange("company", v)} optional />
            <Field label="Email Address" value={form.email} editing={editing} onChange={(v) => handleChange("email", v)} />
            <Field label="Job Title" value={form.job_title} editing={editing} onChange={(v) => handleChange("job_title", v)} optional />
            <Field label="Pronoun" value={form.pronoun} editing={editing} onChange={(v) => handleChange("pronoun", v)} optional />
            <Field label="Department" value={form.department} editing={editing} onChange={(v) => handleChange("department", v)} optional />
          </Section>

          <Section title="Contact Information" editing={editing}>
            <Field label="Mailing Address" value={form.mailing_address} editing={editing} onChange={(v) => handleChange("mailing_address", v)} optional />
            <Field label="Phone Number" value={form.phone_number} editing={editing} onChange={(v) => handleChange("phone_number", v)} optional />
            <Field label="Business Fax Number" value={form.business_fax} editing={editing} onChange={(v) => handleChange("business_fax", v)} optional />
            <div />
          </Section>

          <Section title="Additional Information" editing={editing}>
            <Field label="Gender" value={form.gender} editing={editing} onChange={(v) => handleChange("gender", v)} optional />
            <Field label="Education Level" value={form.education_level} editing={editing} onChange={(v) => handleChange("education_level", v)} optional />
            <Field label="Additional Name" value={form.additional_name} editing={editing} onChange={(v) => handleChange("additional_name", v)} optional />
            <Field label="Website" value={form.website} editing={editing} onChange={(v) => handleChange("website", v)} optional />
            <Field label="Birthday" value={form.birthday} editing={editing} onChange={(v) => handleChange("birthday", v)} optional type="date" />
            <div />
          </Section>

          {/* footer actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px", gap: 12 }}>
            <div
              style={{
                color:
                  message.toLowerCase().includes("success") || message.toLowerCase().includes("updated")
                    ? "#2e7d32"
                    : "#b23a3a",
                fontWeight: 700,
                whiteSpace: "pre-wrap",
                minHeight: 18,
              }}
            >
              {message}
            </div>

            {editing && (
              <button onClick={saveProfile} disabled={saving} style={btnBlue}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT SIDE (only these cards changed) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Academic Performance */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Academic Performance</div>
              <div style={{ opacity: 0.6 }}>•••</div>
            </div>

            {(() => {
              const gpaPercent = clamp(Math.round((stats.gpa / 4) * 100), 0, 100);
              const isZero = gpaPercent === 0;

              return (
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10, marginTop: 10, alignItems: "center" }}>
                  <div style={donutWrap(isZero, gpaPercent)}>
                    <div style={donutInner}>
                      <div style={{ fontWeight: 900, color: isZero ? "#9ca3af" : "#111827" }}>{stats.gpa.toFixed(2)}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 900, color: "#111827" }}>Overall GPA</div>
                    <div style={{ fontSize: 20, fontWeight: 900, marginTop: 3, color: isZero ? "#9ca3af" : "#111827" }}>
                      {stats.gpa.toFixed(2)}
                    </div>

                    <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${gpaPercent}%`, background: isZero ? "#d1d5db" : "#22c55e" }} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, color: "#6b7280", fontSize: 12 }}>
                      <div>
                        Completed Units
                        <div style={{ fontWeight: 900, color: "#111827" }}>{stats.completedUnits}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        Attendance
                        <div style={{ fontWeight: 900, color: "#111827" }}>{stats.attendance}%</div>
                      </div>
                    </div>

                    {!stats.hasData && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                        (No grades yet — values will update once grades exist.)
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Grade Distribution */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Grade Distribution</div>
              <div style={{ opacity: 0.6 }}>•••</div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {[
                ["A", stats.dist.A, "#22c55e"],
                ["A-", stats.dist["A-"], "#34d399"],
                ["B+", stats.dist["B+"], "#3b82f6"],
                ["B", stats.dist.B, "#60a5fa"],
                ["C+", stats.dist["C+"], "#f59e0b"],
                ["D", stats.dist.D, "#f97316"],
                ["F", stats.dist.F, "#ef4444"],
              ].map(([label, val, color]) => {
                const isZero = Number(val) === 0;
                const barColor = isZero ? "#d1d5db" : color;

                return (
                  <div key={label} style={{ display: "grid", gridTemplateColumns: "36px 1fr 44px", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>{label}</div>
                    <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${clamp(val, 0, 100)}%`, background: barColor }} />
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 900, color: isZero ? "#9ca3af" : "#111827" }}>
                      {val}%
                    </div>
                  </div>
                );
              })}

              {!stats.hasData && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                  (No grades yet — distribution will populate once grades exist.)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, editing }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #eef0f3", paddingBottom: 8 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        {editing && <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>Editing</div>}
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
    </div>
  );
}

function Field({ label, value, editing, onChange, optional = false, type = "text" }) {
  return (
    <div style={fieldBox}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>{label}</div>

      {editing ? (
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={optional ? "(optional)" : ""}
          style={input}
        />
      ) : (
        <div style={{ marginTop: 6, fontWeight: 900, color: value ? "#111827" : "#9ca3af" }}>
          {value ? value : "(optional)"}
        </div>
      )}
    </div>
  );
}

/* ---------- styles ---------- */

const wrap = { width: "100%" };

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 320px",
  gap: 12,
  alignItems: "start",
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,.06)",
};

const titleText = {
  fontWeight: 900,
  fontSize: 16,
  color: "#111827",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subText = {
  color: "#6b7280",
  fontWeight: 700,
  marginTop: 2,
  fontSize: 12,
};

const avatarCircle = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  border: "3px solid #111827",
  display: "grid",
  placeItems: "center",
  background: "#fff",
  overflow: "hidden",
  flexShrink: 0,
};

const btnBlue = {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "none",
  background: "#2f6fb3",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const btnWhite = {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "white",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const fieldBox = {
  border: "1px solid #eef0f3",
  borderRadius: 12,
  padding: 10,
  background: "#fff",
  minHeight: 54,
};

const input = {
  marginTop: 6,
  width: "100%",
  height: 32,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  padding: "0 10px",
  outline: "none",
  fontWeight: 800,
  fontSize: 13,
};

const donutWrap = (isZero, gpaPercent) => {
  const p = clamp(gpaPercent, 0, 100);

  if (isZero) {
    return {
      width: 90,
      height: 90,
      borderRadius: "50%",
      background: "conic-gradient(#d1d5db 0deg 360deg)",
      display: "grid",
      placeItems: "center",
    };
  }

  const deg = Math.round((p / 100) * 360);
  return {
    width: 90,
    height: 90,
    borderRadius: "50%",
    background: `conic-gradient(#22c55e 0deg ${deg}deg, #e5e7eb ${deg}deg 360deg)`,
    display: "grid",
    placeItems: "center",
  };
};

const donutInner = {
  width: 62,
  height: 62,
  borderRadius: "50%",
  background: "white",
  display: "grid",
  placeItems: "center",
  border: "1px solid #e5e7eb",
};