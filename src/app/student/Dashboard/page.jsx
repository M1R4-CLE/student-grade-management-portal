'use client'
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function StudentDashboard() {
  const router = useRouter()

  useEffect(() => {
    const role = localStorage.getItem("role")
    if (role !== "student") router.replace("/login")
  }, [router])

  return (
    <div style={{ padding: 24 }}>
      <h1>Student Dashboard</h1>
      <p>Overview: classes, pending grading, quick actions.</p>
    </div>
  )
}