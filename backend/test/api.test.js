import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createApp } from '../src/app.js'

test('health, auth and quiz lifecycle', async (t) => {
  const server = http.createServer(createApp()).listen(0)
  t.after(() => server.close())
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api`
  const health = await fetch(`${base}/health`).then((r) => r.json())
  assert.equal(health.ok, true)
  const auth = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Тест', email: `test-${Date.now()}@quizy.dev`, password: 'secret1' }) }).then((r) => r.json())
  assert.ok(auth.token)
  const response = await fetch(`${base}/quizzes`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ title: 'Тестовый квиз', questions: [{ prompt: '2 + 2?', answerType: 'single', options: [{ text: '4', correct: true }, { text: '5', correct: false }] }] }) })
  assert.equal(response.status, 201)
  const { quiz } = await response.json()
  assert.equal(quiz.questions.length, 1)
})
