"use client";

import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="loginWrap">
      <div className="loginCard">
        <h1 style={{ textAlign: "center", marginBottom: 12 }}>
          Forgot Password
        </h1>

        <p style={{ textAlign: "center", color: "#6b7280", marginBottom: 20 }}>
          Password reset via email is not enabled.
          <br />
          Please contact the system administrator
          <br />
          to reset your account.
        </p>

        <div className="loginForm">
          <Link href="/login" className="loginBtn" style={{ textAlign: "center" }}>
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}