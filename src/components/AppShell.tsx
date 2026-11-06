import { Link, Outlet } from '@tanstack/react-router'
import { Activity, Cpu, Radar, Radio, Target, Zap } from 'lucide-react'
import { MARKETS } from '../lib/markets'
import { useFeed } from '../lib/useFeed'

const MODE_LABEL = {
  idle: 'Starting',
  connecting: 'Connecting',
  live: 'Live feed',
  reconnecting: 'Reconnecting',
  simulated: 'Simulated feed',
} as const

export function AppShell() {
  const { feed } = useFeed()
  const snap = feed?.snap
  const mode = snap?.mode ?? 'idle'
  const live = mode === 'live'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-pulse/10 ring-1 ring-pulse/40">
              <Cpu className="h-5 w-5 text-pulse" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-white">
                Neural Trading Engine
              </span>
              <span className="label !text-[9px]">
                digit intelligence · volatility indices
              </span>
            </span>
          </Link>

          <nav className="flex gap-1 rounded-xl border border-line bg-panel p-1 text-sm">
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-mute transition hover:text-white"
              activeProps={{ className: '!bg-panel-2 !text-white' }}
              activeOptions={{ exact: true }}
            >
              <Activity className="h-4 w-4" /> Engine
            </Link>
            <Link
              to="/matches"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-mute transition hover:text-white"
              activeProps={{ className: '!bg-panel-2 !text-white' }}
            >
              <Target className="h-4 w-4" /> Matches
            </Link>
            <Link
              to="/scanner"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-mute transition hover:text-white"
              activeProps={{ className: '!bg-panel-2 !text-white' }}
            >
              <Radar className="h-4 w-4" /> Digit scanner
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2 font-mono text-xs">
            <span
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                live
                  ? 'border-pulse/40 text-pulse'
                  : mode === 'simulated'
                    ? 'border-heat/40 text-heat'
                    : 'border-line text-mute'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${live ? 'live-dot bg-pulse' : mode === 'simulated' ? 'bg-heat' : 'bg-mute'}`}
              />
              {MODE_LABEL[mode]}
            </span>
            <span
              className="hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 sm:flex"
              title="WebSocket round-trip time to the broker endpoint"
            >
              <Zap className="h-3.5 w-3.5 text-volt" />
              <span className="num text-white">
                {snap?.rtt != null ? `${snap.rtt.toFixed(0)}ms` : '—'}
              </span>
              <span className="text-mute">rtt</span>
            </span>
            <span className="hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 md:flex">
              <Radio className="h-3.5 w-3.5 text-volt" />
              <span className="num text-white">{snap?.ticksPerMin ?? 0}</span>
              <span className="text-mute">ticks/min</span>
            </span>
            {mode === 'simulated' && (
              <button
                onClick={() => feed?.retryLive()}
                className="rounded-lg bg-heat/15 px-2.5 py-1.5 text-heat hover:bg-heat/25"
              >
                Retry live
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-7xl overflow-x-auto px-4 pb-3 sm:px-6">
          <div className="flex min-w-max items-center gap-1.5">
            <span className="label mr-2">Markets</span>
            {MARKETS.map((m) => {
              const on = snap?.selected.includes(m.symbol) ?? false
              return (
                <button
                  key={m.symbol}
                  onClick={() => feed?.toggleMarket(m.symbol)}
                  aria-pressed={on}
                  title={m.name}
                  className={`rounded-full border px-3 py-1 font-mono text-[11px] transition ${
                    on
                      ? 'border-pulse/50 bg-pulse/10 text-pulse'
                      : 'border-line text-mute hover:border-soft/40 hover:text-soft'
                  }`}
                >
                  {m.short}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="grid-bg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs leading-relaxed text-mute sm:px-6">
          Confidence scores measure how unlikely a digit deviation is under pure
          randomness — they are not win probabilities. Volatility indices are
          generated by a random number generator, so edges in historical ticks
          rarely persist. Analysis only; not financial advice.
        </div>
      </footer>
    </div>
  )
}
