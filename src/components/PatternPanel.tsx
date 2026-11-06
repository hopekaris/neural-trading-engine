import type { PatternStats } from '../lib/engine'
import { Panel, Stat, pct } from './ui'

export function PatternPanel({ pattern }: { pattern: PatternStats }) {
  const maxP = Math.max(0.15, ...pattern.next)
  return (
    <Panel kicker="Pattern recognition" title="Digit transition map">
      <p className="text-sm text-mute">
        What has followed a{' '}
        <span className="num font-semibold text-white">{pattern.last}</span>{' '}
        across the window ({pattern.nextSamples} samples).
      </p>
      <div className="mt-4 space-y-1.5">
        {pattern.next.map((p, d) => (
          <div key={d} className="flex items-center gap-2">
            <span className="num w-4 text-xs text-white">{d}</span>
            <div className="h-3 flex-1 rounded-full bg-line">
              <div
                className={`h-full rounded-full ${p > 0.1 ? 'bg-pulse' : 'bg-volt/60'}`}
                style={{ width: `${(p / maxP) * 100}%` }}
              />
            </div>
            <span className="num w-12 text-right text-xs text-soft">
              {pct(p)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Stat
          label="Parity streak"
          value={`${pattern.parityStreak.length}× ${pattern.parityStreak.parity}`}
          hint={`longest in window: ${pattern.longestParityStreak}`}
        />
        <Stat
          label="Repeat rate"
          value={pct(pattern.repeatRate)}
          hint="same digit twice · fair 10%"
        />
        <Stat
          label="Strongest link"
          value={`${pattern.strongest.from} → ${pattern.strongest.to}`}
          hint={`${pct(pattern.strongest.p)} · z ${pattern.strongest.z.toFixed(2)}`}
          tone="text-volt"
        />
        <Stat label="Transitions" value="100" hint="10 × 10 Markov matrix" />
      </div>
    </Panel>
  )
}
