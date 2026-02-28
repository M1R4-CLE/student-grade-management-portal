"use client";

// ============================================================
// FILE: src/app/teacher/Profile/page.jsx
// ============================================================

// ============================================================
// FILE: src/app/teacher/Profile/page.jsx
// ============================================================

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

const emptyForm = {
  full_name:       "",
  email:           "",
  company:         "",
  job_title:       "",
  pronoun:         "",
  department:      "",
  mailing_address: "",
  phone_number:    "",
  fax_number:      "",
};

function getExt(fileName) {
  const parts = String(fileName || "").split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "png";
  return ext === "jpeg" ? "jpg" : ext || "png";
}

export default function TeacherProfilePage() {
  const router  = useRouter();
  const fileRef = useRef(null);

  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [userId,     setUserId]     = useState("");
  const [form,       setForm]       = useState(emptyForm);
  const [message,    setMessage]    = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarUrl,  setAvatarUrl]  = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  const setMsg = t => setMessage(t || "");
  const change = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Refresh signed URL ──────────────────────────────────────
  const refreshUrl = async (path) => {
    if (!path) { setAvatarUrl(""); return; }
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 1800);
    setAvatarUrl(data?.signedUrl || "");
  };

  // ── Load profile ────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { router.replace("/login"); return; }

      setUserId(user.id);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, full_name, email, company, job_title, pronoun, department, mailing_address, phone_number, fax_number, avatar_path")
        .eq("id", user.id)
        .single();

      if (error || !profile) { router.replace("/login"); return; }
      const role = String(profile.role || "").trim().toLowerCase();
      if (role !== "teacher") { router.replace("/student/dashboard"); return; }

      setAvatarPath(profile.avatar_path || "");
      if (profile.avatar_path) await refreshUrl(profile.avatar_path);

      setForm({
        full_name:       profile.full_name       || "",
        email:           profile.email           || user.email || "",
        company:         profile.company         || "",
        job_title:       profile.job_title       || "",
        pronoun:         profile.pronoun         || "",
        department:      profile.department      || "",
        mailing_address: profile.mailing_address || "",
        phone_number:    profile.phone_number    || "",
        fax_number:      profile.fax_number      || "",
      });
      setLoading(false);
    };
    load();
  }, [router]);

  // ── Save profile ────────────────────────────────────────────
  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true); setMsg("");

    const { error } = await supabase.from("profiles").update({
      full_name:       form.full_name.trim(),
      email:           form.email.trim(),
      company:         form.company,
      job_title:       form.job_title,
      pronoun:         form.pronoun,
      department:      form.department,
      mailing_address: form.mailing_address,
      phone_number:    form.phone_number,
      fax_number:      form.fax_number,
    }).eq("id", userId);

    if (error) { setMsg(error.message); }
    else       { setMsg("Profile saved successfully."); setEditing(false); }
    setSaving(false);
  };

  // ── Avatar upload ───────────────────────────────────────────
  const onAvatarSelected = async (file) => {
    if (!file || !userId) return;
    const okTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!okTypes.includes(file.type)) { setMsg("Please upload a PNG, JPG, or WEBP image."); return; }
    if (file.size > 2 * 1024 * 1024) { setMsg("Avatar must be 2MB or less."); return; }

    setAvatarBusy(true); setMsg("");
    const ext = getExt(file.name);
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
    if (upErr) { setMsg(`Upload failed: ${upErr.message}`); setAvatarBusy(false); return; }

    const { error: dbErr } = await supabase.from("profiles")
      .update({ avatar_path: path }).eq("id", userId);
    if (dbErr) { setMsg(`Saving avatar failed: ${dbErr.message}`); setAvatarBusy(false); return; }

    setAvatarPath(path);
    await refreshUrl(path);
    setMsg("Avatar updated successfully.");
    setAvatarBusy(false);
  };

  if (loading) return <div style={{ padding: 24 }}>Loading profile…</div>;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1060, margin: "0 auto" }}>

      {/* Header card */}
      <div style={card}>
        <div className="teacher-profile-header" style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {/* Avatar */}
          <div style={avatarCircle}>
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : <span style={{ fontSize: 34 }}>👤</span>}
          </div>

          <div className="teacher-profile-main" style={{ flex: 1 }}>
            <div className="teacher-profile-name" style={{ fontWeight: 900, fontSize: 26 }}>{form.full_name || "Teacher"}</div>
            <div className="teacher-profile-role" style={{ fontSize: 17, color: "#6b7280", marginTop: 4 }}>
              {form.department || "Department not set"} · {form.job_title || "Teacher"}
            </div>
            <div className="teacher-profile-avatar-actions" style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => { setMsg(""); if (fileRef.current) fileRef.current.click(); }}
                disabled={avatarBusy}
                style={btnWhite}
              >
                {avatarBusy ? "Uploading…" : "📷 Change Avatar"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                style={{ display: "none" }}
                onChange={e => onAvatarSelected(e.target.files?.[0])}
              />
              {avatarPath && <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 700 }}>Saved</span>}
            </div>
          </div>

          <div className="teacher-profile-actions">
            <button className="teacher-profile-edit-btn" onClick={() => { setMsg(""); setEditing(p => !p); }} style={btnBlue}>
              {editing ? "Cancel" : "Edit Profile"}
            </button>
          </div>
        </div>
      </div>

      <div className="teacher-profile-sections">
        {/* Basic info */}
        <Section className="teacher-profile-section-card" title="Basic Information">
          <Field label="Full Name"  value={form.full_name}  editing={editing} onChange={v => change("full_name",  v)} />
          <Field label="Email"      value={form.email}       editing={editing} onChange={v => change("email",      v)} />
          <Field label="Job Title"  value={form.job_title}  editing={editing} onChange={v => change("job_title",  v)} optional />
          <Field label="Department" value={form.department} editing={editing} onChange={v => change("department", v)} optional />
          <Field label="Company"    value={form.company}    editing={editing} onChange={v => change("company",    v)} optional />
          <Field label="Pronoun"    value={form.pronoun}    editing={editing} onChange={v => change("pronoun",    v)} optional />
        </Section>

        {/* Contact info */}
        <Section className="teacher-profile-section-card" title="Contact Information">
          <Field label="Mailing Address" value={form.mailing_address} editing={editing} onChange={v => change("mailing_address", v)} optional />
          <Field label="Phone Number"    value={form.phone_number}    editing={editing} onChange={v => change("phone_number",    v)} optional />
          <Field label="Fax Number"      value={form.fax_number}      editing={editing} onChange={v => change("fax_number",      v)} optional />
          <div />
        </Section>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 2px", marginTop: 16 }}>
        <div style={{
          color: message.toLowerCase().includes("success") || message.toLowerCase().includes("updated")
            ? "#2e7d32" : "#b23a3a",
          fontWeight: 700, fontSize: 15, minHeight: 20,
        }}>
          {message}
        </div>
        {editing && (
          <button onClick={saveProfile} disabled={saving} style={btnBlue}>
            {saving ? "Saving…" : "Save Profile"}
          </button>
        )}
      </div>

      <style jsx>{`
        @media (max-width: 760px) {
          .teacher-profile-header {
            flex-direction: column;
            align-items: center !important;
            gap: 14px !important;
          }

          .teacher-profile-main {
            width: 100%;
            min-width: 0;
            text-align: center;
          }

          .teacher-profile-name {
            font-size: 34px !important;
            line-height: 1.1;
          }

          .teacher-profile-role {
            font-size: 15px !important;
          }

          .teacher-profile-actions {
            width: 100%;
          }

          .teacher-profile-edit-btn {
            width: 100%;
            min-height: 42px;
          }

          .teacher-profile-avatar-actions {
            width: 100%;
            justify-content: center;
          }

          .teacher-profile-sections {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }

          :global(.teacher-profile-section-card) {
            margin-top: 14px !important;
          }

          :global(.teacher-profile-section-grid) {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────
function Section({ title, children, className = "" }) {
  return (
    <div className={className} style={{ ...card, marginTop: 20 }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: "#2f6fb3" }}>{title}</div>
      <div className="teacher-profile-section-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 34px" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, editing, onChange, optional, type = "text" }) {
  return (
    <div>
      <div style={{ fontSize: 14, color: "#6b7280", fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>
        {label}{optional && <span style={{ color: "#9ca3af", fontWeight: 500 }}> (optional)</span>}
      </div>
      {editing
        ? <input
            type={type}
            value={value || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.15)", fontSize: 16, outline: "none", background: "white" }}
          />
        : <div style={{ fontSize: 18, color: value ? "#111827" : "#9ca3af", fontWeight: value ? 600 : 400, padding: "8px 0" }}>
            {value || "Not set"}
          </div>
      }
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const card = {
  background:    "rgba(255,255,255,0.82)",
  border:        "1px solid rgba(0,0,0,0.08)",
  borderRadius:  20,
  boxShadow:     "0 10px 24px rgba(0,0,0,0.08)",
  padding:       "24px 26px",
};

const avatarCircle = {
  width: 124, height: 124, borderRadius: "50%",
  background: "#e5e7eb",
  display: "flex", alignItems: "center", justifyContent: "center",
  overflow: "hidden", flexShrink: 0,
  border: "3px solid rgba(0,0,0,0.08)",
};

const btnWhite = {
  padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)",
  background: "white", fontWeight: 700, cursor: "pointer", fontSize: 15,
};

const btnBlue = {
  padding: "11px 20px", borderRadius: 10, border: "none",
  background: "#2f6fb3", color: "white",
  fontWeight: 800, cursor: "pointer", fontSize: 16,
};
