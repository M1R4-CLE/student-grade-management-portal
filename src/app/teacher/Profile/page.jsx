"use client";

import { useEffect, useRef, useState } from "react";
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

function getExt(fileName) {
  const parts = String(fileName || "").split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "png";
  if (ext === "jpeg") return "jpg";
  return ext || "png";
}

export default function TeacherProfilePage() {
  const router = useRouter();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  const [avatarPath, setAvatarPath] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

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

    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 30);

    if (error) {
      setMsg(error.message);
      setAvatarUrl("");
      return;
    }

    setAvatarUrl(data?.signedUrl || "");
  };

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setMsg("");

      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (!alive) return;

      if (sessionErr) {
        setMsg(sessionErr.message || "Failed to read session.");
        setLoading(false);
        return;
      }

      const user = session?.user;
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

      if (!alive) return;

      if (pErr) {
        setMsg(pErr.message || "Unable to load profile.");
        setLoading(false);
        return;
      }

      if (!profile) {
        setMsg("Unable to verify account role.");
        setLoading(false);
        return;
      }

      if (profile.role !== "teacher") {
        router.replace("/student/dashboard");
        return;
      }

      setAvatarPath(profile.avatar_path || "");
      if (profile.avatar_path) {
        await refreshAvatarSignedUrl(profile.avatar_path);
      } else {
        setAvatarUrl("");
      }

      if (!alive) return;

      setForm({
        full_name: profile.full_name || meta.full_name || "Teacher User",
        email: profile.email || user.email || "",
        student_no: profile.student_no || meta.student_no || "",
        company: profile.company || meta.company || "",
        job_title: profile.job_title || meta.job_title || "",
        pronoun: profile.pronoun || meta.pronoun || "",
        department: profile.department || meta.department || "",
        mailing_address: profile.mailing_address || meta.mailing_address || "",
        phone_number: profile.phone_number || meta.phone_number || "",
        business_fax: profile.fax_number || meta.business_fax || "",
        gender: meta.gender || "",
        education_level: meta.education_level || "",
        additional_name: meta.additional_name || "",
        website: meta.website || "",
        birthday: meta.birthday || "",
      });

      setLoading(false);
    };

    load();

    return () => {
      alive = false;
    };
  }, [router]);

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

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", userId);

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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={card}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={avatarCircle}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 40, opacity: 0.9 }}>👤</span>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: "#111827" }}>
                  {form.full_name || "Teacher User"}
                </div>
                <div style={{ color: "#6b7280", fontWeight: 700, marginTop: 2 }}>
                  ID: {form.student_no || "-"}
                </div>
                <div style={{ color: "#6b7280", marginTop: 2 }}>
                  Teacher Profile
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={pickAvatar}
                    disabled={avatarBusy}
                    style={btnWhite}
                  >
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
                    <span
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        fontWeight: 700,
                      }}
                    >
                      Saved
                    </span>
                  ) : null}
                </div>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMsg("");
                    setEditing((prev) => !prev);
                  }}
                  style={btnBlue}
                >
                  ✏️ {editing ? "Cancel Edit" : "Edit Profile"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowPass((prev) => !prev)}
                  style={btnWhite}
                >
                  🔒 Change Password
                </button>
              </div>
            </div>

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
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={passBusy}
                  style={btnBlue}
                >
                  {passBusy ? "Saving..." : "Update"}
                </button>
              </div>
            )}
          </div>

          <Section title="Basic Information" editing={editing}>
            <Field
              label="Full Name"
              value={form.full_name}
              editing={editing}
              onChange={(v) => handleChange("full_name", v)}
            />
            <Field
              label="Company"
              value={form.company}
              editing={editing}
              onChange={(v) => handleChange("company", v)}
              optional
            />
            <Field
              label="Email Address"
              value={form.email}
              editing={editing}
              onChange={(v) => handleChange("email", v)}
            />
            <Field
              label="Job Title"
              value={form.job_title}
              editing={editing}
              onChange={(v) => handleChange("job_title", v)}
              optional
            />
            <Field
              label="Pronoun"
              value={form.pronoun}
              editing={editing}
              onChange={(v) => handleChange("pronoun", v)}
              optional
            />
            <Field
              label="Department"
              value={form.department}
              editing={editing}
              onChange={(v) => handleChange("department", v)}
              optional
            />
          </Section>

          <Section title="Contact Information" editing={editing}>
            <Field
              label="Mailing Address"
              value={form.mailing_address}
              editing={editing}
              onChange={(v) => handleChange("mailing_address", v)}
              optional
            />
            <Field
              label="Phone Number"
              value={form.phone_number}
              editing={editing}
              onChange={(v) => handleChange("phone_number", v)}
              optional
            />
            <Field
              label="Business Fax Number"
              value={form.business_fax}
              editing={editing}
              onChange={(v) => handleChange("business_fax", v)}
              optional
            />
            <div />
          </Section>

          <Section title="Additional Information" editing={editing}>
            <Field
              label="Gender"
              value={form.gender}
              editing={editing}
              onChange={(v) => handleChange("gender", v)}
              optional
            />
            <Field
              label="Education Level"
              value={form.education_level}
              editing={editing}
              onChange={(v) => handleChange("education_level", v)}
              optional
            />
            <Field
              label="Additional Name"
              value={form.additional_name}
              editing={editing}
              onChange={(v) => handleChange("additional_name", v)}
              optional
            />
            <Field
              label="Website"
              value={form.website}
              editing={editing}
              onChange={(v) => handleChange("website", v)}
              optional
            />
            <Field
              label="Birthday"
              value={form.birthday}
              editing={editing}
              onChange={(v) => handleChange("birthday", v)}
              optional
              type="date"
            />
            <div />
          </Section>

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
                color:
                  message.toLowerCase().includes("success") ||
                  message.toLowerCase().includes("updated")
                    ? "#2e7d32"
                    : "#b23a3a",
                fontWeight: 700,
                whiteSpace: "pre-wrap",
              }}
            >
              {message}
            </div>

            {editing && (
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                style={btnBlue}
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, editing }) {
  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid #eef0f3",
          paddingBottom: 8,
        }}
      >
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ opacity: 0.7 }} />
        {editing && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
            Editing
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, editing, onChange, optional = false, type = "text" }) {
  return (
    <div style={fieldBox}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
        {label}
      </div>

      {editing ? (
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={optional ? "(optional)" : ""}
          style={input}
        />
      ) : (
        <div
          style={{
            marginTop: 6,
            fontWeight: 900,
            color: value ? "#111827" : "#9ca3af",
          }}
        >
          {value ? value : "(optional)"}
        </div>
      )}
    </div>
  );
}

const wrap = {
  width: "100%",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr",
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
  background:
    "conic-gradient(#22c55e 0deg 140deg, #3b82f6 140deg 260deg, #e5e7eb 260deg 360deg)",
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