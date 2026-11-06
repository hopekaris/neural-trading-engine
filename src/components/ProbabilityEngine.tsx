import type { DigitStats } from '../lib/engine'
import { Panel, Stat } from './ui'

export function ProbabilityEngine({ stats }: { stats: DigitStats }) {
  const top = Math.max(14, ...stats.pct.map((p) => Math.ceil(p + 1)))
  const zMax = Math.max(3, ...stats.z.map((z) => Math.abs(z)))
  const significant = stats.pValue < 0.05

  return (
    <Panel
      kicker="01 · Probability engine"
      title="Neural digit skew"
      right={
        <span className="num rounded-lg border border-line px-2.5 py-1 text-xs text-soft">
          {stats.n.toLocaleString()} ticks
        </span>
      }
    >
      <div
        className="grid grid-cols-10 items-end gap-1.5 sm:gap-2"
        style={{ height: 200 }}
        role="img"
        aria-label="Last-digit distribution over the analysed window"
      >
        {stats.pct.map((p, d) => {
          const isHot = d === stats.hot
          const isCold = d === stats.cold
          return (
            <div key={d} className="relative flex h-full flex-col justify-end">
              <span
                className={`num mb-1 text-center text-[10px] sm:text-[11px] ${isHot ? 'text-heat' : isCold ? 'text-cold' : 'text-soft'}`}
              >
                {p.toFixed(1)}
              </span>
              <div
                className={`rounded-t-md transition-all duration-500 ${
                  isHot
                    ? 'bg-heat'
                    : isCold
                      ? 'bg-cold'
                      : 'bg-gradient-to-t from-pulse-dim to-pulse'
                }`}
                style={{ height: `${(p / top) * 100}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="relative -mt-[1px] grid grid-cols-10 gap-1.5 border-t border-dashed border-white/40 pt-2 sm:gap-2">
        {stats.counts.map((c, d) => (
          <div key={d} className="text-center">
            <p className="num text-base font-bold text-white">{d}</p>
            <p className="num text-[10px] text-mute">{c}</p>
          </div>
        ))}
      </div>
      <p className="mt-1 text-right font-mono text-[10px] text-mute">
        dashed line = baseline · uniform expectation 10.0%
      </p>

      <div className="mt-5">
        <p className="label mb-2">Deviation from fair (z-score)</p>
        <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
          {stats.z.map((z, d) => (
            <div
              key={d}
              className="relative h-14 rounded-md bg-panel-2"
              title={`Digit ${d}: z = ${z.toFixed(2)}`}
            >
              <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
              <div
                className={`absolute inset-x-1 rounded-sm ${z >= 0 ? 'bg-heat/80' : 'bg-cold/80'}`}
                style={
                  z >= 0
                    ? { bottom: '50%', height: `${(z / zMax) * 50}%` }
                    : { top: '50%', height: `${(-z / zMax) * 50}%` }
                }
              />
              <span className="num absolute inset-x-0 bottom-0.5 text-center text-[9px] text-soft">
                {z.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          label="Hot digit"
          value={stats.hot}
          tone="text-heat"
          hint={`${stats.pct[stats.hot].toFixed(2)}% · z ${stats.z[stats.hot].toFixed(2)}`}
        />
        <Stat
          label="Cold digit"
          value={stats.cold}
          tone="text-cold"
          hint={`${stats.pct[stats.cold].toFixed(2)}% · z ${stats.z[stats.cold].toFixed(2)}`}
        />
        <Stat
          label="χ² (df 9)"
          value={stats.chi2.toFixed(2)}
          hint={`p = ${stats.pValue.toFixed(3)}`}
          tone={significant ? 'text-pulse' : 'text-white'}
        />
        <Stat
          label="Skew index"
          value={stats.skew.toFixed(3)}
          hint={
            significant ? 'Distribution is skewed' : 'Within random variation'
          }
        />
      </div>
    </Panel>
  )
}
