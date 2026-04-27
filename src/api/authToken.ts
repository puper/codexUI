const AUTH_TOKEN_STORAGE_KEY = 'codexui.authToken.v1'
const AUTH_UNAUTHORIZED_EVENT = 'codexui-auth-unauthorized'

export type AuthStatus = {
  authRequired: boolean
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getAuthToken(): string {
  if (!isBrowser()) return ''
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim() ?? ''
}

export function setAuthToken(token: string): void {
  if (!isBrowser()) return
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

export function clearAuthToken(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

export function notifyUnauthorized(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT))
}

export function onUnauthorized(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = () => handler()
  window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener)
  return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener)
}

function resolveRequestUrl(input: RequestInfo | URL): URL | null {
  if (typeof window === 'undefined') return null
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
  try {
    return new URL(raw, window.location.href)
  } catch {
    return null
  }
}

function isSameOriginProtectedRequest(input: RequestInfo | URL): boolean {
  if (typeof window === 'undefined') return false
  const url = resolveRequestUrl(input)
  if (!url || url.origin !== window.location.origin) return false
  return url.pathname.startsWith('/codex-api/')
    || url.pathname === '/codex-local-image'
    || url.pathname === '/codex-local-file'
    || url.pathname === '/codex-local-directories'
    || url.pathname.startsWith('/codex-local-browse')
    || url.pathname.startsWith('/codex-local-edit')
}

function withAuthHeader(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

export function installAuthFetch(): void {
  if (typeof window === 'undefined') return
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let nextInput = input
    let nextInit = init
    const token = getAuthToken()
    if (token && isSameOriginProtectedRequest(input)) {
      if (input instanceof Request) {
        const headers = new Headers(input.headers)
        headers.set('Authorization', `Bearer ${token}`)
        nextInput = new Request(input, { headers })
      } else {
        nextInit = withAuthHeader(init, token)
      }
    }
    const response = await originalFetch(nextInput, nextInit)
    if (response.status === 401 && isSameOriginProtectedRequest(input)) {
      clearAuthToken()
      notifyUnauthorized()
    }
    return response
  }
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const response = await fetch('/auth/status')
  if (!response.ok) return { authRequired: true }
  const payload = await response.json() as Partial<AuthStatus>
  return { authRequired: payload.authRequired !== false }
}

export async function verifyAuthToken(token: string): Promise<void> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (response.ok) return
  if (response.status === 429) {
    throw new Error('Too many failed login attempts. Try again later.')
  }
  throw new Error('Invalid token')
}

export function encodeWebSocketBearerProtocol(token: string): string {
  const bytes = new TextEncoder().encode(token)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return `codexui-bearer.${btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')}`
}
