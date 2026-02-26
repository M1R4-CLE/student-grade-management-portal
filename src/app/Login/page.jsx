"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      setErr("No session created. Try again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (pErr || !profile) {
      setErr("Profile not found. Ask admin.");
      setLoading(false);
      return;
    }

    router.replace(
      profile.role === "teacher"
        ? "/teacher/Dashboard"
        : "/student/Dashboard"
    );
  };

  return (
    <main
      className="loginWrap"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        backgroundImage: "url('/images/BG.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="loginCard">
        <div style={{ transform: "scale(0.95)", display: "grid", placeItems: "center" }}>
          <BrandLogo />
          <div style={{ marginTop: 10, marginBottom: 10, fontWeight: 700, textAlign: "center" }}>
            Welcome to Student Grade
            <br />
            Management Portal
          </div>
        </div>

        <form onSubmit={onLogin} className="loginForm">
          <input
            className="loginInput"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            required
          />

          {/* Password (toggle inside, no layout change) */}
          <div style={{ position: "relative", width: "300px", justifySelf: "center" }}>
            <input
              className="loginInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              required
              style={{ width: "100%", maxWidth: "none", paddingRight: "52px" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                padding: 0,
                margin: 0,
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                lineHeight: 1,
                opacity: 0.7,
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {err && <p className="loginError">{err}</p>}

          <button className="loginBtn" type="submit" disabled={loading}>
            {loading ? "LOGGING IN..." : "LOG IN"}
          </button>

          <Link href="/forgot-password" className="forgotBtn">
            Forgot Login
          </Link>
        </form>
      </div>
    </main>
  );
}
