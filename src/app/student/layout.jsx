export default function StudentLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-zinc-900 text-white p-6">
        <nav className="space-y-4">
          <a href="/student" className="block hover:text-gray-300">
            Dashboard
          </a>
          <a href="/student/grades" className="block hover:text-gray-300">
            My Grades
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
