
import { env } from 'cloudflare:workers'
import {
  getCookie,
  setCookie,
  deleteCookie,
} from '@tanstack/react-start/server'

export const OAUTH_COOKIE = '__Host-deriv-oauth'
export const SESSION_COOKIE = '__Host-deriv-session'

export function getSettings() {
  const e = env as unknown as {
    DERIV_APP_ID?: string
    DERIV_SESSION_SECRET?: string
  }

  if (!e.DERIV_APP_ID || !e.DERIV_SESSION_SECRET) {
    throw new Error('Deriv environment variables are missing')
  }

  if (e.DERIV_SESSION_SECRET.length < 32) {
    throw new Error('Session secret must be at least 32 characters')
  }

  return {
    appId: e.DERIV_APP_ID,
    secret: e.DERIV_SESSION_SECRET,
  }
}

function base64url(bytes: Uint8Array) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

async function keyFromSecret(secret: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret),
  )

  return crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptData(data: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await keyFromSecret(secret)

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  )

  return `${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`
}

export async function decryptData(value: string, secret: string) {
  const [ivText, encryptedText] = value.split('.')

  if (!ivText || !encryptedText) {
    throw new Error('Invalid encrypted data')
  }

  const key = await keyFromSecret(secret)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64url(ivText) },
    key,
    fromBase64url(encryptedText),
  )

  return JSON.parse(new TextDecoder().decode(decrypted)) as {
    state?: string
    verifier?: string
    accessToken?: string
    expiresAt?: number
  }
}

export function getOAuthCookie() {
  return getCookie(OAUTH_COOKIE)
}

export function clearOAuthCookie() {
  deleteCookie(OAUTH_COOKIE, { path: '/' })
}

export async function saveSession(
  accessToken: string,
  expiresIn: number,
  secret: string,
) {
  const maxAge = Math.max(60, Math.min(expiresIn, 2592000))

  const value = await encryptData(
    {
      accessToken,
      expiresAt: Date.now() + maxAge * 1000,
    },
    secret,
  )

  setCookie(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
}

export async function createLoginUrl() {
  const { appId, secret } = getSettings()

  const verifier = base64url(
    crypto.getRandomValues(new Uint8Array(64)),
  )

  const state = base64url(
    crypto.getRandomValues(new Uint8Array(24)),
  )

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )

  const challenge = base64url(new Uint8Array(digest))

  const saved = await encryptData({ state, verifier }, secret)

  setCookie(OAUTH_COOKIE, saved, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: appId,
    redirect_uri:
      'https://neural-trading-engine.hopekariuki367.workers.dev/api/deriv/callback',
    scope: 'trade',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  return {
    url: `https://auth.deriv.com/oauth2/auth?${params.toString()}`,
  }
}

export async function readDerivStatus() {
  const { secret } = getSettings()
  const cookie = getCookie(SESSION_COOKIE)

  if (!cookie) return { connected: false }

  try {
    const session = await decryptData(cookie, secret)

    if (
      !session.accessToken ||
      !session.expiresAt ||
      session.expiresAt <= Date.now()
    ) {
      deleteCookie(SESSION_COOKIE, { path: '/' })
      return { connected: false }
    }

    return { connected: true }
  } catch {
    deleteCookie(SESSION_COOKIE, { path: '/' })
    return { connected: false }
  }
}

export function removeDerivSession() {
  deleteCookie(SESSION_COOKIE, { path: '/' })
  return { success: true }
}
