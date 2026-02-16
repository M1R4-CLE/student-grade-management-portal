"use client"

import { useMemo } from "react"

export default function GradesPage() {
  // Temporary static data (we connect database later)
  const grades = {
    quizzes: [85, 90, 88],
    assignments: [92, 87],
    activities: [95, 93, 90],
    exam: 89,
  }

  const calculateAverage = (arr) => {
    if (!arr.length) return 0
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }

  const finalGrade = useMemo(() => {
    const quizAvg = calculateAverage(grades.quizzes)
    const assignAvg = calculateAverage(grades.assignments)
    const actAvg = calculateAverage(grades.activities)

    return (
      quizAvg * 0.3 +
      assignAvg * 0.3 +
      actAvg * 0.2 +
      grades.exam * 0.2
    )
  }, [])

  const getLetterGrade = (grade) => {
    if (grade >= 90) return "A"
    if (grade >= 80) return "B"
    if (grade >= 70) return "C"
    if (grade >= 60) return "D"
    return "F"
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Grade Card</h1>

      {/* Grade Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow mb-6">
        <table className="w-full text-left border-collapse">
          <thead className="bg-zinc-200">
            <tr>
              <th className="p-3">Category</th>
              <th className="p-3">Scores</th>
              <th className="p-3">Average</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3">Quizzes (30%)</td>
              <td className="p-3">{grades.quizzes.join(", ")}</td>
              <td className="p-3">
                {calculateAverage(grades.quizzes).toFixed(2)}
              </td>
            </tr>

            <tr className="border-t">
              <td className="p-3">Assignments (30%)</td>
              <td className="p-3">{grades.assignments.join(", ")}</td>
              <td className="p-3">
                {calculateAverage(grades.assignments).toFixed(2)}
              </td>
            </tr>

            <tr className="border-t">
              <td className="p-3">Activities (20%)</td>
              <td className="p-3">{grades.activities.join(", ")}</td>
              <td className="p-3">
                {calculateAverage(grades.activities).toFixed(2)}
              </td>
            </tr>

            <tr className="border-t">
              <td className="p-3">Exam (20%)</td>
              <td className="p-3">{grades.exam}</td>
              <td className="p-3">{grades.exam}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Final Grade Card */}
      <div className="bg-black text-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Final Grade</h2>
        <p className="text-3xl font-bold">
          {finalGrade.toFixed(2)} ({getLetterGrade(finalGrade)})
        </p>
      </div>
    </div>
  )
}
