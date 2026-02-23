"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

const emptyForm = {
  full_name: "",
  email: "",
  student_no: "",

  // these now come from public.profiles (because you added columns)
  company: "",
  job_title: "",
  pronoun: "",
  department: "",

  mailing_address: "",
  phone_number: "",
  business_fax: "", // UI name; maps to profiles.fax_number

  // these are still stored in auth.user_metadata (unless you add DB columns)
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

// simple grade -> bucket
function bucketFromFinal(finalGrade) {
  const g = Number(finalGrade ?? 0);
  if (g >= 95) return "A";
  if (g >= 90) return "A-";
  if (g >= 85) return "B+";
  if (g >= 80) return "B";
  if (g >= 75) return "C+";
  if (g >= 60) return "D";
  return "F";
}

// very simple “GPA-like” mapping (UI only; adjust to your school’s rule)
function toGpa(avgFinal) {
  const v = clamp(Number(avgFinal || 0), 0, 100);
  // 0..100 => 0..4
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

  // For right-side cards (computed from grades if available)
  const [finalGrades, setFinalGrades] = useState([]);

  // Change password mini box
  const [showPass, setShowPass] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passBusy, setPassBusy] = useState(false);

  const setMsg = (txt) => setMessage(txt || "");

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const refreshAvatarSignedUrl = async (path) => {
    if (!path) {
      setAvatarUrl("");
      return;
    }

    // bucket should be private -> use signed url
    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 30); // 30 mins

    if (error) {
      // If policies/bucket issues, show a helpful message but don't break page
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

      // IMPORTANT: select the new columns you added in profiles
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

      // save avatar state
      setAvatarPath(profile?.avatar_path || "");
      if (profile?.avatar_path) {
        await refreshAvatarSignedUrl(profile.avatar_path);
      } else {
        setAvatarUrl("");
      }

      // Fill form from DB first, then fallback to auth metadata
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

      // Load grades (optional: used for right-side cards)
      const { data: gradesData } = await supabase
        .from("grades")
        .select("final_grade")
        .eq("student_id", user.id);

      setFinalGrades((gradesData || []).map((x) => Number(x.final_grade ?? 0)));

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
    list.forEach((g) => {
      const b = bucketFromFinal(g);
      buckets[b] = (buckets[b] || 0) + 1;
    });

    const hasData = count > 0;
    const dist = hasData
      ? {
          A: percent(buckets.A, count),
          "A-": percent(buckets["A-"], count),
          "B+": percent(buckets["B+"], count),
          B: percent(buckets.B, count),
          "C+": percent(buckets["C+"], count),
          D: percent(buckets.D, count),
          F: percent(buckets.F, count),
        }
      : { A: 47, "A-": 28, "B+": 17, B: 7, "C+": 0, D: 0, F: 0 };

    const completedUnits = hasData ? count * 3 : 23;
    const attendance = 92;

    return { avgFinal: avg, gpa, dist, completedUnits, attendance, hasData };
  }, [finalGrades]);

  const saveProfile = async () => {
    if (!userId) return;

    setSaving(true);
    setMsg("");

    // Save everything that exists on public.profiles
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
        fax_number: form.business_fax || "", // maps UI -> DB column
      })
      .eq("id", userId);

    if (dbErr) {
      setMsg(dbErr.message);
      setSaving(false);
      return;
    }

    // Keep your “Additional Information” in auth metadata (unless you add DB columns later)
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

  const changePassword = async () => {
    setMsg("");

    if (!newPass || !confirmPass) {
      setMsg("Please fill in both password fields.");
      return;
    }
    if (newPass !== confirmPass) {
      setMsg("Passwords do not match.");
      return;
    }

    setPassBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) {
      setMsg(error.message);
      setPassBusy(false);
      return;
    }

    setMsg("Password changed successfully.");
    setNewPass("");
    setConfirmPass("");
    setShowPass(false);
    setPassBusy(false);
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

    // Upload to Storage bucket "avatars"
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (upErr) {
      setMsg(
        `Upload failed: ${upErr.message}\n(Confirm you created the "avatars" bucket and added the storage policies.)`
      );
      setAvatarBusy(false);
      return;
    }

    // Save path to profiles.avatar_path
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", userId);

    if (dbErr) {
      setMsg(`Saving avatar failed: ${dbErr.message}`);
      setAvatarBusy(false);
      return;
    }

    // Refresh avatar immediately
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Top profile header card */}
          <div style={card}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {/* big avatar */}
              <div style={avatarCircle}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                  />
                ) : (
                  <span style={{ fontSize: 40, opacity: 0.9 }}>👤</span>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: "#111827" }}>
                  {form.full_name || "Student User"}
                </div>
                <div style={{ color: "#6b7280", fontWeight: 700, marginTop: 2 }}>
                  Student ID: {form.student_no || "-"}
                </div>
                <div style={{ color: "#6b7280", marginTop: 2 }}>
                  BS Information - 2nd Year
                </div>

                {/* Avatar controls */}
                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={pickAvatar} disabled={avatarBusy} style={btnWhite}>
                    {avatarBusy ? "Uploading..." : "🖼️ Change Avatar"}
                  </button>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => onAvatarSelected(e.target.files?.[0])}
                  />

                  {avatarPath ? (
                    <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                      Saved
                    </span>
                  ) : null}
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
                  ✏️ {editing ? "Cancel Edit" : "Edit Profile"}
                </button>

                <button onClick={() => setShowPass((p) => !p)} style={btnWhite}>
                  🔒 Change Password
                </button>
              </div>
            </div>

            {/* password mini box */}
            {showPass && (
              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr auto",
                  gap: 10,
                }}
              >
                <input
                  type="password"
                  placeholder="New password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  style={input}
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  style={input}
                />
                <button onClick={changePassword} disabled={passBusy} style={btnBlue}>
                  {passBusy ? "Saving..." : "Update"}
                </button>
              </div>
            )}
          </div>

          {/* Sections */}
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 2px",
            }}
          >
            <div
              style={{
                color: message.toLowerCase().includes("success") || message.toLowerCase().includes("updated")
                  ? "#2e7d32"
                  : "#b23a3a",
                fontWeight: 700,
                whiteSpace: "pre-wrap",
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

        {/* RIGHT SIDE */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Academic Performance */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Academic Performance</div>
              <div style={{ opacity: 0.6 }}>•••</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12, marginTop: 12, alignItems: "center" }}>
              <div style={donutWrap}>
                <div style={donutInner}>
                  <div style={{ fontWeight: 900 }}>{stats.gpa.toFixed(2)}</div>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 900, color: "#111827" }}>Overall GPA</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{stats.gpa.toFixed(2)}</div>

                <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${clamp(Math.round((stats.gpa / 4) * 100), 0, 100)}%`,
                      background: "#22c55e",
                    }}
                  />
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
                    (This card shows sample values until grades exist.)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grade Distribution */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Grade Distribution</div>
              <div style={{ opacity: 0.6 }}>•••</div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {[
                ["A", stats.dist.A, "#22c55e"],
                ["A-", stats.dist["A-"], "#34d399"],
                ["B+", stats.dist["B+"], "#3b82f6"],
                ["B", stats.dist.B, "#60a5fa"],
                ["C+", stats.dist["C+"], "#f59e0b"],
                ["D", stats.dist.D, "#f97316"],
                ["F", stats.dist.F, "#ef4444"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "36px 1fr 44px", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>{label}</div>
                  <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${clamp(val, 0, 100)}%`, background: color }} />
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 900 }}>{val}%</div>
                </div>
              ))}

              {!stats.hasData && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                  (Sample distribution until grades exist.)
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
        <div style={{ opacity: 0.7 }}></div>
        {editing && <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>Editing</div>}
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {children}
      </div>
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

/* ---------- styles (inline like your app) ---------- */

const wrap = {
  width: "100%",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 320px",
  gap: 14,
  alignItems: "start",
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,.06)",
};

const avatarCircle = {
  width: 76,
  height: 76,
  borderRadius: "50%",
  border: "3px solid #111827",
  display: "grid",
  placeItems: "center",
  background: "#fff",
  overflow: "hidden",
};

const btnBlue = {
  height: 36,
  padding: "0 14px",
  borderRadius: 8,
  border: "none",
  background: "#2f6fb3",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const btnWhite = {
  height: 36,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "white",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const fieldBox = {
  border: "1px solid #eef0f3",
  borderRadius: 10,
  padding: 12,
  background: "#fff",
  minHeight: 62,
};

const input = {
  marginTop: 6,
  width: "100%",
  height: 36,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  padding: "0 10px",
  outline: "none",
  fontWeight: 800,
};

const donutWrap = {
  width: 96,
  height: 96,
  borderRadius: "50%",
  background: "conic-gradient(#22c55e 0deg 140deg, #3b82f6 140deg 260deg, #e5e7eb 260deg 360deg)",
  display: "grid",
  placeItems: "center",
};

const donutInner = {
  width: 66,
  height: 66,
  borderRadius: "50%",
  background: "white",
  display: "grid",
  placeItems: "center",
  border: "1px solid #e5e7eb",
};