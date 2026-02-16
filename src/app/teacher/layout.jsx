export default function TeacherLayout({ children }) {
  return (
    <div className="min-h-screen flex">

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-black text-white p-6">
        <nav className="space-y-4">
          <a href="/teacher" className="block hover:text-gray-300">
            Dashboard
          </a>
          <a href="/teacher/quizzes" className="block hover:text-gray-300">
            Quizzes
          </a>
          <a href="/teacher/assignments" className="block hover:text-gray-300">
            Assignments
          </a>
          <a href="/teacher/exams" className="block hover:text-gray-300">
            Exams
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-zinc-100">
        {children}
      </main>

    </div>
  )
}
