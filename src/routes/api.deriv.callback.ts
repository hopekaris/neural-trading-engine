
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/deriv/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const server = await import('../lib/deriv-auth.server')
        const home = new URL('/', request.url)
        const params = new URL(request.url).searchParams

        const code = params.get('code')
        const state = params.get('state')
        const error = params.get('error')

        if (error || !code || !state) {
          server.clearOAuthCookie()
          home.searchParams.set('deriv', 'cancelled')
          return Response.redirect(home.toString(), 302)
        }

        try {
          const { appId, secret } = server.getSettings()
          const savedCookie = server.getOAuthCookie()

          if (!savedCookie) {
            throw new Error('OAuth session expired')
          }

          const saved = await server.decryptData(savedCookie, secret)

          if (
            !saved.state ||
            !saved.verifier ||
            saved.state !== state
          ) {
            throw new Error('OAuth state did not match')
          }

          const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: appId,
            code,
            code_verifier: saved.verifier,
            redirect_uri: server.REDIRECT_URI,
          })

          const response = await fetch(
            'https://auth.deriv.com/oauth2/token',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body,
            },
          )

          if (!response.ok) {
            throw new Error('Deriv token exchange failed')
          }

          const result = await response.json() as {
            access_token?: string
            expires_in?: number
          }

          if (!result.access_token || !result.expires_in) {
            throw new Error('Deriv did not return an access token')
          }

          await server.saveSession(
            result.access_token,
            result.expires_in,
            secret,
          )

          server.clearOAuthCookie()
          home.searchParams.set('deriv', 'connected')

          return Response.redirect(home.toString(), 302)
        } catch {
          server.clearOAuthCookie()
          home.searchParams.set('deriv', 'error')

          return Response.redirect(home.toString(), 302)
        }
      },
    },
  },
})
