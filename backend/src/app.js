import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { requireAuth, signToken } from './auth.js'
import { sanitizeUser, store } from './store.js'
import { validateQuiz } from './validation.js'

export function createApp() {
  const app = express()
  app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }))
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => res.json({ ok: true, storage: 'memory', timestamp: new Date().toISOString() }))

  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || String(password || '').length < 6) {
      return res.status(400).json({ error: 'Введите имя, корректный email и пароль от 6 символов' })
    }
    if (store.findUserByEmail(email)) return res.status(409).json({ error: 'Этот email уже зарегистрирован' })
    const user = store.createUser({ name: name.trim(), email, passwordHash: await bcrypt.hash(password, 10) })
    res.status(201).json({ token: signToken(user), user: sanitizeUser(user) })
  })

  app.post('/api/auth/login', async (req, res) => {
    const user = store.findUserByEmail(req.body.email || '')
    if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash))) return res.status(401).json({ error: 'Неверный email или пароль' })
    res.json({ token: signToken(user), user: sanitizeUser(user) })
  })

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = store.users.get(req.auth.sub)
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
    res.json({ user: sanitizeUser(user) })
  })

  app.get('/api/quizzes', (req, res) => {
    const list = [...store.quizzes.values()].filter((q) => q.isPublic || q.ownerId === req.auth?.sub).map((q) => ({ ...store.publicQuiz(q), questionCount: q.questions.length }))
    res.json({ quizzes: list })
  })

  app.get('/api/quizzes/:id', (req, res) => {
    const quiz = store.quizzes.get(req.params.id)
    if (!quiz) return res.status(404).json({ error: 'Квиз не найден' })
    res.json({ quiz: store.publicQuiz(quiz) })
  })

  app.post('/api/quizzes', requireAuth, (req, res) => {
    const error = validateQuiz(req.body)
    if (error) return res.status(400).json({ error })
    res.status(201).json({ quiz: store.createQuiz(req.auth.sub, req.body) })
  })

  app.post('/api/sessions', requireAuth, (req, res) => {
    const quiz = store.quizzes.get(req.body.quizId)
    if (!quiz) return res.status(404).json({ error: 'Квиз не найден' })
    const session = store.createSession(quiz.id, req.auth.sub)
    res.status(201).json({ session: { id: session.id, code: session.code, status: session.status } })
  })

  app.get('/api/profile/history', requireAuth, (req, res) => {
    const owned = [...store.quizzes.values()].filter((q) => q.ownerId === req.auth.sub).map((q) => ({ id: q.id, title: q.title, questionCount: q.questions.length, createdAt: q.createdAt }))
    const played = store.results.filter((r) => r.userId === req.auth.sub)
    res.json({ quizzes: owned, games: played })
  })

  app.use((err, _req, res, _next) => {
    console.error(err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  })
  return app
}
