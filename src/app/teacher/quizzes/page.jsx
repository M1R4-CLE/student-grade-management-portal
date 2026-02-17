"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function QuizzesPage() {
  const [studentName, setStudentName] = useState("")
  const [score, setScore] = useState("")
  const [quizList, setQuizList] = useState([])

  // 🔥 Fetch quizzes from backend
  const fetchQuizzes = async () => {
    const res = await fetch("/api/quizzes")
    const data = await res.json()
    setQuizList(data)
  }

  useEffect(() => {
    fetchQuizzes()
  }, [])

  // 🔥 Send quiz to backend
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!studentName || !score) return

    await fetch("/api/quizzes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentName,
        score: Number(score),
      }),
    })

    setStudentName("")
    setScore("")
    fetchQuizzes() // refresh list after adding
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add Quiz Score</h1>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow mb-6 space-y-4"
      >
        <input
          type="text"
          placeholder="Student Name"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          className="w-full border p-2 rounded"
        />

        <input
          type="number"
          placeholder="Quiz Score"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-full border p-2 rounded"
        />

        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded hover:bg-zinc-800"
        >
          Add Quiz
        </button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead className="bg-zinc-200">
            <tr>
              <th className="p-3 text-left">Student</th>
              <th className="p-3 text-left">Score</th>
            </tr>
          </thead>
          <tbody>
            {quizList.map((quiz, index) => (
              <tr key={index} className="border-t">
                <td className="p-3">{quiz.studentName}</td>
                <td className="p-3">{quiz.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const router = useRouter()

useEffect(() => {
  const role = localStorage.getItem("role")
  if (role !== "teacher") {
    router.push("/login")
  }
}, [])

