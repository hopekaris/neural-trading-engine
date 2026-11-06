import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { AccuracyEstimator } from '../components/AccuracyEstimator'
import { ContractAnalyzer } from '../components/ContractAnalyzer'
import { PatternPanel } from '../components/PatternPanel'
import { ProbabilityEngine } from '../components/ProbabilityEngine'
import { TickTape } from '../components/TickTape'
import { Skeleton } from '../components/ui'
import {
  DEFAULT_CONFIG,
  type ContractKind,
  type EngineConfig,
} from '../lib/engine'
import { MARKET_BY_SYMBOL } from '../lib/markets'
import { useAnalysis, useFeed } from '../lib/useFeed'

export const Route = createFileRoute('/')({ component: EnginePage })

function EnginePage() {
  const { feed } = useFeed()
  const [cfg, setCfg] = useState<EngineConfig>(DEFAULT_CONFIG)
  const [active, setActive] = useState<ContractKind>('even_odd')
  const focus = feed?.snap.focus
  const series = focus ? feed?.series.get(focus) : undefined
  const analysis = useAnalysis(series?.loaded ? series : undefined, cfg)
  const market = focus ? MARKET_BY_SYMBOL[focus] : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-pulse">Neural engine · active</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Precision digit analysis
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            Every tick re-scores the last 5,000 digits, the pattern map, and
            five contract signals for the focused market.
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

      {!analysis || !series || !market ? (
        <div className="space-y-6" aria-busy="true">
          <p className="font-mono text-xs text-mute">
            Loading 5,000-tick history…
          </p>
          <Skeleton className="h-48" />
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      ) : (
        <>
          <TickTape series={series} market={market} micros={analysis.micros} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ProbabilityEngine stats={analysis.stats} />
            <PatternPanel pattern={analysis.pattern} />
          </div>
          <ContractAnalyzer
            signals={analysis.signals}
            cfg={cfg}
            onCfg={setCfg}
            active={active}
            onSelect={setActive}
          />
          <AccuracyEstimator
            signal={analysis.signals.find((s) => s.kind === active)!}
          />
        </>
      )}
    </div>
  )
}
