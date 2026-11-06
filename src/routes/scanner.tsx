import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Meter, Panel, Skeleton, Stat, bandOf, pct } from '../components/ui'
import {
  analyze,
  CONTRACT_META,
  DEFAULT_CONFIG,
  type Analysis,
} from '../lib/engine'
import { MARKET_BY_SYMBOL } from '../lib/markets'
import { useFeed } from '../lib/useFeed'

export const Route = createFileRoute('/scanner')({ component: ScannerPage })

interface Row {
  symbol: string
  analysis: Analysis
  last: number
  liveTicks: number
  backfilling: boolean
}

function ScannerPage() {
  const { feed, version } = useFeed()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [scanMicros, setScanMicros] = useState(0)
  const threshold = DEFAULT_CONFIG.threshold

  // Full re-scan of every chosen market, throttled to once per second.
  useEffect(() => {
    if (!feed) return
    const run = () => {
      const t0 = performance.now()
      const next: Row[] = []
      for (const sym of feed.snap.selected) {
        const s = feed.series.get(sym)
        if (!s?.loaded || s.digits.length < 60) continue
        next.push({
          symbol: sym,
          analysis: analyze(s.digits, s.prices, DEFAULT_CONFIG),
          last: s.digits[s.digits.length - 1],
          liveTicks: s.liveTicks,
          backfilling: s.backfilling,
        })
      }
      setScanMicros((performance.now() - t0) * 1000)
      setRows(next)
    }
    run()
    const id = setInterval(run, 1000)
    return () => clearInterval(id)
  }, [feed, feed?.snap.selected.join(',')])

  const ranked = useMemo(
    () =>
      rows
        .map((r) => {
          const best = [...r.analysis.signals].sort(
            (a, b) => b.confidence - a.confidence,
          )[0]
          return { ...r, best }
        })
        .sort((a, b) => b.best.confidence - a.best.confidence),
    [rows],
  )

  const pending = (feed?.snap.selected.length ?? 0) - rows.length
  const hot = ranked.filter((r) => r.best.confidence >= threshold).length
  const rtt = feed?.snap.rttHistory ?? []
  void version

  const open = (sym: string) => {
    feed?.setFocus(sym)
    navigate({ to: '/' })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label text-pulse">05 · AI digit scanner</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Scanning your chosen markets
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-mute">
          Each market is fully re-analysed every second and ranked by its
          strongest contract signal. Add or remove markets from the bar above.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          label="Markets scanned"
          value={rows.length}
          hint={pending > 0 ? `${pending} loading` : 'all loaded'}
        />
        <Stat
          label="High-confidence hits"
          value={hot}
          tone={hot ? 'text-pulse' : 'text-white'}
          hint={`score ≥ ${threshold}`}
        />
        <Stat
          label="Full scan time"
          value={`${(scanMicros / 1000).toFixed(1)}ms`}
          hint={`${scanMicros.toFixed(0)}µs across all markets`}
        />
        <Stat
          label="Feed RTT avg"
          value={
            feed?.snap.rttAvg != null ? `${feed.snap.rttAvg.toFixed(0)}ms` : '—'
          }
          hint={`last ${rtt.length} pings`}
          tone="text-volt"
        />
      </div>

      <Panel kicker="Ranked by confidence" title="Market signal board">
        {ranked.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-mute">
              {feed?.snap.mode === 'live'
                ? `Loading tick history for ${feed.snap.selected.length} market${feed.snap.selected.length === 1 ? '' : 's'}…`
                : feed?.snap.mode === 'reconnecting'
                  ? 'Connecting to the broker feed — retrying…'
                  : 'Connecting to the broker feed…'}
            </p>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {[
                    'Market',
                    'Last',
                    'χ² p-value',
                    'Hot / cold',
                    'Best signal',
                    'Confidence',
                    'Backtest',
                    'Edge',
                    '',
                  ].map((h) => (
                    <th key={h} className="label px-5 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const { stats } = r.analysis
                  const b = r.best
                  const band = bandOf(b.confidence, threshold)
                  const acc = b.backtest.trades
                    ? b.backtest.wins / b.backtest.trades
                    : 0
                  const edge = acc - b.breakeven
                  return (
                    <tr
                      key={r.symbol}
                      className="border-b border-line/60 transition hover:bg-panel-2/60"
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-white">
                          {MARKET_BY_SYMBOL[r.symbol]?.short}
                        </p>
                        <p className="font-mono text-[10px] text-mute">
                          {r.symbol} · {stats.n} ticks
                          {r.backfilling && ' · filling'}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          key={r.liveTicks}
                          className="blip num inline-grid h-8 w-8 place-items-center rounded-lg border border-line font-bold text-white"
                        >
                          {r.last}
                        </span>
                      </td>
                      <td
                        className={`num px-5 py-3 ${stats.pValue < 0.05 ? 'text-pulse' : 'text-soft'}`}
                      >
                        {stats.pValue.toFixed(3)}
                      </td>
                      <td className="num px-5 py-3">
                        <span className="text-heat">{stats.hot}</span>
                        <span className="text-mute">
                          {' '}
                          {stats.pct[stats.hot].toFixed(1)}% /{' '}
                        </span>
                        <span className="text-cold">{stats.cold}</span>
                        <span className="text-mute">
                          {' '}
                          {stats.pct[stats.cold].toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-white">{b.label}</p>
                        <p className="font-mono text-[10px] text-mute">
                          {CONTRACT_META[b.kind].family}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex w-36 items-center gap-2">
                          <Meter value={b.confidence} threshold={threshold} />
                          <span
                            className={`num w-8 text-right text-xs ${band.cls}`}
                          >
                            {b.confidence.toFixed(0)}
                          </span>
                        </div>
                      </td>
                      <td className="num px-5 py-3 text-soft">{pct(acc)}</td>
                      <td
                        className={`num px-5 py-3 ${edge > 0 ? 'text-pulse' : 'text-cold'}`}
                      >
                        {edge > 0 ? '+' : ''}
                        {(edge * 100).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => open(r.symbol)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs text-soft hover:border-pulse/50 hover:text-pulse"
                        >
                          Analyse <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel kicker="Ingestion" title="Feed latency">
        <div
          className="flex h-24 items-end gap-[3px]"
          role="img"
          aria-label="Recent WebSocket round-trip times"
        >
          {rtt.length === 0 && (
            <p className="text-sm text-mute">Waiting for the first ping…</p>
          )}
          {rtt.map((v, i) => {
            const max = Math.max(...rtt, 1)
            return (
              <div
                key={i}
                className={`flex-1 rounded-t-sm ${v > (feed?.snap.rttAvg ?? 0) * 1.5 ? 'bg-heat' : 'bg-volt/70'}`}
                style={{ height: `${(v / max) * 100}%` }}
                title={`${v.toFixed(0)}ms`}
              />
            )
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mute">
          Round-trip time from this browser to the broker endpoint, sampled
          every 5 seconds. The next milestone moves ingestion to a lightweight
          Node.js worker on a VPS in the region closest to the broker, so the
          engine receives ticks with consistent, minimal latency regardless of
          where you are browsing from.
        </p>
      </Panel>
    </div>
  )
}
