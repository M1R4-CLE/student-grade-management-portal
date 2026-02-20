"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  const onLogin = async (e) => {
    e.preventDefault();
    setErr("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setErr(error.message);

    const userId = data.user.id;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (pErr) return setErr("Profile not found. Ask admin to create your profile.");

    router.replace(profile.role === "teacher" ? "/teacher/Dashboard" : "/student/Dashboard");
  };

  return (
    <form onSubmit={onLogin}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
      {err && <p style={{ color: "red" }}>{err}</p>}
      <button type="submit">Login</button>
    </form>
  );
}