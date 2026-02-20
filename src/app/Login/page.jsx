'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState("student")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function handleLogin(e) {
    e.preventDefault()

    // ✅ demo auth: just store role (replace later with Supabase Auth)
    localStorage.setItem("role", role)
    localStorage.setItem("userEmail", email)

    if (role === "teacher") router.push("/teacher/dashboard")
    else router.push("/student/dashboard")
  }

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1>Login</h1>

      <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
        <div>
          <label>
            <input
              type="radio"
              name="role"
              checked={role === "teacher"}
              onChange={() => setRole("teacher")}
            />
            Teacher
          </label>
          {"  "}
          <label>
            <input
              type="radio"
              name="role"
              checked={role === "student"}
              onChange={() => setRole("student")}
            />
            Student
          </label>
        </div>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Log In</button>
      </form>
    </div>
  )
}