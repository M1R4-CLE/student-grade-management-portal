"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function StudentProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserEmail(user.email || "");

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      if (pErr || !profile) {
        setErr(pErr?.message || "Profile not found.");
        setLoading(false);
        return;
      }

      if (profile.role === "teacher") {
        router.replace("/teacher/Dashboard");
        return;
      }

      setFullName(profile.full_name || "");
      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (err) return <div style={{ padding: 24, color: "red" }}>{err}</div>;

  return (
    <div style={{ fontFamily: "var(--font-main)" }}>
      {/* Header */}
      <div className="glassCard" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--blue-dark)" }}>
              {fullName || "Student User"}
            </div>
            <div style={{ color: "var(--gray-brand)", fontWeight: 700, marginTop: 4 }}>
              {userEmail}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="loginBtn"
              style={{ width: "auto", maxWidth: "none", borderRadius: 10 }}
              type="button"
              onClick={() => alert("Edit Profile form can be added next")}
            >
              ✏️ Edit Profile
            </button>

            <button
              className="loginBtn"
              style={{
                width: "auto",
                maxWidth: "none",
                borderRadius: 10,
                borderColor: "rgba(47,111,179,.35)",
                color: "var(--blue-dark)",
              }}
              type="button"
              onClick={() => router.push("/reset-password")}
            >
              🔒 Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="glassCard" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 900, color: "var(--blue-main)", marginBottom: 10 }}>
          Basic Information
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Full Name" value={fullName || "(not set)"} />
          <Field label="Email Address" value={userEmail || "(not set)"} />
          <Field label="Pronoun" value="(optional)" />
          <Field label="Department" value="(optional)" />
        </div>
      </div>

      <div className="glassCard" style={{ padding: 16 }}>
        <div style={{ fontWeight: 900, color: "var(--blue-main)", marginBottom: 10 }}>
          Contact Information
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Mailing Address" value="(optional)" />
          <Field label="Phone Number" value="(optional)" />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,.65)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--gray-brand)", fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontWeight: 800, color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}