"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  const onLogin = async (e) => {
    e.preventDefault();
    setErr("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return setErr(error.message);

    const userId = data.user.id;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (pErr || !profile) return setErr("Profile not found. Ask admin to create your profile.");

    router.replace(profile.role === "teacher" ? "/teacher/Dashboard" : "/student/Dashboard");
  };

  return (
    <main className="login-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form
        onSubmit={onLogin}
        style={{
          width: 360,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <h1 style={{ marginBottom: 12 }}>Login</h1>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        {err && <p style={{ color: "red", marginBottom: 10 }}>{err}</p>}

        <button type="submit" style={{ width: "100%", padding: 10, cursor: "pointer" }}>
          Login
        </button>
      </form>
    </main>
  );
}