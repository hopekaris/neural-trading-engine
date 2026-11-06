
import { useEffect, useState } from 'react'
import {
  startDerivLogin,
  getDerivStatus,
  disconnectDeriv,
} from '../lib/deriv-auth'

export function DerivConnect() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getDerivStatus()
      .then(result => setConnected(result.connected))
      .catch(() => setConnected(false))
  }, [])

  async function connect() {
    try {
      setLoading(true)
      const result = await startDerivLogin()
      window.location.assign(result.url)
    } catch {
      setLoading(false)
      alert('Could not start Deriv login. Check Cloudflare settings.')
    }
  }

  async function disconnect() {
    try {
      await disconnectDeriv()
      setConnected(false)
    } catch {
      alert('Could not disconnect Deriv.')
    }
  }

  return (
    <div className="flex items-center gap-2">
      {connected ? (
        <>
          <span className="rounded-lg border border-pulse/40 px-3 py-2 text-xs text-pulse">
            Deriv connected
          </span>

          <button
            onClick={disconnect}
            className="rounded-lg border border-line px-3 py-2 text-xs text-mute"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={connect}
          disabled={loading}
          className="rounded-lg bg-pulse px-3 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {loading ? 'Opening Deriv…' : 'Connect to Deriv'}
        </button>
      )}
    </div>
  )
}
