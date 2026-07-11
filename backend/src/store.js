import crypto from 'node:crypto'

const id = () => crypto.randomUUID()
const users = new Map()
const quizzes = new Map()
const sessions = new Map()
const results = []

export const store = {
  users, quizzes, sessions, results,
  findUserByEmail(email) {
    return [...users.values()].find((user) => user.email === email.toLowerCase())
  },
  createUser(input) {
    const user = { id: id(), ...input, email: input.email.toLowerCase(), createdAt: new Date().toISOString() }
    users.set(user.id, user)
    return user
  },
  createQuiz(ownerId, input) {
    const quiz = {
      id: id(), ownerId, title: input.title.trim(), description: input.description?.trim() || '',
      isPublic: input.isPublic !== false, createdAt: new Date().toISOString(),
      questions: input.questions.map((question, index) => ({
        id: id(), position: index, prompt: question.prompt.trim(), mediaType: question.mediaType || 'text',
        imageUrl: question.imageUrl || '', answerType: question.answerType || 'single',
        options: question.options.map((option) => ({ id: id(), text: option.text.trim(), correct: Boolean(option.correct) })),
        timeLimit: Math.min(120, Math.max(5, Number(question.timeLimit) || 20)), points: Number(question.points) || 1000,
      })),
    }
    quizzes.set(quiz.id, quiz)
    return quiz
  },
  createSession(quizId, hostId) {
    let code
    do code = String(Math.floor(100000 + Math.random() * 900000)); while ([...sessions.values()].some((s) => s.code === code))
    const session = { id: id(), quizId, hostId, code, status: 'lobby', questionIndex: -1, players: new Map(), answers: new Map(), timer: null, createdAt: new Date().toISOString() }
    sessions.set(session.id, session)
    return session
  },
  findSessionByCode(code) { return [...sessions.values()].find((session) => session.code === code) },
  publicQuiz(quiz) {
    return { ...quiz, questions: quiz.questions.map((q) => ({ ...q, options: q.options.map(({ correct: _correct, ...o }) => o) })) }
  },
}

export const sanitizeUser = ({ passwordHash: _passwordHash, ...user }) => user
