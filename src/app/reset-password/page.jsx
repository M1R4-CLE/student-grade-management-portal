"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    // When user opens the reset link, Supabase sets a recovery session automatically
    // (as long as redirectTo is correct and URL is allowed in Supabase dashboard)
  }, []);

  const updatePassword = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) return setErr(error.message);

    setMsg("Password updated! Redirecting to login...");
    setTimeout(() => router.replace("/login"), 800);
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form
        onSubmit={updatePassword}
        style={{
          width: 360,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <h1 style={{ marginBottom: 12 }}>Reset Password</h1>

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          type="password"
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        {err && <p style={{ color: "red" }}>{err}</p>}
        {msg && <p style={{ color: "green" }}>{msg}</p>}

        <button type="submit" style={{ width: "100%", padding: 10 }}>
          Update password
        </button>
      </form>
    </main>
  );
}