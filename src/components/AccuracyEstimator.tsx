import { useEffect, useState } from 'react'
import { CONTRACT_META, estimate, type Signal } from '../lib/engine'
import { Panel, Stat, money, pct } from './ui'

type Source = 'hc' | 'all' | 'manual'

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  suffix?: string
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="mt-1 flex items-center rounded-lg border border-line bg-panel-2 focus-within:border-pulse/60">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          step={step}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          className="num w-full bg-transparent px-3 py-2 text-white outline-none"
        />
        {suffix && (
          <span className="pr-3 font-mono text-xs text-mute">{suffix}</span>
        )}
      </span>
    </label>
  )
}

export function AccuracyEstimator({ signal }: { signal: Signal }) {
  const [daily, setDaily] = useState(200)
  const [stake, setStake] = useState(5)
  const [payoutPct, setPayoutPct] = useState(
    Math.round(signal.payout * 1000) / 10,
  )
  const [source, setSource] = useState<Source>('hc')
  const [manual, setManual] = useState(90)

  useEffect(() => {
    setPayoutPct(Math.round(signal.payout * 1000) / 10)
  }, [signal.kind, signal.p0])

  const bt = signal.backtest
  const hasHc = bt.hcTrades > 0
  const effective: Source = source === 'hc' && !hasHc ? 'all' : source
  const accuracy =
    effective === 'manual'
      ? manual / 100
      : effective === 'hc'
        ? bt.hcWins / bt.hcTrades
        : bt.trades
          ? bt.wins / bt.trades
          : 0
  const sample =
    effective === 'manual'
      ? Math.max(1, daily)
      : effective === 'hc'
        ? bt.hcTrades
        : bt.trades
  const r = estimate({
    accuracy,
    sample,
    dailyContracts: daily,
    stake,
    payout: payoutPct / 100,
  })
  const positive = r.advantage > 0

  return (
    <Panel
      kicker="02 · AI accuracy advantage estimator"
      title={`${CONTRACT_META[signal.kind].title} · ${signal.label}`}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <NumField
          label="Daily contracts"
          value={daily}
          onChange={(v) => setDaily(Math.round(v))}
          min={1}
        />
        <NumField
          label="Stake per contract"
          value={stake}
          onChange={setStake}
          step={0.5}
          min={0.35}
          suffix="USD"
        />
        <NumField
          label="Payout on win"
          value={payoutPct}
          onChange={setPayoutPct}
          step={0.1}
          suffix="%"
        />
      </div>

      <div className="mt-4">
        <span className="label">Accuracy source</span>
        <div className="mt-1.5 flex flex-wrap gap-1 rounded-xl border border-line bg-panel-2 p-1 text-xs">
          {(
            [
              [
                'hc',
                `High-confidence backtest${hasHc ? ` (n=${bt.hcTrades})` : ' · none yet'}`,
              ],
              ['all', `All backtest trades (n=${bt.trades})`],
              ['manual', 'Manual'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setSource(k)}
              disabled={k === 'hc' && !hasHc}
              className={`rounded-lg px-3 py-1.5 transition disabled:opacity-40 ${
                effective === k
                  ? 'bg-pulse/15 text-pulse'
                  : 'text-mute hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        {effective === 'manual' && (
          <div className="mt-3 max-w-48">
            <NumField
              label="Assumed accuracy"
              value={manual}
              onChange={(v) => setManual(Math.min(100, v))}
              step={0.5}
              suffix="%"
            />
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          label="Measured accuracy"
          value={pct(accuracy)}
          hint={`n = ${sample.toLocaleString()}`}
        />
        <Stat
          label="High-confidence accuracy"
          value={pct(r.hcAccuracy)}
          hint={`95% band ${pct(r.hcAccuracy)}–${pct(r.hcHigh)}`}
          tone="text-volt"
        />
        <Stat
          label="Break-even"
          value={pct(r.breakeven)}
          hint={`at ${payoutPct}% payout`}
        />
        <Stat
          label="Accuracy advantage"
          value={`${positive ? '+' : ''}${(r.advantage * 100).toFixed(2)} pts`}
          tone={positive ? 'text-pulse' : 'text-cold'}
          hint={
            positive
              ? 'Edge survives the confidence bound'
              : 'No proven edge at 95% confidence'
          }
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          label="Daily turnover"
          value={money(r.dailyTurnover)}
          hint={`${daily} × ${money(stake)}`}
        />
        <Stat
          label="EV / contract"
          value={money(r.evPerContract)}
          tone={r.evPerContract >= 0 ? 'text-pulse' : 'text-cold'}
        />
        <Stat
          label="Expected daily P&L"
          value={money(r.dailyEv)}
          tone={r.dailyEv >= 0 ? 'text-pulse' : 'text-cold'}
          hint={`95% range ${money(r.range[0])} … ${money(r.range[1])}`}
        />
        <Stat
          label="Chance of a losing day"
          value={pct(r.pLosingDay, 0)}
          hint="normal approximation"
        />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-mute">
        Projections use the lower bound of the accuracy interval, so larger
        samples earn tighter, more trustworthy estimates. More daily contracts
        shrink relative variance but magnify any negative edge.
      </p>
    </Panel>
  )
}
