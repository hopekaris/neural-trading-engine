import { createFileRoute } from '@tanstack/react-router'
import { Check, Timer, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AccuracyEstimator } from '../components/AccuracyEstimator'
import { Meter, Panel, Skeleton, Stat, bandOf, pct } from '../components/ui'
import {
  DEFAULT_CONFIG,
  matchesPredict,
  matchesWindowBacktest,
  type MatchMethod,
  type WindowBacktest,
} from '../lib/engine'
import { MARKET_BY_SYMBOL, PREDICTION_WINDOW_SEC } from '../lib/markets'
import { useFeed } from '../lib/useFeed'

export const Route = createFileRoute('/matches')({ component: MatchesPage })

const METHOD_META: Record<MatchMethod, { name: string; how: string }> = {
  ensemble: {
    name: 'Neural ensemble',
    how: 'Average of the three estimators below',
  },
  hot100: { name: 'Hot digit · 100', how: 'Most frequent in the last 100 ticks' },
  hot1000: {
    name: 'Hot digit · 1,000',
    how: 'Most frequent in the last 1,000 ticks',
  },
  markov: {
    name: 'Transition (Markov)',
    how: 'Most common digit after the current last digit',
  },
}

function MatchesPage() {
  const { feed } = useFeed()
  const [threshold, setThreshold] = useState(DEFAULT_CONFIG.threshold)
  const focus = feed?.snap.focus
  const series = focus ? feed?.series.get(focus) : undefined
  const market = focus ? MARKET_BY_SYMBOL[focus] : undefined
  const len = series?.digits.length ?? 0
  const lastTime = series?.times[len - 1] ?? 0

  const pred = useMemo(() => {
    if (!series?.loaded || len < 200) return null
    const t0 = performance.now()
    const r = matchesPredict(series.digits, threshold)
    const micros = (performance.now() - t0) * 1000
    const windowTest = matchesWindowBacktest(
      series.digits,
      series.times,
      r.picks,
      PREDICTION_WINDOW_SEC,
    )
    return { ...r, micros, windowTest }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, len, lastTime, series?.liveTicks, threshold])

  const held = useHeldPrediction(focus, pred, lastTime, series?.times, series?.digits)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-pulse">Contract type · Matches</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Matches predictor
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            Locks the digit most likely to be the last digit for the selected
            market and holds it for {PREDICTION_WINDOW_SEC} seconds, then
            settles it against every tick in that window and issues a new one.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-panel p-1">
          {feed?.snap.selected.map((s) => (
            <button
              key={s}
              onClick={() => feed.setFocus(s)}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                s === focus ? 'bg-pulse text-ink' : 'text-mute hover:text-white'
              }`}
            >
              {MARKET_BY_SYMBOL[s]?.short ?? s}
            </button>
          ))}
        </div>
      </div>

      {series?.error && (
        <p className="rounded-xl border border-cold/40 bg-cold/10 px-4 py-3 text-sm text-cold">
          Feed error for {focus}: {series.error}
        </p>
      )}

      {!pred || !series || !market ? (
        <div className="space-y-6" aria-busy="true">
          <p className="font-mono text-xs text-mute">
            Loading tick history for the selected market…
          </p>
          <Skeleton className="h-64" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <PredictionHero
            pred={pred}
            held={held}
            marketName={market.name}
            price={series.prices[len - 1]?.toFixed(series.pip)}
            ticks={len}
            backfilling={series.backfilling}
            threshold={threshold}
            onThreshold={setThreshold}
          />
          <WindowPanel held={held} test={pred.windowTest} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <DigitBoard pred={pred} />
            <RecentPanel pred={pred} />
          </div>
          <MethodTable pred={pred} />
          <AccuracyEstimator signal={pred.signal} />
        </>
      )}
    </div>
  )
}

type Pred = ReturnType<typeof matchesPredict> & {
  micros: number
  windowTest: WindowBacktest
}

interface HeldPick {
  symbol: string
  digit: number
  score: number
  consensus: number
  /** Feed epoch (s) of the last tick before the pick was locked. */
  startEpoch: number
  /** Local clock (ms) when the pick was locked, for the countdown. */
  lockedAt: number
}

interface SettledWindow {
  digit: number
  startEpoch: number
  digits: number[]
}

interface Held {
  pick: HeldPick | null
  /** Ticks that have arrived inside the current window so far. */
  live: number[]
  remaining: number
  history: SettledWindow[]
}

/** Ticks with epoch in (from, to] from the rolling series. */
function ticksBetween(times: number[], digits: number[], from: number, to: number) {
  const out: number[] = []
  for (let i = times.length - 1; i >= 0 && times[i] > from; i--) {
    if (times[i] <= to) out.push(digits[i])
  }
  return out.reverse()
}

/**
 * Holds the ensemble pick for PREDICTION_WINDOW_SEC seconds, then settles the
 * window against every tick that arrived in it and locks a fresh pick.
 */
function useHeldPrediction(
  focus: string | undefined,
  pred: Pred | null,
  lastTime: number,
  times: number[] | undefined,
  digits: number[] | undefined,
): Held {
  const [pick, setPick] = useState<HeldPick | null>(null)
  const [history, setHistory] = useState<SettledWindow[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!focus || !pred || !times || !digits || !lastTime) return
    const lock = (): HeldPick => ({
      symbol: focus,
      digit: pred.digit,
      score: pred.score,
      consensus: pred.consensus,
      startEpoch: lastTime,
      lockedAt: Date.now(),
    })
    if (!pick || pick.symbol !== focus) {
      if (pick) setHistory([])
      setPick(lock())
      return
    }
    const end = pick.startEpoch + PREDICTION_WINDOW_SEC
    if (lastTime >= end) {
      const settled = ticksBetween(times, digits, pick.startEpoch, end)
      setHistory((h) =>
        [{ digit: pick.digit, startEpoch: pick.startEpoch, digits: settled }, ...h].slice(0, 20),
      )
      setPick(lock())
    }
  }, [focus, pred, lastTime, times, digits, pick])

  const live =
    pick && times && digits && pick.symbol === focus
      ? ticksBetween(times, digits, pick.startEpoch, pick.startEpoch + PREDICTION_WINDOW_SEC)
      : []
  const remaining = pick
    ? Math.max(0, PREDICTION_WINDOW_SEC - (now - pick.lockedAt) / 1000)
    : PREDICTION_WINDOW_SEC
  return { pick: pick?.symbol === focus ? pick : null, live, remaining, history }
}

function Countdown({ remaining }: { remaining: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const frac = remaining / PREDICTION_WINDOW_SEC
  return (
    <div className="relative h-16 w-16" aria-label={`${Math.ceil(remaining)} seconds left`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" className="text-line" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-pulse transition-[stroke-dashoffset] duration-200"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
        {remaining > 0 ? `${Math.ceil(remaining)}s` : '…'}
      </span>
    </div>
  )
}

function PredictionHero({
  pred,
  held,
  marketName,
  price,
  ticks,
  backfilling,
  threshold,
  onThreshold,
}: {
  pred: Pred
  held: Held
  marketName: string
  price?: string
  ticks: number
  backfilling: boolean
  threshold: number
  onThreshold: (v: number) => void
}) {
  const ens = pred.methods[0]
  const sig = pred.signal
  const band = bandOf(ens.significance, threshold)
  const edge = ens.hitRate - sig.breakeven
  const digit = held.pick?.digit ?? pred.digit
  const hits = held.live.filter((d) => d === digit).length
  return (
    <section className="panel overflow-hidden p-0">
      <div className="grid gap-0 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center gap-2 border-b border-line bg-pulse/5 px-10 py-8 md:border-b-0 md:border-r">
          <p className="label flex items-center gap-1.5 text-pulse">
            <Timer className="h-3.5 w-3.5" /> Prediction · {PREDICTION_WINDOW_SEC} s window
          </p>
          <div className="flex items-center gap-5">
            <p
              key={`${digit}-${held.pick?.startEpoch ?? 0}`}
              className="num text-[7rem] font-bold leading-none text-pulse drop-shadow-[0_0_30px_rgba(0,0,0,0.4)]"
              aria-label={`Predicted digit ${digit}`}
            >
              {digit}
            </p>
            <Countdown remaining={held.remaining} />
          </div>
          <p className="font-mono text-sm text-white">MATCH {digit}</p>
          <p className="text-xs text-mute">
            {held.pick?.consensus ?? pred.consensus}/3 methods agreed at lock
          </p>
          <div className="mt-1 flex max-w-[15rem] flex-wrap justify-center gap-1">
            {held.live.length === 0 ? (
              <span className="font-mono text-[11px] text-mute">waiting for the first tick…</span>
            ) : (
              held.live.map((d, i) => (
                <span
                  key={i}
                  className={`num flex h-5 w-5 items-center justify-center rounded text-[11px] ${d === digit ? 'bg-pulse font-bold text-ink' : 'bg-line text-soft'}`}
                >
                  {d}
                </span>
              ))
            )}
          </div>
          <p className="font-mono text-[11px] text-mute">
            {hits} hit{hits === 1 ? '' : 's'} in {held.live.length} tick{held.live.length === 1 ? '' : 's'}
            {pred.digit !== digit ? ` · live pick now ${pred.digit}` : ''}
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="label">{marketName}</p>
              <p className="num text-2xl font-semibold text-white">
                {price}{' '}
                <span className="text-sm text-mute">
                  last digit{' '}
                  <span className="text-white">{pred.last}</span>
                </span>
              </p>
            </div>
            <p className="font-mono text-xs text-mute">
              {ticks.toLocaleString()} ticks{backfilling ? ' · filling' : ''}{' '}
              · {pred.micros.toFixed(0)} µs
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat
              label="Ensemble score"
              value={pct(pred.score)}
              hint="estimated chance · fair 10%"
              tone="text-pulse"
            />
            <Stat
              label="Backtested hit rate"
              value={pct(ens.hitRate, 2)}
              hint={`${ens.wins.toLocaleString()} / ${ens.trades.toLocaleString()} trades`}
            />
            <Stat
              label="Edge vs break-even"
              value={`${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(2)} pts`}
              hint={`break-even ${pct(sig.breakeven, 2)} at ${pct(sig.payout, 0)} payout`}
              tone={edge > 0 ? 'text-pulse' : 'text-cold'}
            />
            <Stat
              label="Significance"
              value={<span className={band.cls}>{ens.significance.toFixed(1)}</span>}
              hint={`${band.name} · z ${ens.z.toFixed(2)}`}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-mute">
              <span>Significance of the ensemble record vs random (10%)</span>
              <label className="flex items-center gap-2">
                High band from
                <input
                  type="range"
                  min={87}
                  max={98}
                  value={threshold}
                  onChange={(e) => onThreshold(Number(e.target.value))}
                  className="accent-[#3cf2c0]"
                />
                <span className="num w-6 text-white">{threshold}</span>
              </label>
            </div>
            <Meter value={ens.significance} threshold={threshold} />
          </div>
          <p className="text-xs leading-relaxed text-mute">
            Significance says how unlikely the ensemble's past hit rate would
            be if digits were purely random. It is not a win probability. A
            Matches contract only pays if the edge beats the{' '}
            {pct(sig.breakeven, 2)} break-even over a large sample.
          </p>
        </div>
      </div>
    </section>
  )
}

function DigitBoard({ pred }: { pred: Pred }) {
  const max = Math.max(0.13, ...pred.rows.map((r) => r.score))
  return (
    <Panel
      kicker="Digit probability board"
      title="Next-digit scores"
      right={<span className="font-mono text-xs text-mute">fair line 10%</span>}
    >
      <div className="relative flex h-48 items-end gap-2">
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/30"
          style={{ bottom: `${(0.1 / max) * 100}%` }}
        />
        {pred.rows.map((r) => {
          const on = r.digit === pred.digit
          return (
            <div
              key={r.digit}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`Digit ${r.digit}: ensemble ${pct(r.score)} · last 100 ${pct(r.short)} · last 1,000 ${pct(r.long)} · after ${pred.last} ${pct(r.markov)}`}
            >
              <span className={`num text-[10px] ${on ? 'text-pulse' : 'text-soft'}`}>
                {pct(r.score)}
              </span>
              <div
                className={`w-full rounded-t-md transition-all duration-300 ${on ? 'bg-pulse' : r.score > 0.1 ? 'bg-volt/70' : 'bg-line'}`}
                style={{ height: `${(r.score / max) * 100}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {pred.rows.map((r) => (
          <span
            key={r.digit}
            className={`num flex-1 text-center text-sm font-semibold ${r.digit === pred.digit ? 'text-pulse' : 'text-white'}`}
          >
            {r.digit}
          </span>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-xs">
          <thead>
            <tr className="label text-left">
              <th className="py-1.5 font-normal">Digit</th>
              <th className="py-1.5 text-right font-normal">Last 100</th>
              <th className="py-1.5 text-right font-normal">Last 1,000</th>
              <th className="py-1.5 text-right font-normal">After {pred.last}</th>
              <th className="py-1.5 text-right font-normal">Ensemble</th>
              <th className="py-1.5 text-right font-normal">Ticks since seen</th>
            </tr>
          </thead>
          <tbody className="num">
            {pred.rows.map((r) => (
              <tr
                key={r.digit}
                className={`border-t border-line ${r.digit === pred.digit ? 'text-pulse' : 'text-soft'}`}
              >
                <td className="py-1.5 font-semibold">{r.digit}</td>
                <td className="py-1.5 text-right">{pct(r.short)}</td>
                <td className="py-1.5 text-right">{pct(r.long)}</td>
                <td className="py-1.5 text-right">{pct(r.markov)}</td>
                <td className="py-1.5 text-right font-semibold">{pct(r.score)}</td>
                <td className="py-1.5 text-right">{r.gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function RecentPanel({ pred }: { pred: Pred }) {
  const hits = pred.recent.filter((r) => r.predicted === r.actual).length
  return (
    <Panel
      kicker="Settled predictions"
      title={`Last ${pred.recent.length} ticks`}
      right={
        <span className="font-mono text-xs text-mute">
          {hits}/{pred.recent.length} matched
        </span>
      }
    >
      <p className="mb-3 text-xs text-mute">
        Each row is what the ensemble predicted before the tick arrived, and
        the digit that actually came. Newest first.
      </p>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {[...pred.recent].reverse().map((r, i) => {
          const win = r.predicted === r.actual
          return (
            <li
              key={i}
              className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 font-mono text-xs ${win ? 'border-pulse/50 bg-pulse/10 text-pulse' : 'border-line text-soft'}`}
            >
              <span>
                {r.predicted} → <span className="text-white">{r.actual}</span>
              </span>
              {win ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <X className="h-3.5 w-3.5 text-mute" />
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function MethodTable({ pred }: { pred: Pred }) {
  const be = pred.signal.breakeven
  return (
    <Panel
      kicker="Walk-forward backtest"
      title="How each method has performed"
      right={
        <span className="font-mono text-xs text-mute">
          fair 10.00% · break-even {pct(be, 2)}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="label text-left">
              <th className="py-2 font-normal">Method</th>
              <th className="py-2 text-center font-normal">Pick now</th>
              <th className="py-2 text-right font-normal">Hit rate</th>
              <th className="py-2 text-right font-normal">95% range</th>
              <th className="py-2 text-right font-normal">Sample</th>
              <th className="py-2 text-right font-normal">z</th>
              <th className="py-2 text-right font-normal">Significance</th>
            </tr>
          </thead>
          <tbody>
            {pred.methods.map((m) => (
              <tr key={m.method} className="border-t border-line align-top">
                <td className="py-2.5">
                  <p className="font-medium text-white">
                    {METHOD_META[m.method].name}
                  </p>
                  <p className="text-xs text-mute">{METHOD_META[m.method].how}</p>
                </td>
                <td className="num py-2.5 text-center text-lg font-bold text-pulse">
                  {m.pick}
                </td>
                <td
                  className={`num py-2.5 text-right ${m.hitRate > be ? 'text-pulse' : 'text-soft'}`}
                >
                  {pct(m.hitRate, 2)}
                </td>
                <td className="num py-2.5 text-right text-mute">
                  {pct(m.low, 1)}–{pct(m.high, 1)}
                </td>
                <td className="num py-2.5 text-right text-mute">
                  {m.trades.toLocaleString()}
                </td>
                <td className="num py-2.5 text-right text-soft">{m.z.toFixed(2)}</td>
                <td className="num py-2.5 text-right text-white">
                  {m.significance.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-mute">
        Each method decides using only ticks before the one it is scored on.
        Volatility indices come from a random number generator, so hit rates
        near 10% are what to expect. Treat the prediction as an edge only when
        the 95% range sits above break-even.
      </p>
    </Panel>
  )
}

function WindowPanel({ held, test }: { held: Held; test: WindowBacktest }) {
  const hitWindows = held.history.filter((w) => w.digits.includes(w.digit)).length
  const fairWin = test.windows ? test.expectedHit / test.windows : 0
  const win = test.windows ? test.windowsHit / test.windows : 0
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel
        kicker={`Settled ${PREDICTION_WINDOW_SEC} s windows`}
        title="This session"
        right={
          <span className="font-mono text-xs text-mute">
            {hitWindows}/{held.history.length} windows hit
          </span>
        }
      >
        {held.history.length === 0 ? (
          <p className="text-xs text-mute">
            The first window settles {PREDICTION_WINDOW_SEC} seconds after the
            pick is locked. Results stay on this page until you switch market.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {held.history.map((w) => {
              const hits = w.digits.filter((d) => d === w.digit).length
              return (
                <li
                  key={w.startEpoch}
                  className={`flex items-center gap-3 rounded-lg border px-2.5 py-1.5 font-mono text-xs ${hits ? 'border-pulse/50 bg-pulse/10' : 'border-line'}`}
                >
                  <span className="w-16 text-mute">
                    {new Date(w.startEpoch * 1000).toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span className={`w-14 font-semibold ${hits ? 'text-pulse' : 'text-white'}`}>
                    MATCH {w.digit}
                  </span>
                  <span className="flex flex-1 flex-wrap gap-0.5">
                    {w.digits.map((d, i) => (
                      <span key={i} className={d === w.digit ? 'font-bold text-pulse' : 'text-mute'}>
                        {d}
                      </span>
                    ))}
                  </span>
                  <span className="text-soft">
                    {hits}/{w.digits.length}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
      <Panel
        kicker="Walk-forward backtest"
        title={`Holding one digit for ${PREDICTION_WINDOW_SEC} s`}
        right={
          <span className="font-mono text-xs text-mute">
            {test.windows.toLocaleString()} windows
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Windows with a hit"
            value={pct(win, 1)}
            hint={`${test.windowsHit.toLocaleString()} / ${test.windows.toLocaleString()} · random ${pct(fairWin, 1)}`}
            tone={win > fairWin ? 'text-pulse' : 'text-soft'}
          />
          <Stat
            label="Ticks per window"
            value={test.avgTicks.toFixed(1)}
            hint={`${test.ticks.toLocaleString()} ticks settled`}
          />
          <Stat
            label="Per-tick hit rate"
            value={pct(test.tickRate, 2)}
            hint={`${test.tickHits.toLocaleString()} hits · fair 10%`}
            tone={test.tickRate > 0.1 ? 'text-pulse' : 'text-soft'}
          />
          <Stat
            label="Significance"
            value={test.significance.toFixed(1)}
            hint={`z ${test.z.toFixed(2)} vs random`}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mute">
          Each past window locks the pick made before its first tick and counts
          every tick inside the next {PREDICTION_WINDOW_SEC} seconds. A digit
          that shows up at least once is expected about {pct(fairWin, 0)} of
          the time by chance alone with this many ticks, so compare against
          that line, not 100%. Each Matches contract still settles on its own
          tick and pays only above break-even.
        </p>
      </Panel>
    </div>
  )
}
