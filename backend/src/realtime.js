import crypto from 'node:crypto'
import { verifyToken } from './auth.js'
import { store } from './store.js'

const roomName = (code) => `quizy:${code}`
const sessionState = (session) => ({
  id: session.id, code: session.code, status: session.status, questionIndex: session.questionIndex,
  players: [...session.players.values()].map(({ socketId: _socketId, ...p }) => p),
})
const leaderboard = (session) => [...session.players.values()].map(({ socketId: _socketId, ...p }) => p).sort((a, b) => b.score - a.score)

export function attachRealtime(io) {
  const broadcast = (session) => io.to(roomName(session.code)).emit('session:state', sessionState(session))

  function finish(session) {
    clearTimeout(session.timer)
    session.status = 'finished'
    const board = leaderboard(session).map((p, index) => ({ ...p, rank: index + 1 }))
    for (const player of board) store.results.push({ id: crypto.randomUUID(), sessionId: session.id, userId: player.userId, playerName: player.name, score: player.score, correctAnswers: player.correctAnswers, rank: player.rank, createdAt: new Date().toISOString() })
    io.to(roomName(session.code)).emit('game:finished', { leaderboard: board })
    broadcast(session)
  }

  function reveal(session) {
    if (session.status !== 'question') return
    clearTimeout(session.timer)
    session.status = 'reveal'
    const quiz = store.quizzes.get(session.quizId)
    const question = quiz.questions[session.questionIndex]
    io.to(roomName(session.code)).emit('question:result', {
      correctOptionIds: question.options.filter((o) => o.correct).map((o) => o.id), leaderboard: leaderboard(session),
    })
    broadcast(session)
  }

  function nextQuestion(session) {
    const quiz = store.quizzes.get(session.quizId)
    if (session.questionIndex + 1 >= quiz.questions.length) return finish(session)
    session.questionIndex += 1
    session.answers = new Map()
    session.status = 'question'
    const question = quiz.questions[session.questionIndex]
    const endsAt = Date.now() + question.timeLimit * 1000
    io.to(roomName(session.code)).emit('question:started', {
      index: session.questionIndex, total: quiz.questions.length, endsAt,
      question: { ...question, options: question.options.map(({ correct: _correct, ...option }) => option) },
    })
    broadcast(session)
    session.timer = setTimeout(() => reveal(session), question.timeLimit * 1000)
  }

  io.on('connection', (socket) => {
    socket.on('session:join', ({ code, name, playerId, token }, reply = () => {}) => {
      const session = store.findSessionByCode(String(code || '').trim())
      if (!session) return reply({ ok: false, error: 'Комната не найдена' })
      let userId = null
      try { userId = token ? verifyToken(token).sub : null } catch { /* guest */ }
      const stableId = playerId && session.players.has(playerId) ? playerId : crypto.randomUUID()
      const previous = session.players.get(stableId)
      session.players.set(stableId, { id: stableId, userId: previous?.userId || userId, name: previous?.name || String(name || 'Игрок').slice(0, 30), score: previous?.score || 0, correctAnswers: previous?.correctAnswers || 0, connected: true, socketId: socket.id })
      socket.data = { sessionId: session.id, playerId: stableId }
      socket.join(roomName(session.code))
      reply({ ok: true, playerId: stableId, session: sessionState(session) })
      broadcast(session)
    })

    socket.on('host:start', ({ code }, reply = () => {}) => {
      const session = store.findSessionByCode(code)
      if (!session || session.hostId !== socket.data.userId) return reply({ ok: false, error: 'Только ведущий может начать игру' })
      nextQuestion(session); reply({ ok: true })
    })

    socket.on('host:authorize', ({ code, token }, reply = () => {}) => {
      try {
        const session = store.findSessionByCode(code)
        const userId = verifyToken(token).sub
        if (!session || session.hostId !== userId) throw new Error()
        socket.data = { ...socket.data, sessionId: session.id, userId, host: true }
        socket.join(roomName(session.code)); reply({ ok: true, session: sessionState(session) })
      } catch { reply({ ok: false, error: 'Нет доступа ведущего' }) }
    })

    socket.on('host:next', ({ code }, reply = () => {}) => {
      const session = store.findSessionByCode(code)
      if (!session || session.hostId !== socket.data.userId) return reply({ ok: false })
      nextQuestion(session); reply({ ok: true })
    })

    socket.on('answer:submit', ({ optionIds }, reply = () => {}) => {
      const session = store.sessions.get(socket.data.sessionId)
      const player = session?.players.get(socket.data.playerId)
      if (!session || !player || session.status !== 'question' || session.answers.has(player.id)) return reply({ ok: false, error: 'Ответ уже принят или время вышло' })
      const question = store.quizzes.get(session.quizId).questions[session.questionIndex]
      const selected = [...new Set(optionIds || [])].sort()
      const correct = question.options.filter((o) => o.correct).map((o) => o.id).sort()
      const isCorrect = JSON.stringify(selected) === JSON.stringify(correct)
      if (isCorrect) { player.score += question.points; player.correctAnswers += 1 }
      session.answers.set(player.id, selected)
      reply({ ok: true, correct: isCorrect })
      if (session.answers.size >= [...session.players.values()].filter((p) => p.connected).length) reveal(session)
    })

    socket.on('disconnect', () => {
      const session = store.sessions.get(socket.data.sessionId)
      const player = session?.players.get(socket.data.playerId)
      if (player) { player.connected = false; broadcast(session) }
    })
  })
}
