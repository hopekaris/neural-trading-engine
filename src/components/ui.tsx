import type { ReactNode } from 'react'

export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`
export const money = (v: number) =>
  `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function bandOf(confidence: number, threshold: number) {
  if (confidence >= threshold)
    return { name: 'HIGH', cls: 'text-pulse', bar: 'bg-pulse' }
  if (confidence >= 60)
    return { name: 'WATCH', cls: 'text-heat', bar: 'bg-heat' }
  return { name: 'NOISE', cls: 'text-mute', bar: 'bg-mute' }
}

export function Panel({
  title,
  kicker,
  right,
  children,
  className = '',
}: {
  title: string
  kicker?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel p-5 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          {kicker && <p className="label mb-1">{kicker}</p>}
          <h2 className="text-lg font-semibold tracking-tight text-white">
            {title}
          </h2>
        </div>
        {right}
      </header>
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'text-white',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 px-4 py-3">
      <p className="label">{label}</p>
      <p className={`num mt-1 text-xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-mute">{hint}</p>}
    </div>
  )
}

export function Meter({
  value,
  threshold,
}: {
  value: number
  threshold: number
}) {
  const band = bandOf(value, threshold)
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-line">
      <div
        className={`h-full ${band.bar} transition-all duration-500`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
      <div
        className="absolute inset-y-0 w-px bg-white/60"
        style={{ left: `${threshold}%` }}
        title={`High-confidence band starts at ${threshold}`}
      />
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-line/60 motion-reduce:animate-none ${className}`}
    />
  )
}
