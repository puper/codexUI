import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { createBearerAuth } from './authMiddleware'

type InvokeResult = {
  status: number
  body: unknown
  headers: Record<string, string>
  nextCalled: boolean
}

function invokeAuth(options: {
  method: string
  path: string
  authorization?: string
  body?: unknown
}): Promise<InvokeResult> {
  return new Promise((resolve) => {
    const payload = options.body === undefined ? '' : JSON.stringify(options.body)
    const req = new Readable({
      read() {
        this.push(payload)
        this.push(null)
      },
    }) as never as {
      method: string
      path: string
      headers: Record<string, string>
      socket: { remoteAddress: string }
      setEncoding: (encoding: BufferEncoding) => void
      on: (event: string, listener: (...args: string[]) => void) => void
    }
    req.method = options.method
    req.path = options.path
    req.headers = options.authorization ? { authorization: options.authorization } : {}
    req.socket = { remoteAddress: '127.0.0.1' }

    const result: InvokeResult = { status: 200, body: null, headers: {}, nextCalled: false }
    const res = {
      headersSent: false,
      statusCode: 200,
      setHeader(name: string, value: string) {
        result.headers[name] = value
      },
      end(body: string) {
        res.headersSent = true
        result.status = res.statusCode
        try {
          result.body = JSON.parse(body) as unknown
        } catch {
          result.body = body
        }
        resolve(result)
      },
    }

    createBearerAuth('test-token').middleware(
      req as never,
      res as never,
      () => {
        result.nextCalled = true
        resolve(result)
      },
    )
  })
}

describe('bearer auth middleware', () => {
  it('requires bearer auth and rate-limits failed token logins by IP', async () => {
    const missing = await invokeAuth({ method: 'GET', path: '/codex-api/protected' })
    expect(missing.status).toBe(401)
    expect(missing.nextCalled).toBe(false)

    const wrong = await invokeAuth({
      method: 'GET',
      path: '/codex-api/protected',
      authorization: 'Bearer wrong-token',
    })
    expect(wrong.status).toBe(401)

    const ok = await invokeAuth({
      method: 'GET',
      path: '/codex-api/protected',
      authorization: 'Bearer test-token',
    })
    expect(ok.nextCalled).toBe(true)

    for (let index = 0; index < 5; index += 1) {
      const response = await invokeAuth({
        method: 'POST',
        path: '/auth/login',
        body: { token: 'wrong-token' },
      })
      expect(response.status).toBe(401)
    }

    const limited = await invokeAuth({
      method: 'POST',
      path: '/auth/login',
      body: { token: 'wrong-token' },
    })
    expect(limited.status).toBe(429)
    expect(limited.headers['Retry-After']).toBeTruthy()
  })
})
