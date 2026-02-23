"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

const emptyForm = {
  full_name: "",
  pronoun: "",
  company: "",
  job_title: "",
  department: "",
  mailing_address: "",
  phone_number: "",
  business_fax: "",
  gender: "",
  additional_name: "",
  birthday: "",
  education_level: "",
  website: "",
  cloud_focus: "",
};

export default function TeacherProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setMessage("");

      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        setMessage(authErr.message);
        setLoading(false);
        return;
      }

      const user = authRes.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || "");

      const userMeta = user.user_metadata || {};

      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id, role, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) setMessage(profileErr.message);

      if (profileData?.role && profileData.role !== "teacher") {
        router.replace("/student/Dashboard");
        return;
      }

      setAvatarUrl(profileData?.avatar_url || userMeta.avatar_url || "");

      setForm({
        full_name: profileData?.full_name || userMeta.full_name || "",
        pronoun: userMeta.pronoun || "",
        company: userMeta.company || "",
        job_title: userMeta.job_title || "",
        department: userMeta.department || "",
        mailing_address: userMeta.mailing_address || "",
        phone_number: userMeta.phone_number || "",
        business_fax: userMeta.business_fax || "",
        gender: userMeta.gender || "",
        additional_name: userMeta.additional_name || "",
        birthday: userMeta.birthday || "",
        education_level: userMeta.education_level || "",
        website: userMeta.website || "",
        cloud_focus: userMeta.cloud_focus || "Cloud Computing, AI and Computer Vision",
      });

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickImage = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setMessage("Image is too large. Max size is 3MB.");
      return;
    }

    setUploadingImage(true);
    setMessage("");

    const safeName = file.name.replace(/\s+/g, "_");
    const path = `profile-images/${userId}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setMessage(uploadErr.message);
      setUploadingImage(false);
      return;
    }

    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = publicData?.publicUrl || "";

    if (!newUrl) {
      setMessage("Failed to get image URL.");
      setUploadingImage(false);
      return;
    }

    setAvatarUrl(newUrl);

    await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: form.full_name || "Teacher User",
        avatar_url: newUrl,
      },
      { onConflict: "id" }
    );

    await supabase.auth.updateUser({
      data: {
        ...form,
        avatar_url: newUrl,
      },
    });

    setMessage("Profile image updated successfully.");
    setUploadingImage(false);
  };

  const saveProfile = async () => {
    if (!userId) return;

    setSavingProfile(true);
    setMessage("");

    const { error: profileErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: form.full_name || "Teacher User",
        avatar_url: avatarUrl || null,
      },
      { onConflict: "id" }
    );

    if (profileErr) {
      setMessage(profileErr.message);
      setSavingProfile(false);
      return;
    }

    const { error: metaErr } = await supabase.auth.updateUser({
      data: {
        ...form,
        avatar_url: avatarUrl || "",
      },
    });

    if (metaErr) {
      setMessage(metaErr.message);
      setSavingProfile(false);
      return;
    }

    setMessage("Profile updated successfully.");
    setEditing(false);
    setSavingProfile(false);
  };

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setMessage("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSavingPassword(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(error.message);
      setSavingPassword(false);
      return;
    }

    setMessage("Password changed successfully.");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordBox(false);
    setSavingPassword(false);
  };

  const renderField = (label, key, type = "text") => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "#777", marginBottom: 4 }}>{label}</div>
      {editing ? (
        <input
          type={type}
          value={form[key] || ""}
          onChange={(e) => handleChange(key, e.target.value)}
          style={inputStyle}
        />
      ) : (
        <div style={{ minHeight: 22, color: "#333" }}>{form[key] || "-"}</div>
      )}
    </div>
  );

  if (loading) return <div style={{ padding: 24 }}>Loading profile...</div>;

  return (
    <div style={{ padding: 16, background: "#f5f5f5", minHeight: "100%" }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={avatarStyle}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                />
              ) : (
                <span style={{ fontSize: 30 }}>👤</span>
              )}
            </div>

            <div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#2f2f2f" }}>
                {form.full_name || "Teacher User"}
              </div>
              <div style={{ color: "#777" }}>{email || "teacher@email.com"}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                {form.cloud_focus || "Cloud Computing, AI and Computer Vision"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />

            <button onClick={pickImage} disabled={uploadingImage} style={secondaryBtn}>
              {uploadingImage ? "Uploading..." : "Change Image"}
            </button>

            <button onClick={() => setEditing((prev) => !prev)} style={primaryBtn}>
              {editing ? "Cancel Edit" : "Edit Profile"}
            </button>

            <button onClick={() => setShowPasswordBox((prev) => !prev)} style={secondaryBtn}>
              Change Password
            </button>
          </div>
        </div>
      </div>

      {showPasswordBox && (
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Change Password</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={changePassword} disabled={savingPassword} style={primaryBtn}>
              {savingPassword ? "Saving..." : "Update Password"}
            </button>
          </div>
        </div>
      )}

      <Section title="Basic Information">
        {renderField("Full Name", "full_name")}
        {renderField("Company", "company")}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "#777", marginBottom: 4 }}>Email Address</div>
          <div style={{ minHeight: 22, color: "#333" }}>{email || "-"}</div>
        </div>
        {renderField("Job Title", "job_title")}
        {renderField("Pronoun", "pronoun")}
        {renderField("Department", "department")}
      </Section>

      <Section title="Contact Information">
        {renderField("Mailing Address", "mailing_address")}
        {renderField("Phone Number", "phone_number")}
        {renderField("Business Fax Number", "business_fax")}
      </Section>

      <Section title="Additional Information">
        {renderField("Gender", "gender")}
        {renderField("Education Level", "education_level")}
        {renderField("Additional Name", "additional_name")}
        {renderField("Website", "website")}
        {renderField("Birthday", "birthday", "date")}
      </Section>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: message.toLowerCase().includes("success") ? "#2e7d32" : "#b23a3a" }}>{message}</div>

        {editing && (
          <button onClick={saveProfile} disabled={savingProfile} style={primaryBtn}>
            {savingProfile ? "Saving..." : "Save Profile"}
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={sectionStyle}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{title} </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12,
};

const sectionStyle = {
  marginTop: 12,
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 6,
  padding: 12,
};

const avatarStyle = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  border: "2px solid #222",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff",
};

const inputStyle = {
  width: "100%",
  height: 36,
  borderRadius: 6,
  border: "1px solid #cfcfcf",
  padding: "0 10px",
  outline: "none",
};

const primaryBtn = {
  border: "none",
  background: "#2f5ea8",
  color: "#fff",
  borderRadius: 6,
  height: 34,
  padding: "0 14px",
  cursor: "pointer",
};

const secondaryBtn = {
  border: "1px solid #d5d5d5",
  background: "#fff",
  color: "#333",
  borderRadius: 6,
  height: 34,
  padding: "0 14px",
  cursor: "pointer",
};
