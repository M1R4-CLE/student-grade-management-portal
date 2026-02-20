"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("student");
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

    if (profile?.role && profile.role !== selectedRole) {
      return setErr(`This account is ${profile.role}. Please select ${profile.role.toUpperCase()}.`);
    }

    const role = profile?.role ?? selectedRole;
    router.replace(role === "teacher" ? "/teacher/Dashboard" : "/student/Dashboard");
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="logo-wrap">
          <Image
            src="/logo.png"
            alt="Student Grade Management Portal"
            width={330}
            height={90}
            priority
            className="logo"
          />
        </div>

        <h1 className="title">Welcome to Student Grade Management Portal</h1>

        <form onSubmit={onLogin} className="form">
          <div className="role-row">
            <label className="role-option">
              <input
                type="radio"
                name="role"
                value="teacher"
                checked={selectedRole === "teacher"}
                onChange={(e) => setSelectedRole(e.target.value)}
              />
              <span>TEACHER</span>
            </label>

            <label className="role-option">
              <input
                type="radio"
                name="role"
                value="student"
                checked={selectedRole === "student"}
                onChange={(e) => setSelectedRole(e.target.value)}
              />
              <span>STUDENT</span>
            </label>
          </div>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email address"
            className="input"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            className="input"
            required
          />

          {err ? <p className="error">{err}</p> : null}

          <button type="submit" className="login-btn">
            LOG IN
          </button>

          <button type="button" className="forgot-btn">
            Forgot Login
          </button>
        </form>
      </section>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: radial-gradient(circle at center, #f5f5f5 0%, #d8d8d8 100%);
          padding: 20px;
        }

        .login-card {
          width: 100%;
          max-width: 430px;
          background: #d7d7d9;
          border: 1px solid #c2c2c5;
          border-radius: 10px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
          padding: 18px 34px 22px;
        }

        .logo-wrap {
          display: flex;
          justify-content: center;
          margin-top: -8px;
          margin-bottom: 8px;
        }

        .logo {
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        .title {
          text-align: center;
          font-size: 34px;
          line-height: 1.2;
          margin: 8px 0 20px;
          color: #111;
          font-weight: 500;
        }

        .form {
          display: grid;
          gap: 10px;
        }

        .role-row {
          display: flex;
          gap: 30px;
          justify-content: center;
          margin-bottom: 4px;
        }

        .role-option {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 31px;
          color: #333;
          user-select: none;
        }

        .input {
          height: 53px;
          border: 1px solid #cecece;
          background: #efefef;
          padding: 0 10px;
          font-size: 38px;
          color: #222;
          outline: none;
        }

        .input:focus {
          border-color: #9f9f9f;
          background: #f6f6f6;
        }

        .login-btn {
          margin-top: 6px;
          height: 56px;
          border: 1px solid #8f8f8f;
          background: #efefef;
          font-size: 40px;
          letter-spacing: 0.5px;
          color: #111;
          cursor: pointer;
        }

        .login-btn:hover {
          background: #e8e8e8;
        }

        .forgot-btn {
          margin-top: 4px;
          background: transparent;
          border: none;
          color: #4a4a4a;
          text-decoration: underline;
          font-size: 39px;
          cursor: pointer;
          justify-self: center;
          padding: 0;
        }

        .error {
          margin: 2px 0 0;
          color: #b30000;
          font-size: 18px;
          text-align: center;
        }

        @media (max-width: 900px) {
          .title {
            font-size: 22px;
          }

          .role-option {
            font-size: 20px;
          }

          .input {
            font-size: 24px;
            height: 44px;
          }

          .login-btn {
            font-size: 28px;
            height: 46px;
          }

          .forgot-btn {
            font-size: 20px;
          }
        }
      `}</style>
    </main>
  );
}