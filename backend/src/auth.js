import jwt from 'jsonwebtoken'

const secret = () => process.env.JWT_SECRET || 'quizy-local-development-secret'
export const signToken = (user) => jwt.sign({ sub: user.id, email: user.email }, secret(), { expiresIn: '7d' })
export const verifyToken = (token) => jwt.verify(token, secret())

export function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) throw new Error('missing token')
    req.auth = verifyToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Требуется авторизация' })
  }
}
