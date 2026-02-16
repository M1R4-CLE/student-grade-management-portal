"use client"

import { useState } from "react"

export default function QuizzesPage() {
  const [studentName, setStudentName] = useState("")
  const [score, setScore] = useState("")
  const [quizList, setQuizList] = useState([])

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!studentName || !score) return

    const newQuiz = {
      studentName,
      score: Number(score),
    }

    setQuizList([...quizList, newQuiz])
    setStudentName("")
    setScore("")
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
