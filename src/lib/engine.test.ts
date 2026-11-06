import { describe, expect, it } from 'vitest'
import {
  chiSquarePValue,
  contractSignals,
  digitStats,
  estimate,
  lastDigit,
  matchesPredict,
  matchesWindowBacktest,
  wilson,
} from './engine'

describe('engine', () => {
  it('extracts the last digit respecting pip size', () => {
    expect(lastDigit(1234.5, 2)).toBe(0)
    expect(lastDigit(6543.217, 3)).toBe(7)
  })

  it('reports a uniform distribution as unskewed', () => {
    const digits = Array.from({ length: 5000 }, (_, i) => i % 10)
    const s = digitStats(digits)
    expect(s.chi2).toBe(0)
    expect(s.pValue).toBeCloseTo(1, 5)
  })

  it('matches known chi-square p-values', () => {
    expect(chiSquarePValue(16.919, 9)).toBeCloseTo(0.05, 3)
  })

  it('detects a strong even bias with high confidence', () => {
    const digits = Array.from({ length: 2000 }, (_, i) =>
      i % 5 === 0 ? 1 : (i * 2) % 10,
    )
    const prices = digits.map((d, i) => 100 + i + d / 100)
    const eo = contractSignals(digits, prices, {
      lookback: 500,
      barrier: 4,
      threshold: 90,
    }).find((s) => s.kind === 'even_odd')!
    expect(eo.label).toBe('EVEN')
    expect(eo.confidence).toBeGreaterThan(99)
    expect(eo.backtest.hcWins / eo.backtest.hcTrades).toBeGreaterThan(0.75)
  })

  it('bounds accuracy with the Wilson interval', () => {
    const { low, high } = wilson(90, 100)
    expect(low).toBeLessThan(0.9)
    expect(high).toBeGreaterThan(0.9)
    const r = estimate({
      accuracy: 0.5,
      sample: 10000,
      dailyContracts: 100,
      stake: 1,
      payout: 0.95,
    })
    expect(r.advantage).toBeLessThan(0.02)
  })

  it('predicts a dominant digit for Matches and backtests it', () => {
    // Digit 7 appears ~40% of the time, the rest are spread evenly.
    let seed = 1
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const digits = Array.from({ length: 3000 }, () =>
      rnd() < 0.4 ? 7 : Math.floor(rnd() * 10),
    )
    const r = matchesPredict(digits)
    expect(r.digit).toBe(7)
    expect(r.rows).toHaveLength(10)
    const ens = r.methods.find((m) => m.method === 'ensemble')!
    expect(ens.trades).toBe(2900)
    expect(ens.hitRate).toBeGreaterThan(0.3)
    expect(ens.significance).toBeGreaterThan(99)
    expect(r.recent).toHaveLength(24)
  })

  it('keeps Matches windows consistent with the Markov transitions', () => {
    // Deterministic cycle: every digit is followed by the next one.
    const digits = Array.from({ length: 2000 }, (_, i) => i % 10)
    const r = matchesPredict(digits)
    expect(r.last).toBe(9)
    expect(r.methods.find((m) => m.method === 'markov')!.pick).toBe(0)
    expect(r.methods.find((m) => m.method === 'markov')!.hitRate).toBeGreaterThan(0.95)
    expect(r.rows[0].gap).toBe(9)
    expect(r.rows[9].gap).toBe(0)
  })

  it('scores 30-second Matches windows without overlap', () => {
    // One tick every 2 s → 15 ticks per 30 s window; pick is always 3.
    const digits = Array.from({ length: 300 }, (_, i) => (i % 5 === 0 ? 3 : 1))
    const times = digits.map((_, i) => 1000 + i * 2)
    const picks = new Int8Array(300).fill(3)
    picks.fill(-1, 0, 100)
    const w = matchesWindowBacktest(digits, times, picks, 30)
    expect(w.avgTicks).toBe(15)
    expect(w.windows).toBe(13) // ticks 100..294; the last partial window stays open
    expect(w.windowsHit).toBe(13)
    expect(w.tickRate).toBeCloseTo(0.2, 5)
    expect(w.expectedHit).toBeCloseTo(13 * (1 - 0.9 ** 15), 5)
  })
})
