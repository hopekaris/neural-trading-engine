
import { createServerFn } from '@tanstack/react-start'

export const REDIRECT_URI =
  'https://neural-trading-engine.hopekariuki367.workers.dev/api/deriv/callback'

export const startDerivLogin = createServerFn({
  method: 'GET',
}).handler(async () => {
  const server = await import('./deriv-auth.server')
  return server.createLoginUrl()
})

export const getDerivStatus = createServerFn({
  method: 'GET',
}).handler(async () => {
  const server = await import('./deriv-auth.server')
  return server.readDerivStatus()
})

export const disconnectDeriv = createServerFn({
  method: 'POST',
}).handler(async () => {
  const server = await import('./deriv-auth.server')
  return server.removeDerivSession()
})
