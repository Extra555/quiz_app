import 'dotenv/config'
import http from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app.js'
import { attachRealtime } from './realtime.js'

const app = createApp()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL?.split(',') || true } })
attachRealtime(io)

const port = Number(process.env.PORT) || 3001
server.listen(port, () => console.log(`Quizy API: http://localhost:${port}`))
