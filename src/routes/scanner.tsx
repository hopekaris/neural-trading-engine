import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Meter, Panel, Skeleton, Stat, bandOf, pct } from '../components/ui'
import {
  analyze,
  matchesPredict,
  CONTRACT_META,
  DEFAULT_CONFIG,
  type Analysis,
  type MatchesPrediction,
} from '../lib/engine'
import { MARKET_BY_SYMBOL } from '../lib/markets'
import { useFeed } from '../lib/useFeed'

export const Route = createFileRoute('/scanner')({
  component: ScannerPage,
})

interface Row {
  symbol: string
  analysis: Analysis
  match: MatchesPrediction
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

  // Run both the contract analysis and the shared Matches prediction engine.
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

          // Existing contract analysis remains unchanged.
          analysis: analyze(
            s.digits,
            s.prices,
            DEFAULT_CONFIG,
          ),

          // Same prediction function used by the Matches page.
          match: matchesPredict(
            s.digits,
            DEFAULT_CONFIG.threshold,
          ),

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
  }, [feed, feed?.snap.selected.join(','), version])

  // Rank markets by the shared Matches model's ensemble score.
  const ranked = useMemo(() => {
    return rows
      .map((r) => {
        const best = [...r.analysis.signals].sort(
          (a, b) => b.confidence - a.confidence,
        )[0]

        return {
          ...r,
          best,
        }
      })
      .sort((a, b) => b.match.score - a.match.score)
  }, [rows])

  const pending =
    (feed?.snap.selected.length ?? 0) - rows.length

  const hot = ranked.filter(
    (r) => r.best.confidence >= threshold,
  ).length

  const rtt = feed?.snap.rttHistory ?? []

  const open = (sym: string) => {
    feed?.setFocus(sym)
    navigate({ to: '/' })
  }

  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}
      <div>
        <p className="label text-pulse">
          05 · AI digit scanner
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Neural Matches Scanner
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-mute">
          Every selected market is analysed using the same
          Matches prediction engine. The scanner shares its
          predicted digit, ensemble score and historical
          walk-forward results with the Neural Engine.
        </p>
      </div>

      {/* SCANNER STATISTICS */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">

        <Stat
          label="Markets scanned"
          value={rows.length}
          hint={
            pending > 0
              ? `${pending} loading`
              : 'All loaded'
          }
        />

        <Stat
          label="High-confidence signals"
          value={hot}
          tone={hot ? 'text-pulse' : 'text-white'}
          hint={`Signal threshold ≥ ${threshold}`}
        />

        <Stat
          label="Scan processing"
          value={`${(scanMicros / 1000).toFixed(1)}ms`}
          hint={`${scanMicros.toFixed(0)}µs across markets`}
        />

        <Stat
          label="Feed RTT average"
          value={
            feed?.snap.rttAvg != null
              ? `${feed.snap.rttAvg.toFixed(0)}ms`
              : '—'
          }
          hint={`Last ${rtt.length} pings`}
          tone="text-volt"
        />

      </div>

      {/* SHARED MATCHES PREDICTION BOARD */}
      <Panel
        kicker="Shared Neural Engine"
        title="Next-digit Matches predictions"
      >

        {ranked.length === 0 ? (
          <div className="space-y-3">

            <p className="text-sm text-mute">
              {feed?.snap.mode === 'live'
                ? `Loading tick history for ${feed.snap.selected.length} markets…`
                : feed?.snap.mode === 'reconnecting'
                  ? 'Reconnecting to the live tick feed…'
                  : 'Connecting to the live tick feed…'}
            </p>

            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                className="h-14"
              />
            ))}

          </div>
        ) : (

          <div className="-mx-5 overflow-x-auto">

            <table className="w-full min-w-[1050px] text-sm">

              <thead>
                <tr className="border-b border-line text-left">

                  {[
                    'Market',
                    'Last digit',
                    'Predicted digit',
                    'Ensemble score',
                    'Agreement',
                    'Match backtest',
                    'Best signal',
                    'Confidence',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="label px-4 py-3 font-normal"
                    >
                      {h}
                    </th>
                  ))}

                </tr>
              </thead>

              <tbody>

                {ranked.map((r) => {
                  const { stats } = r.analysis
                  const b = r.best

                  // First method is the ensemble, as defined
                  // in MATCH_METHODS in engine.ts.
                  const ensemble = r.match.methods[0]

                  const band = bandOf(
                    b.confidence,
                    threshold,
                  )

                  const acc = b.backtest.trades
                    ? b.backtest.wins / b.backtest.trades
                    : 0

                  const predictedDigit = r.match.digit

                  return (

                    <tr
                      key={r.symbol}
                      className="border-b border-line/60 transition hover:bg-panel-2/60"
                    >

                      {/* MARKET */}
                      <td className="px-4 py-3">

                        <p className="font-semibold text-white">
                          {MARKET_BY_SYMBOL[r.symbol]?.short ?? r.symbol}
                        </p>

                        <p className="font-mono text-[10px] text-mute">
                          {r.symbol} · {stats.n} ticks
                          {r.backfilling && ' · filling'}
                        </p>

                      </td>

                      {/* LAST DIGIT */}
                      <td className="px-4 py-3">

                        <span
                          key={r.liveTicks}
                          className="blip num inline-grid h-8 w-8 place-items-center rounded-lg border border-line font-bold text-white"
                        >
                          {r.last}
                        </span>

                      </td>

                      {/* PREDICTED DIGIT */}
                      <td className="px-4 py-3">

                        <div className="flex items-center gap-2">

                          <span className="num grid h-10 w-10 place-items-center rounded-xl border border-pulse/50 bg-pulse/10 text-xl font-bold text-pulse">
                            {predictedDigit}
                          </span>

                          <div>
                            <p className="font-semibold text-pulse">
                              MATCH {predictedDigit}
                            </p>

                            <p className="text-[10px] text-mute">
                              Neural prediction
                            </p>
                          </div>

                        </div>

                      </td>

                      {/* ENSEMBLE SCORE */}
                      <td className="px-4 py-3">

                        <p className="num font-semibold text-white">
                          {pct(r.match.score, 2)}
                        </p>

                        <p className="text-[10px] text-mute">
                          Fair baseline 10%
                        </p>

                      </td>

                      {/* METHOD AGREEMENT */}
                      <td className="px-4 py-3">

                        <p className="font-semibold text-white">
                          {r.match.consensus}/3
                        </p>

                        <p className="text-[10px] text-mute">
                          Base methods agree
                        </p>

                      </td>

                      {/* MATCH BACKTEST */}
                      <td className="px-4 py-3">

                        <p className="num font-semibold text-white">
                          {pct(ensemble.hitRate, 2)}
                        </p>

                        <p className="text-[10px] text-mute">
                          {ensemble.wins.toLocaleString()} /{' '}
                          {ensemble.trades.toLocaleString()} hits
                        </p>

                      </td>

                      {/* EXISTING CONTRACT SIGNAL */}
                      <td className="px-4 py-3">

                        <p className="font-semibold text-white">
                          {b.label}
                        </p>

                        <p className="font-mono text-[10px] text-mute">
                          {CONTRACT_META[b.kind].family}
                        </p>

                      </td>

                      {/* SIGNAL CONFIDENCE */}
                      <td className="px-4 py-3">

                        <div className="flex w-36 items-center gap-2">

                          <Meter
                            value={b.confidence}
                            threshold={threshold}
                          />

                          <span
                            className={`num w-8 text-right text-xs ${band.cls}`}
                          >
                            {b.confidence.toFixed(0)}
                          </span>

                        </div>

                      </td>

                      {/* OPEN MARKET */}
                      <td className="px-4 py-3 text-right">

                        <button
                          onClick={() => open(r.symbol)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs text-soft hover:border-pulse/50 hover:text-pulse"
                        >
                          Analyse

                          <ArrowUpRight className="h-3.5 w-3.5" />
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

      {/* PREDICTION EXPLANATION */}
      <Panel
        kicker="Prediction engine"
        title="How the shared brain works"
      >

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl border border-line p-3">
            <p className="label">Method 1</p>
            <p className="mt-1 font-semibold text-white">
              Last 100 ticks
            </p>
            <p className="mt-1 text-xs text-mute">
              Recent digit frequencies.
            </p>
          </div>

          <div className="rounded-xl border border-line p-3">
            <p className="label">Method 2</p>
            <p className="mt-1 font-semibold text-white">
              Last 1,000 ticks
            </p>
            <p className="mt-1 text-xs text-mute">
              Longer-term digit frequencies.
            </p>
          </div>

          <div className="rounded-xl border border-line p-3">
            <p className="label">Method 3</p>
            <p className="mt-1 font-semibold text-white">
              Markov analysis
            </p>
            <p className="mt-1 text-xs text-mute">
              Historical next-digit frequencies after the current digit.
            </p>
          </div>

          <div className="rounded-xl border border-line p-3">
            <p className="label">Final method</p>
            <p className="mt-1 font-semibold text-white">
              Ensemble
            </p>
            <p className="mt-1 text-xs text-mute">
              Combines the three estimates to rank digits 0–9.
            </p>
          </div>

        </div>

        <p className="mt-4 text-xs leading-relaxed text-mute">
          The predicted digit is a statistical estimate, not a
          guaranteed result. The backtest uses historical
          walk-forward predictions and does not guarantee future
          performance. No trades are placed automatically.
        </p>

      </Panel>

      {/* LIVE FEED LATENCY */}
      <Panel
        kicker="Ingestion"
        title="Feed latency"
      >

        <div
          className="flex h-24 items-end gap-[3px]"
          role="img"
          aria-label="Recent WebSocket round-trip times"
        >

          {rtt.length === 0 && (
            <p className="text-sm text-mute">
              Waiting for the first ping…
            </p>
          )}

          {rtt.map((v, i) => {
            const max = Math.max(...rtt, 1)

            return (
              <div
                key={i}
                className={`flex-1 rounded-t-sm ${
                  v > (feed?.snap.rttAvg ?? 0) * 1.5
                    ? 'bg-heat'
                    : 'bg-volt/70'
                }`}
                style={{
                  height: `${(v / max) * 100}%`,
                }}
                title={`${v.toFixed(0)}ms`}
              />
            )
          })}

        </div>

        <p className="mt-3 text-xs leading-relaxed text-mute">
          Round-trip time from this browser to the broker
          endpoint. The existing live tick feed remains in use.
        </p>

      </Panel>

    </div>
  )
  }
