'use client'
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function TeacherDashboard() {
  const router = useRouter()

  useEffect(() => {
    const role = localStorage.getItem("role")
    if (role !== "teacher") router.replace("/login")
  }, [router])

  return (
    <div style={{ padding: 24 }}>
      <h1>Teacher Dashboard</h1>
      <p>Overview: classes, pending grading, quick actions.</p>
    </div>
  )
}