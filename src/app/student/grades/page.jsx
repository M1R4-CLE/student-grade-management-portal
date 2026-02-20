'use client'
import { useMemo } from "react"

export default function StudentGrades() {
  const gradebook = [
    { code: "IS 101", name: "Data Structures", credits: 2, midterm: 78, final: 78 },
    { code: "IS 102", name: "DBMS", credits: 3, midterm: 88, final: 88 },
    { code: "IS 103", name: "SAD", credits: 4, midterm: 83, final: 83 },
  ]

  const { totalCredits, weightedFinal } = useMemo(() => {
    const creditsSum = gradebook.reduce((s, c) => s + c.credits, 0)
    const weightedPoints = gradebook.reduce((s, c) => s + (c.final * c.credits), 0)
    return {
      totalCredits: creditsSum,
      weightedFinal: creditsSum ? (weightedPoints / creditsSum).toFixed(2) : "0.00",
    }
  }, [gradebook])

  return (
    <div style={{ padding: 24 }}>
      <h1>My Grades</h1>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Course</th><th>Credits</th><th>Midterm</th><th>Final</th>
          </tr>
        </thead>
        <tbody>
          {gradebook.map((c) => (
            <tr key={c.code}>
              <td>{c.code} - {c.name}</td>
              <td>{c.credits}</td>
              <td>{c.midterm}%</td>
              <td>{c.final}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 12 }}>
        <b>Total Credits:</b> {totalCredits} &nbsp; | &nbsp;
        <b>Weighted Final Average:</b> {weightedFinal}%
      </p>
    </div>
  )
}