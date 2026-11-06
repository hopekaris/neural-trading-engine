import type { SeriesState } from '../lib/feed'
import type { Market } from '../lib/markets'
import { Stat } from './ui'

function Sparkline({ prices }: { prices: number[] }) {
  const pts = prices.slice(-160)
  if (pts.length < 2) return null
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const d = pts
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${((i / (pts.length - 1)) * 100).toFixed(2)},${(36 - ((p - min) / span) * 32 - 2).toFixed(2)}`,
    )
    .join(' ')
  return (
    <svg
      viewBox="0 0 100 36"
      preserveAspectRatio="none"
      className="h-20 w-full"
      role="img"
      aria-label="Recent price path"
    >
      <defs>
        <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3cf2c0" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3cf2c0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L100,36 L0,36 Z`} fill="url(#spark)" />
      <path
        d={d}
        fill="none"
        stroke="#3cf2c0"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function TickTape({
  series,
  market,
  micros,
}: {
  series: SeriesState
  market: Market
  micros: number
}) {
  const n = series.prices.length
  const price = series.prices[n - 1]
  const prev = series.prices[n - 2]
  const digit = series.digits[n - 1]
  const tape = series.digits.slice(-36)
  const up = price >= prev

  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="border-b border-line p-5 lg:border-b-0 lg:border-r">
          <p className="label">
            {market.name} · {market.symbol}
          </p>
          <div className="mt-2 flex items-end gap-4">
            <p
              className={`num text-4xl font-bold tracking-tight ${up ? 'text-pulse' : 'text-cold'}`}
            >
              {price?.toFixed(series.pip)}
            </p>
            <div
              key={series.liveTicks}
              className="blip grid h-14 w-14 place-items-center rounded-2xl border border-pulse/50 bg-panel-2 text-3xl font-bold text-white num"
              title="Last digit"
            >
              {digit}
            </div>
          </div>
          <Sparkline prices={series.prices} />
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <p className="label">Live digit tape · newest right</p>
            <p className="label">{series.liveTicks} streamed this session</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {tape.map((d, i) => (
              <span
                key={`${series.liveTicks}-${i}`}
                className={`num grid h-7 w-7 place-items-center rounded-md text-xs font-semibold ${
                  i === tape.length - 1
                    ? 'bg-pulse text-ink'
                    : d % 2 === 0
                      ? 'bg-volt/15 text-volt'
                      : 'bg-heat/10 text-heat'
                }`}
              >
                {d}
              </span>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-mute">
            <span className="text-volt">■</span> even{' '}
            <span className="ml-2 text-heat">■</span> odd
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat
              label="Window"
              value={`${n.toLocaleString()}`}
              hint="of 5,000 ticks"
            />
            <Stat
              label="Analysis"
              value={`${micros.toFixed(0)}µs`}
              hint="per tick, in-browser"
            />
            <Stat
              label="Pip size"
              value={series.pip}
              hint={`${market.cadence}s tick cadence`}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
