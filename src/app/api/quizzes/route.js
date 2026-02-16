let quizzes = []

export async function GET() {
  return Response.json(quizzes)
}

export async function POST(request) {
  const body = await request.json()
  quizzes.push(body)

  return Response.json({ message: "Quiz added successfully" })
}
