/**
 * Analytical core of the neural trading engine.
 * Pure functions only — no DOM, no network — so they run identically in the
 * browser today and in a server-side ingestion worker later.
 */

export type ContractKind =
  'matches' | 'differs' | 'even_odd' | 'over_under' | 'rise_fall'

export interface DigitStats {
  n: number
  counts: number[]
  pct: number[]
  /** Standardised deviation of each digit from the uniform 10% expectation. */
  z: number[]
  chi2: number
  /** p-value of the chi-square goodness-of-fit test against a fair digit distribution (df = 9). */
  pValue: number
  /** Normalised entropy deficit, 0 = perfectly uniform, scaled ×1000 for readability. */
  skew: number
  entropy: number
  hot: number
  cold: number
}

export interface Backtest {
  trades: number
  wins: number
  /** Trades taken only when the live confidence score was inside the high-confidence band. */
  hcTrades: number
  hcWins: number
}

export interface Signal {
  kind: ContractKind
  /** Human label of the recommended position, e.g. "EVEN" or "OVER 4". */
  label: string
  /** Theoretical win probability if digits are perfectly fair. */
  p0: number
  /** Observed win probability for the recommended side inside the lookback window. */
  observed: number
  z: number
  /** 0–100 statistical confidence that the observed deviation is not random noise. */
  confidence: number
  /** Estimated return on a winning stake (0.95 = 95% profit). */
  payout: number
  breakeven: number
  backtest: Backtest
}

export interface PatternStats {
  last: number
  /** Next-digit probabilities given the current last digit (first-order Markov chain). */
  next: number[]
  nextSamples: number
  strongest: { from: number; to: number; p: number; z: number }
  parityStreak: { parity: 'EVEN' | 'ODD'; length: number }
  longestParityStreak: number
  repeatRate: number
}

export interface EngineConfig {
  lookback: number
  barrier: number
  threshold: number
}

export interface Analysis {
  stats: DigitStats
  signals: Signal[]
  pattern: PatternStats
  /** Wall-clock analysis time in microseconds. */
  micros: number
}

export const DEFAULT_CONFIG: EngineConfig = {
  lookback: 1000,
  barrier: 4,
  threshold: 87,
}

/** House margin used to approximate venue payouts from the fair odds. */
const MARGIN = 0.023

export function lastDigit(price: number, pip: number): number {
  return Math.round(price * 10 ** pip) % 10
}

// ---------- statistics helpers ----------

export function normalCdf(x: number): number {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + (0.3275911 * Math.abs(x)) / Math.SQRT2)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-(x * x) / 2)
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = x
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  let ser = 1.000000000190015
  for (const v of c) ser += v / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** Regularised upper incomplete gamma Q(a, x). */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1
  if (x < a + 1) {
    let sum = 1 / a
    let del = sum
    let ap = a
    for (let i = 0; i < 200; i++) {
      del *= x / ++ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
  }
  let b = x + 1 - a
  let c = 1e300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-12) break
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}

export function chiSquarePValue(chi2: number, df: number): number {
  return gammaQ(df / 2, chi2 / 2)
}

/** Two-sided confidence (0–100) that a z-score is not noise, with optional Bonferroni correction. */
export function zConfidence(z: number, comparisons = 1): number {
  const p = 2 * (1 - normalCdf(Math.abs(z)))
  return Math.max(0, 1 - Math.min(1, p * comparisons)) * 100
}

export function proportionZ(hits: number, n: number, p0: number): number {
  if (n === 0) return 0
  return (hits / n - p0) / Math.sqrt((p0 * (1 - p0)) / n)
}

/** Wilson score interval for a binomial proportion. */
export function wilson(
  wins: number,
  n: number,
  z = 1.96,
): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 }
  const p = wins / n
  const denom = 1 + (z * z) / n
  const centre = p + (z * z) / (2 * n)
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return { low: (centre - spread) / denom, high: (centre + spread) / denom }
}

export function payoutFor(p0: number): number {
  return (1 / p0) * (1 - MARGIN) - 1
}

export function breakevenFor(payout: number): number {
  return 1 / (1 + payout)
}

// ---------- probability engine ----------

export function digitStats(digits: number[]): DigitStats {
  const n = digits.length
  const counts = new Array<number>(10).fill(0)
  for (const d of digits) counts[d]++
  const e = n / 10
  const sd = Math.sqrt(n * 0.1 * 0.9) || 1
  let chi2 = 0
  let H = 0
  const pct = counts.map((c) => (n ? (c / n) * 100 : 0))
  const z = counts.map((c) => (c - e) / sd)
  for (const c of counts) {
    if (e > 0) chi2 += ((c - e) * (c - e)) / e
    if (c > 0) H -= (c / n) * Math.log(c / n)
  }
  const entropy = n ? H / Math.log(10) : 1
  let hot = 0
  let cold = 0
  counts.forEach((c, i) => {
    if (c > counts[hot]) hot = i
    if (c < counts[cold]) cold = i
  })
  return {
    n,
    counts,
    pct,
    z,
    chi2,
    pValue: n ? chiSquarePValue(chi2, 9) : 1,
    skew: (1 - entropy) * 1000,
    entropy,
    hot,
    cold,
  }
}

// ---------- pattern recognition ----------

export function patternStats(digits: number[]): PatternStats {
  const trans = Array.from({ length: 10 }, () => new Array<number>(10).fill(0))
  const rows = new Array<number>(10).fill(0)
  let repeats = 0
  let longest = 0
  let run = 0
  for (let i = 1; i < digits.length; i++) {
    const a = digits[i - 1]
    const b = digits[i]
    trans[a][b]++
    rows[a]++
    if (a === b) repeats++
    if (a % 2 === b % 2) run++
    else run = 0
    if (run + 1 > longest) longest = run + 1
  }
  let strongest = { from: 0, to: 0, p: 0.1, z: 0 }
  for (let a = 0; a < 10; a++) {
    for (let b = 0; b < 10; b++) {
      const z = proportionZ(trans[a][b], rows[a], 0.1)
      if (Math.abs(z) > Math.abs(strongest.z)) {
        strongest = {
          from: a,
          to: b,
          p: rows[a] ? trans[a][b] / rows[a] : 0,
          z,
        }
      }
    }
  }
  const last = digits[digits.length - 1] ?? 0
  const lastParity = last % 2
  let streak = 0
  for (let i = digits.length - 1; i >= 0 && digits[i] % 2 === lastParity; i--)
    streak++
  return {
    last,
    next: trans[last].map((c) => (rows[last] ? c / rows[last] : 0.1)),
    nextSamples: rows[last],
    strongest,
    parityStreak: { parity: lastParity ? 'ODD' : 'EVEN', length: streak },
    longestParityStreak: longest,
    repeatRate: digits.length > 1 ? repeats / (digits.length - 1) : 0,
  }
}

// ---------- contract signals + walk-forward backtest ----------

interface Decision {
  label: string
  p0: number
  hits: number
  z: number
  comparisons: number
  wins: (digit: number, move: number) => boolean
}

function argMax(a: number[]): number {
  let k = 0
  for (let i = 1; i < a.length; i++) if (a[i] > a[k]) k = i
  return k
}
function argMin(a: number[]): number {
  let k = 0
  for (let i = 1; i < a.length; i++) if (a[i] < a[k]) k = i
  return k
}

/** Builds every contract decision from rolling digit counts and the up-move count. */
function decide(
  counts: number[],
  ups: number,
  W: number,
  barrier: number,
): Record<ContractKind, Decision> {
  const top = argMax(counts)
  const bottom = argMin(counts)
  const even = counts[0] + counts[2] + counts[4] + counts[6] + counts[8]
  const odd = W - even
  let over = 0
  let under = 0
  for (let d = 0; d < 10; d++) {
    if (d > barrier) over += counts[d]
    if (d < barrier) under += counts[d]
  }
  const pOver = (9 - barrier) / 10
  const pUnder = barrier / 10
  const zOver = proportionZ(over, W, pOver)
  const zUnder = proportionZ(under, W, pUnder)
  const pickOver = zOver >= zUnder
  const isEven = even >= odd
  const rise = ups * 2 >= W
  return {
    matches: {
      label: `MATCH ${top}`,
      p0: 0.1,
      hits: counts[top],
      z: proportionZ(counts[top], W, 0.1),
      comparisons: 10,
      wins: (d) => d === top,
    },
    differs: {
      label: `DIFFER ${bottom}`,
      p0: 0.9,
      hits: W - counts[bottom],
      z: proportionZ(W - counts[bottom], W, 0.9),
      comparisons: 10,
      wins: (d) => d !== bottom,
    },
    even_odd: {
      label: isEven ? 'EVEN' : 'ODD',
      p0: 0.5,
      hits: isEven ? even : odd,
      z: proportionZ(isEven ? even : odd, W, 0.5),
      comparisons: 1,
      wins: (d) => (d % 2 === 0) === isEven,
    },
    over_under: {
      label: pickOver ? `OVER ${barrier}` : `UNDER ${barrier}`,
      p0: pickOver ? pOver : pUnder,
      hits: pickOver ? over : under,
      z: pickOver ? zOver : zUnder,
      comparisons: 2,
      wins: (d) => (pickOver ? d > barrier : d < barrier),
    },
    rise_fall: {
      label: rise ? 'RISE' : 'FALL',
      p0: 0.5,
      hits: rise ? ups : W - ups,
      z: proportionZ(rise ? ups : W - ups, W, 0.5),
      comparisons: 1,
      wins: (_d, m) => (rise ? m > 0 : m < 0),
    },
  }
}

const KINDS: ContractKind[] = [
  'matches',
  'differs',
  'even_odd',
  'over_under',
  'rise_fall',
]

export function contractSignals(
  digits: number[],
  prices: number[],
  cfg: EngineConfig,
): Signal[] {
  const n = digits.length
  const W = Math.max(50, Math.min(cfg.lookback, n - 1))
  const counts = new Array<number>(10).fill(0)
  const move = (i: number) => (i > 0 ? Math.sign(prices[i] - prices[i - 1]) : 0)
  let ups = 0
  const bt: Record<ContractKind, Backtest> = Object.fromEntries(
    KINDS.map((k) => [k, { trades: 0, wins: 0, hcTrades: 0, hcWins: 0 }]),
  ) as Record<ContractKind, Backtest>

  if (n > W) {
    for (let i = 0; i < W; i++) {
      counts[digits[i]]++
      if (move(i) > 0) ups++
    }
    // Walk forward: decide with ticks [t-W, t), settle on tick t.
    for (let t = W; t < n; t++) {
      const dec = decide(counts, ups, W, cfg.barrier)
      const m = move(t)
      for (const k of KINDS) {
        const d = dec[k]
        const win = d.wins(digits[t], m)
        const b = bt[k]
        b.trades++
        if (win) b.wins++
        if (d.z > 0 && zConfidence(d.z, d.comparisons) >= cfg.threshold) {
          b.hcTrades++
          if (win) b.hcWins++
        }
      }
      counts[digits[t]]++
      counts[digits[t - W]]--
      if (m > 0) ups++
      if (move(t - W) > 0) ups--
    }
  } else {
    for (let i = 0; i < n; i++) {
      counts[digits[i]]++
      if (move(i) > 0) ups++
    }
  }

  const live = decide(counts, ups, Math.max(1, Math.min(W, n)), cfg.barrier)
  return KINDS.map((kind) => {
    const d = live[kind]
    const payout = payoutFor(d.p0)
    const win = Math.max(1, Math.min(W, n))
    return {
      kind,
      label: d.label,
      p0: d.p0,
      observed: d.hits / win,
      z: d.z,
      confidence: d.z > 0 ? zConfidence(d.z, d.comparisons) : 0,
      payout,
      breakeven: breakevenFor(payout),
      backtest: bt[kind],
    }
  })
}

export function analyze(
  digits: number[],
  prices: number[],
  cfg: EngineConfig,
): Analysis {
  const t0 = performance.now()
  const stats = digitStats(digits)
  const signals = contractSignals(digits, prices, cfg)
  const pattern = patternStats(digits)
  const micros = (performance.now() - t0) * 1000
  return { stats, signals, pattern, micros }
}

// ---------- accuracy advantage estimator ----------

export interface EstimatorInput {
  accuracy: number
  sample: number
  dailyContracts: number
  stake: number
  payout: number
}

export interface EstimatorResult {
  breakeven: number
  /** Lower bound of the 95% Wilson interval — the accuracy you can claim with high confidence. */
  hcAccuracy: number
  hcHigh: number
  advantage: number
  evPerContract: number
  dailyEv: number
  dailyStd: number
  range: [number, number]
  pLosingDay: number
  dailyTurnover: number
}

export function estimate(i: EstimatorInput): EstimatorResult {
  const wins = Math.round(i.accuracy * i.sample)
  const { low, high } = wilson(wins, i.sample)
  const breakeven = breakevenFor(i.payout)
  const p = low
  const ev = p * i.payout * i.stake - (1 - p) * i.stake
  const dailyEv = ev * i.dailyContracts
  const perStd = i.stake * (1 + i.payout) * Math.sqrt(p * (1 - p))
  const dailyStd = perStd * Math.sqrt(i.dailyContracts)
  return {
    breakeven,
    hcAccuracy: low,
    hcHigh: high,
    advantage: low - breakeven,
    evPerContract: ev,
    dailyEv,
    dailyStd,
    range: [dailyEv - 1.96 * dailyStd, dailyEv + 1.96 * dailyStd],
    pLosingDay:
      dailyStd > 0 ? normalCdf(-dailyEv / dailyStd) : dailyEv < 0 ? 1 : 0,
    dailyTurnover: i.stake * i.dailyContracts,
  }
}

export const CONTRACT_META: Record<
  ContractKind,
  { title: string; family: string; blurb: string }
> = {
  matches: {
    title: 'Matches',
    family: 'Matches / Differs',
    blurb: 'Last digit equals the predicted digit. Fair odds 1 in 10.',
  },
  differs: {
    title: 'Differs',
    family: 'Matches / Differs',
    blurb:
      'Last digit is anything except the predicted digit. Fair odds 9 in 10.',
  },
  even_odd: {
    title: 'Even / Odd',
    family: 'Even / Odd',
    blurb: 'Parity of the settling last digit. Fair odds 1 in 2.',
  },
  over_under: {
    title: 'Over / Under',
    family: 'Over / Under',
    blurb: 'Last digit strictly above or below the barrier.',
  },
  rise_fall: {
    title: 'Rise / Fall',
    family: 'Rise / Fall',
    blurb: 'Direction of the next tick versus the current spot.',
  },
}

// ---------- Matches predictor ----------

export type MatchMethod = 'ensemble' | 'hot100' | 'hot1000' | 'markov'

export interface MatchMethodResult {
  method: MatchMethod
  /** Digit this method predicts for the next tick. */
  pick: number
  /** Walk-forward record: decided on ticks before t, settled on tick t. */
  trades: number
  wins: number
  hitRate: number
  low: number
  high: number
  z: number
  /** Two-sided significance (0–100) of the hit rate against the fair 10%. */
  significance: number
}

export interface MatchDigitRow {
  digit: number
  /** Smoothed frequency over the last 100 ticks. */
  short: number
  /** Smoothed frequency over the last 1,000 ticks. */
  long: number
  /** Smoothed probability of following the current last digit (Markov, last 1,000 ticks). */
  markov: number
  /** Mean of the three estimates. */
  score: number
  /** Ticks since the digit last appeared. */
  gap: number
}

export interface MatchesPrediction {
  /** The recommended digit for the next tick (ensemble pick). */
  digit: number
  /** Ensemble score of the recommended digit (fair = 10%). */
  score: number
  last: number
  rows: MatchDigitRow[]
  methods: MatchMethodResult[]
  /** How many of the three base methods agree with the ensemble pick. */
  consensus: number
  /** The most recent settled ensemble predictions, oldest first. */
  recent: { predicted: number; actual: number }[]
  /** Ensemble record rendered as a Signal so the accuracy estimator can reuse it. */
  signal: Signal
  /** Ensemble pick decided before each tick t (-1 during warm-up). */
  picks: Int8Array
}

const SHORT_W = 100
const LONG_W = 1000
const MATCH_METHODS: MatchMethod[] = ['ensemble', 'hot100', 'hot1000', 'markov']

/**
 * Predicts the next last digit for a Matches contract and walk-forward
 * backtests every method over the series, so each pick carries its own
 * record of how often that rule has actually matched.
 */
export function matchesPredict(
  digits: number[],
  threshold = DEFAULT_CONFIG.threshold,
  recentCount = 24,
): MatchesPrediction {
  const n = digits.length
  const short = new Array<number>(10).fill(0)
  const long = new Array<number>(10).fill(0)
  const trans = Array.from({ length: 10 }, () => new Array<number>(10).fill(0))
  const rowSum = new Array<number>(10).fill(0)
  const record = Object.fromEntries(
    MATCH_METHODS.map((m) => [m, { trades: 0, wins: 0, hcTrades: 0, hcWins: 0 }]),
  ) as Record<MatchMethod, Backtest>
  const recent: { predicted: number; actual: number }[] = []
  let ensWins = 0
  let ensTrades = 0
  const ensPicks = new Int8Array(n).fill(-1)

  // State at time t covers ticks [.., t): short/long windows and transitions i in [t-LONG_W+1, t-1].
  const estimates = (t: number) => {
    const sN = Math.min(SHORT_W, t)
    const lN = Math.min(LONG_W, t)
    const prev = t > 0 ? digits[t - 1] : 0
    const rs = rowSum[prev]
    const s: number[] = []
    const l: number[] = []
    const m: number[] = []
    const e: number[] = []
    for (let d = 0; d < 10; d++) {
      s[d] = (short[d] + 1) / (sN + 10)
      l[d] = (long[d] + 1) / (lN + 10)
      m[d] = (trans[prev][d] + 1) / (rs + 10)
      e[d] = (s[d] + l[d] + m[d]) / 3
    }
    return { s, l, m, e }
  }
  const advance = (t: number) => {
    // Move state from t to t+1 by adding tick t.
    const d = digits[t]
    short[d]++
    long[d]++
    if (t - SHORT_W >= 0) short[digits[t - SHORT_W]]--
    if (t - LONG_W >= 0) long[digits[t - LONG_W]]--
    if (t >= 1) {
      trans[digits[t - 1]][d]++
      rowSum[digits[t - 1]]++
    }
    const drop = t - LONG_W + 1
    if (drop >= 1) {
      trans[digits[drop - 1]][digits[drop]]--
      rowSum[digits[drop - 1]]--
    }
  }

  const warmup = Math.min(SHORT_W, n)
  for (let t = 0; t < warmup; t++) advance(t)
  for (let t = warmup; t < n; t++) {
    const { s, l, m, e } = estimates(t)
    const picks: Record<MatchMethod, number> = {
      ensemble: argMax(e),
      hot100: argMax(s),
      hot1000: argMax(l),
      markov: argMax(m),
    }
    const actual = digits[t]
    ensPicks[t] = picks.ensemble
    for (const k of MATCH_METHODS) {
      const r = record[k]
      r.trades++
      if (picks[k] === actual) r.wins++
    }
    // High-confidence gate: only count ensemble trades when its own record so far is significant.
    if (ensTrades >= 100) {
      const z = proportionZ(ensWins, ensTrades, 0.1)
      if (z > 0 && zConfidence(z) >= threshold) {
        record.ensemble.hcTrades++
        if (picks.ensemble === actual) record.ensemble.hcWins++
      }
    }
    ensTrades++
    if (picks.ensemble === actual) ensWins++
    if (t >= n - recentCount) recent.push({ predicted: picks.ensemble, actual })
    advance(t)
  }

  const { s, l, m, e } = estimates(n)
  const gap = new Array<number>(10).fill(n)
  for (let i = n - 1, seen = 0; i >= 0 && seen < 10; i--) {
    if (gap[digits[i]] === n) {
      gap[digits[i]] = n - 1 - i
      seen++
    }
  }
  const rows: MatchDigitRow[] = Array.from({ length: 10 }, (_, d) => ({
    digit: d,
    short: s[d],
    long: l[d],
    markov: m[d],
    score: e[d],
    gap: gap[d],
  }))
  const livePicks: Record<MatchMethod, number> = {
    ensemble: argMax(e),
    hot100: argMax(s),
    hot1000: argMax(l),
    markov: argMax(m),
  }
  const methods = MATCH_METHODS.map((method): MatchMethodResult => {
    const r = record[method]
    const z = proportionZ(r.wins, r.trades, 0.1)
    const ci = wilson(r.wins, r.trades)
    return {
      method,
      pick: livePicks[method],
      trades: r.trades,
      wins: r.wins,
      hitRate: r.trades ? r.wins / r.trades : 0,
      low: ci.low,
      high: ci.high,
      z,
      significance: z > 0 ? zConfidence(z) : 0,
    }
  })
  const ens = methods[0]
  const digit = livePicks.ensemble
  const payout = payoutFor(0.1)
  return {
    digit,
    score: e[digit],
    last: n ? digits[n - 1] : 0,
    rows,
    methods,
    consensus: [livePicks.hot100, livePicks.hot1000, livePicks.markov].filter(
      (p) => p === digit,
    ).length,
    recent,
    signal: {
      kind: 'matches',
      label: `MATCH ${digit}`,
      p0: 0.1,
      observed: ens.hitRate,
      z: ens.z,
      confidence: ens.significance,
      payout,
      breakeven: breakevenFor(payout),
      backtest: record.ensemble,
    },
    picks: ensPicks,
  }
}

export interface WindowBacktest {
  windowSec: number
  /** Completed, non-overlapping windows scored. */
  windows: number
  /** Windows in which the held digit appeared at least once. */
  windowsHit: number
  /** Expected windows with a hit if digits were random (Σ 1 − 0.9^k). */
  expectedHit: number
  /** Ticks settled inside the windows and how many matched the held digit. */
  ticks: number
  tickHits: number
  avgTicks: number
  tickRate: number
  z: number
  significance: number
}

/**
 * Walk-forward test of holding one Matches digit for a fixed time window.
 * Each window locks the pick decided before its first tick, then settles every
 * tick whose epoch falls within `windowSec` of that first tick. Windows do not overlap.
 */
export function matchesWindowBacktest(
  digits: number[],
  times: number[],
  picks: ArrayLike<number>,
  windowSec: number,
): WindowBacktest {
  const n = Math.min(digits.length, times.length, picks.length)
  let windows = 0
  let windowsHit = 0
  let expectedHit = 0
  let ticks = 0
  let tickHits = 0
  let t = 0
  while (t < n && picks[t] < 0) t++
  while (t < n) {
    const end = times[t] + windowSec
    let j = t
    while (j < n && times[j] < end) j++
    if (j >= n) break // window still open
    const pick = picks[t]
    let hits = 0
    for (let i = t; i < j; i++) if (digits[i] === pick) hits++
    const k = j - t
    windows++
    ticks += k
    tickHits += hits
    if (hits > 0) windowsHit++
    expectedHit += 1 - Math.pow(0.9, k)
    t = j
  }
  const z = proportionZ(tickHits, ticks, 0.1)
  return {
    windowSec,
    windows,
    windowsHit,
    expectedHit,
    ticks,
    tickHits,
    avgTicks: windows ? ticks / windows : 0,
    tickRate: ticks ? tickHits / ticks : 0,
    z,
    significance: z > 0 ? zConfidence(z) : 0,
  }
}
