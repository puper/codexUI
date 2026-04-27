import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { RequestHandler, Request, Response, NextFunction } from 'express'

const MAX_LOGIN_BODY_BYTES = 4096
const LOGIN_WINDOW_MS = 10 * 60 * 1000
const LOGIN_LOCK_MS = 60 * 1000
const MAX_FAILED_LOGIN_ATTEMPTS = 5
const WEBSOCKET_PROTOCOL_PREFIX = 'codexui-bearer.'

type LoginAttemptState = {
  count: number
  firstFailedAt: number
  lockedUntil: number
}

export type BearerAuth = {
  middleware: RequestHandler
  isRequestAuthorized: (req: IncomingMessage) => boolean
}

const loginAttempts = new Map<string, LoginAttemptState>()

function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function readRemoteAddress(req: IncomingMessage): string {
  return req.socket.remoteAddress || 'unknown'
}

function readBearerToken(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return ''
  const match = /^Bearer\s+(.+)$/iu.exec(value.trim())
  return match?.[1]?.trim() ?? ''
}

function readWebSocketBearerToken(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header.join(',') : (header ?? '')
  for (const part of value.split(',')) {
    const protocol = part.trim()
    if (!protocol.startsWith(WEBSOCKET_PROTOCOL_PREFIX)) continue
    const encoded = protocol.slice(WEBSOCKET_PROTOCOL_PREFIX.length)
    try {
      return Buffer.from(encoded, 'base64url').toString('utf8')
    } catch {
      return ''
    }
  }
  return ''
}

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/codex-api/')
    || pathname === '/codex-local-image'
    || pathname === '/codex-local-file'
    || pathname === '/codex-local-directories'
    || pathname.startsWith('/codex-local-browse')
    || pathname.startsWith('/codex-local-edit')
}

function readRequestPath(req: Request): string {
  const directPath = (req as Request & { path?: unknown }).path
  if (typeof directPath === 'string' && directPath.length > 0) {
    return directPath
  }
  try {
    return new URL(req.url, 'http://localhost').pathname
  } catch {
    return ''
  }
}

function isLoginLimited(remoteAddress: string): number {
  const state = loginAttempts.get(remoteAddress)
  if (!state) return 0
  const now = Date.now()
  if (state.lockedUntil > now) return state.lockedUntil - now
  if (now - state.firstFailedAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(remoteAddress)
  }
  return 0
}

function recordLoginFailure(remoteAddress: string): void {
  const now = Date.now()
  const current = loginAttempts.get(remoteAddress)
  const state = !current || now - current.firstFailedAt > LOGIN_WINDOW_MS
    ? { count: 0, firstFailedAt: now, lockedUntil: 0 }
    : current
  state.count += 1
  if (state.count >= MAX_FAILED_LOGIN_ATTEMPTS) {
    state.lockedUntil = now + LOGIN_LOCK_MS
  }
  loginAttempts.set(remoteAddress, state)
}

function clearLoginFailures(remoteAddress: string): void {
  loginAttempts.delete(remoteAddress)
}

function sendJson(res: Response, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readJsonBody(req: Request, res: Response, onBody: (value: Record<string, unknown>) => void): void {
  let body = ''
  req.setEncoding('utf8')
  req.on('data', (chunk: string) => {
    body += chunk
    if (Buffer.byteLength(body, 'utf8') > MAX_LOGIN_BODY_BYTES) {
      sendJson(res, 413, { error: 'Request body too large' })
      req.destroy()
    }
  })
  req.on('end', () => {
    if (res.headersSent) return
    try {
      const parsed = JSON.parse(body) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        sendJson(res, 400, { error: 'Invalid request body' })
        return
      }
      onBody(parsed as Record<string, unknown>)
    } catch {
      sendJson(res, 400, { error: 'Invalid request body' })
    }
  })
}

export function createBearerAuth(authToken: string): BearerAuth {
  const expectedToken = authToken.trim()
  if (!expectedToken) {
    throw new Error('authToken is required')
  }

  const isTokenValid = (token: string): boolean => (
    token.length > 0 && constantTimeCompare(token, expectedToken)
  )

  const isRequestAuthorized = (req: IncomingMessage): boolean => {
    const token = readBearerToken(req.headers.authorization)
    if (isTokenValid(token)) return true
    const wsToken = readWebSocketBearerToken(req.headers['sec-websocket-protocol'])
    return isTokenValid(wsToken)
  }

  const middleware: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const requestPath = readRequestPath(req)
    if (req.method === 'GET' && requestPath === '/auth/status') {
      sendJson(res, 200, { authRequired: true })
      return
    }

    if (req.method === 'POST' && requestPath === '/auth/login') {
      const remoteAddress = readRemoteAddress(req)
      const retryAfterMs = isLoginLimited(remoteAddress)
      if (retryAfterMs > 0) {
        res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)))
        sendJson(res, 429, { error: 'Too many failed login attempts' })
        return
      }

      readJsonBody(req, res, (body) => {
        const provided = typeof body.token === 'string' ? body.token.trim() : ''
        if (!isTokenValid(provided)) {
          recordLoginFailure(remoteAddress)
          sendJson(res, 401, { error: 'Invalid token' })
          return
        }
        clearLoginFailures(remoteAddress)
        sendJson(res, 200, { ok: true })
      })
      return
    }

    if (!isProtectedPath(requestPath)) {
      next()
      return
    }

    if (!isRequestAuthorized(req)) {
      sendJson(res, 401, { error: 'Unauthorized' })
      return
    }

    next()
  }

  return { middleware, isRequestAuthorized }
}
