'use client'
import { useRouter } from "next/navigation"

export default function StudentSettings() {
  const router = useRouter()

  function logout() {
    localStorage.removeItem("role")
    localStorage.removeItem("userEmail")
    router.push("/login")
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Settings</h1>

      <button
        onClick={() => {
          if (confirm("Are you sure you want to log out?")) logout()
        }}
        style={{ background: "#EF4444", color: "#fff", padding: "10px 16px", borderRadius: 10 }}
      >
        Log out
      </button>
    </div>
  )
}