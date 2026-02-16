"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function Home() {
  const router = useRouter()
  const [role, setRole] = useState("student")

  const handleLogin = (e) => {
    e.preventDefault()

    // Temporary login logic (we’ll connect backend later)
    if (role === "teacher") {
      router.push("/teacher")
    } else {
      router.push("/student")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-black">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        
        <h1 className="mb-6 text-2xl font-bold text-center text-black dark:text-white">
          Student Grade Portal
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full rounded-md border p-2"
          />

          <input
            type="password"
            placeholder="Password"
            required
            className="w-full rounded-md border p-2"
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border p-2"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>

          <button
            type="submit"
            className="w-full rounded-md bg-black p-2 text-white hover:bg-zinc-800"
          >
            Login
          </button>
        </form>

      </div>
    </div>
  )
}

