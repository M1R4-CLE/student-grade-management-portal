'use client'
import { useMemo, useState } from "react"

export default function GradeEntry() {
  const [rows, setRows] = useState([
    { id: 1, name: "Student A", attendance: 90, quiz: 85, exam: 88 },
    { id: 2, name: "Student B", attendance: 95, quiz: 80, exam: 84 },
  ])

  // example formula: 20% attendance, 30% quiz, 50% exam
  const computed = useMemo(() => {
    return rows.map(r => {
      const finalGrade =
        (r.attendance * 0.2) +
        (r.quiz * 0.3) +
        (r.exam * 0.5)
      return { ...r, finalGrade: Math.round(finalGrade) }
    })
  }, [rows])

  function update(id, key, value) {
    setRows(prev =>
      prev.map(r => (r.id === id ? { ...r, [key]: Number(value) } : r))
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Grade Entry</h1>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Student</th>
            <th>Attendance</th>
            <th>Quiz</th>
            <th>Exam</th>
            <th>Final Grade</th>
          </tr>
        </thead>
        <tbody>
          {computed.map(r => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td><input value={r.attendance} onChange={(e)=>update(r.id,"attendance",e.target.value)} /></td>
              <td><input value={r.quiz} onChange={(e)=>update(r.id,"quiz",e.target.value)} /></td>
              <td><input value={r.exam} onChange={(e)=>update(r.id,"exam",e.target.value)} /></td>
              <td><b>{r.finalGrade}%</b></td>
            </tr>
          ))}
        </tbody>
      </table>

      <button style={{ marginTop: 16 }}>Save Grades (next: Supabase)</button>
    </div>
  )
}