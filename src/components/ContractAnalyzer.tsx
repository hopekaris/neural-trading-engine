import {
  CONTRACT_META,
  type ContractKind,
  type EngineConfig,
  type Signal,
} from '../lib/engine'
import { Meter, Panel, bandOf, pct } from './ui'

export function ContractAnalyzer({
  signals,
  cfg,
  onCfg,
  active,
  onSelect,
}: {
  signals: Signal[]
  cfg: EngineConfig
  onCfg: (c: EngineConfig) => void
  active: ContractKind
  onSelect: (k: ContractKind) => void
}) {
  return (
    <Panel
      kicker="Confidence scoring · multi-contract"
      title="Contract signals"
      right={
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="label">Lookback</span>
            <select
              value={cfg.lookback}
              onChange={(e) =>
                onCfg({ ...cfg, lookback: Number(e.target.value) })
              }
              className="num rounded-md border border-line bg-panel-2 px-2 py-1 text-white"
            >
              {[100, 250, 500, 1000, 2500].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="label">Barrier</span>
            <select
              value={cfg.barrier}
              onChange={(e) =>
                onCfg({ ...cfg, barrier: Number(e.target.value) })
              }
              className="num rounded-md border border-line bg-panel-2 px-2 py-1 text-white"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel-2/60 px-4 py-3">
        <span className="label">High-confidence band</span>
        <input
          type="range"
          min={87}
          max={98}
          value={cfg.threshold}
          onChange={(e) => onCfg({ ...cfg, threshold: Number(e.target.value) })}
          className="flex-1 accent-[#3cf2c0]"
          aria-label="High-confidence threshold"
        />
        <span className="num text-sm text-pulse">≥ {cfg.threshold}</span>
        <span className="w-full text-xs text-mute">
          Signals scoring inside the 87–98 band are flagged HIGH. The backtest
          reports how those flagged trades actually settled on the historical
          ticks.
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {signals.map((s) => {
          const meta = CONTRACT_META[s.kind]
          const band = bandOf(s.confidence, cfg.threshold)
          const acc = s.backtest.trades
            ? s.backtest.wins / s.backtest.trades
            : 0
          const hcAcc = s.backtest.hcTrades
            ? s.backtest.hcWins / s.backtest.hcTrades
            : null
          const edge = acc - s.breakeven
          const on = active === s.kind
          return (
            <button
              key={s.kind}
              onClick={() => onSelect(s.kind)}
              aria-pressed={on}
              className={`group rounded-xl border p-4 text-left transition ${
                on
                  ? 'border-pulse/60 bg-pulse/[0.06] ring-1 ring-pulse/30'
                  : 'border-line bg-panel-2/50 hover:border-soft/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="label">{meta.title}</p>
                <span
                  className={`font-mono text-[10px] font-bold tracking-widest ${band.cls}`}
                >
                  {band.name}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                {s.label}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Meter value={s.confidence} threshold={cfg.threshold} />
                <span
                  className={`num w-12 text-right text-sm font-semibold ${band.cls}`}
                >
                  {s.confidence.toFixed(0)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px]">
                <dt className="text-mute">observed</dt>
                <dd className="text-right text-soft">
                  {pct(s.observed)}{' '}
                  <span className="text-mute">/ {pct(s.p0, 0)}</span>
                </dd>
                <dt className="text-mute">backtest</dt>
                <dd className="text-right text-soft">
                  {pct(acc)}{' '}
                  <span className="text-mute">n={s.backtest.trades}</span>
                </dd>
                <dt className="text-mute">HC trades</dt>
                <dd className="text-right text-soft">
                  {hcAcc == null ? '—' : pct(hcAcc)}{' '}
                  <span className="text-mute">n={s.backtest.hcTrades}</span>
                </dd>
                <dt className="text-mute">break-even</dt>
                <dd className="text-right text-soft">{pct(s.breakeven)}</dd>
                <dt className="text-mute">edge</dt>
                <dd
                  className={`text-right ${edge > 0 ? 'text-pulse' : 'text-cold'}`}
                >
                  {edge > 0 ? '+' : ''}
                  {(edge * 100).toFixed(2)} pts
                </dd>
              </dl>
            </button>
          )
        })}
        <div className="rounded-xl border border-dashed border-line p-4 text-xs leading-relaxed text-mute">
          <p className="label mb-2">How scores work</p>
          Each signal compares the recommended side's hit-rate over the lookback
          window with its fair odds. The confidence score is the statistical
          significance of that gap (Bonferroni-adjusted for Matches/Differs).
          Edge is backtested accuracy minus the payout's break-even rate.
        </div>
      </div>
    </Panel>
  )
}
