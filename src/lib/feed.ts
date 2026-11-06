/**
 * Live tick ingestion. Streams the public Deriv WebSocket feed straight into
 * the browser, keeps a rolling 5000-tick window per market, and measures
 * round-trip latency. Falls back to a clearly labelled simulated feed when the
 * venue cannot be reached.
 *
 * A later milestone moves this ingestion to a server-side worker close to the
 * broker endpoint; the store interface below is what the UI depends on.
 */
import { lastDigit } from './engine'
import {
  DEFAULT_SELECTED,
  FEED_URLS,
  HISTORY_PAGE,
  MARKET_BY_SYMBOL,
  WINDOW,
} from './markets'

export type FeedMode =
  'idle' | 'connecting' | 'live' | 'reconnecting' | 'simulated'

export interface SeriesState {
  symbol: string
  pip: number
  prices: number[]
  times: number[]
  digits: number[]
  /** performance.now() of the last received tick. */
  receivedAt: number
  liveTicks: number
  loaded: boolean
  /** True while older pages are still being fetched to fill the window. */
  backfilling: boolean
  error?: string
}

export interface FeedSnapshot {
  mode: FeedMode
  rtt: number | null
  rttAvg: number | null
  rttHistory: number[]
  ticksPerMin: number
  messages: number
  selected: string[]
  focus: string
}

type Listener = () => void

const STORAGE_KEY = 'nte:markets'

class FeedStore {
  private ws: WebSocket | null = null
  private listeners = new Set<Listener>()
  private version = 0
  private scheduled = false
  private reqId = 1
  private pingSent = new Map<number, number>()
  private subs = new Map<string, string>()
  private pingTimer: ReturnType<typeof setInterval> | undefined
  private simTimer: ReturnType<typeof setInterval> | undefined
  private failures = 0
  private tickStamps: number[] = []
  private started = false
  private urlIndex = 0

  series = new Map<string, SeriesState>()
  snap: FeedSnapshot = {
    mode: 'idle',
    rtt: null,
    rttAvg: null,
    rttHistory: [],
    ticksPerMin: 0,
    messages: 0,
    selected: DEFAULT_SELECTED,
    focus: DEFAULT_SELECTED[0],
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getVersion = () => this.version

  private emit() {
    if (this.scheduled) return
    this.scheduled = true
    const flush = () => {
      this.scheduled = false
      this.version++
      this.snap = { ...this.snap }
      this.listeners.forEach((l) => l())
    }
    // rAF is paused in background tabs; fall back to a timer there.
    if (typeof document !== 'undefined' && document.hidden) setTimeout(flush, 250)
    else requestAnimationFrame(flush)
  }

  start() {
    if (this.started) return
    this.started = true
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as {
        selected?: string[]
        focus?: string
      } | null
      const selected = saved?.selected?.filter((s) => MARKET_BY_SYMBOL[s])
      if (selected?.length) this.snap.selected = selected
      if (saved?.focus && MARKET_BY_SYMBOL[saved.focus])
        this.snap.focus = saved.focus
      if (!this.snap.selected.includes(this.snap.focus))
        this.snap.focus = this.snap.selected[0]
    } catch {
      /* ignore corrupted preferences */
    }
    setInterval(() => this.updateRate(), 2000)
    this.connect()
  }

  private persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          selected: this.snap.selected,
          focus: this.snap.focus,
        }),
      )
    } catch {
      /* storage may be unavailable */
    }
  }

  // ---------- market selection ----------

  toggleMarket(symbol: string) {
    const has = this.snap.selected.includes(symbol)
    if (has && this.snap.selected.length === 1) return
    const selected = has
      ? this.snap.selected.filter((s) => s !== symbol)
      : [...this.snap.selected, symbol]
    this.snap.selected = selected
    if (!selected.includes(this.snap.focus)) this.snap.focus = selected[0]
    if (has) this.unwatch(symbol)
    else this.watch(symbol)
    this.persist()
    this.emit()
  }

  setFocus(symbol: string) {
    if (!this.snap.selected.includes(symbol)) this.toggleMarket(symbol)
    this.snap.focus = symbol
    this.persist()
    this.emit()
  }

  // ---------- live connection ----------

  private connect() {
    this.stopSim()
    this.snap.mode = this.failures ? 'reconnecting' : 'connecting'
    this.emit()
    let opened = false
    const url = FEED_URLS[this.urlIndex % FEED_URLS.length]
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      this.failures++
      this.urlIndex++
      setTimeout(() => this.connect(), 1000)
      return
    }
    this.ws = ws
    const openTimeout = setTimeout(() => {
      if (!opened) ws.close()
    }, 8000)

    ws.onopen = () => {
      opened = true
      clearTimeout(openTimeout)
      this.failures = 0
      this.snap.mode = 'live'
      this.subs.clear()
      for (const s of this.snap.selected) this.watch(s)
      this.ping()
      this.pingTimer = setInterval(() => this.ping(), 5000)
      this.emit()
    }
    ws.onmessage = (ev) => this.onMessage(ev.data as string)
    ws.onclose = () => {
      clearTimeout(openTimeout)
      clearInterval(this.pingTimer)
      if (this.ws !== ws) return
      this.ws = null
      this.failures++
      // A dead handshake: try the next endpoint. A live socket that dropped
      // reconnects to the same endpoint.
      if (!opened) this.urlIndex++
      if (this.failures >= 2 * FEED_URLS.length + 1) {
        this.startSim()
        setTimeout(
          () => this.snap.mode === 'simulated' && this.connect(),
          60_000,
        )
      } else {
        this.snap.mode = 'reconnecting'
        this.emit()
        setTimeout(
          () => this.connect(),
          opened ? 1000 : Math.min(1000 * this.failures, 5000),
        )
      }
    }
  }

  retryLive() {
    this.failures = 0
    if (this.ws) this.ws.close()
    else this.connect()
  }

  private send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const id = this.reqId++
      this.ws.send(JSON.stringify({ ...payload, req_id: id }))
      return id
    }
    return null
  }

  private ping() {
    const id = this.send({ ping: 1 })
    if (id) this.pingSent.set(id, performance.now())
  }

  private watch(symbol: string) {
    if (this.snap.mode === 'simulated') {
      this.seedSim(symbol)
      return
    }
    if (!this.series.has(symbol)) {
      this.series.set(symbol, blankSeries(symbol))
    }
    this.send({
      ticks_history: symbol,
      adjust_start_time: 1,
      count: WINDOW,
      end: 'latest',
      style: 'ticks',
      subscribe: 1,
    })
  }

  private unwatch(symbol: string) {
    const id = this.subs.get(symbol)
    if (id) this.send({ forget: id })
    this.subs.delete(symbol)
  }

  private onMessage(raw: string) {
    let msg: any
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    this.snap.messages++
    if (msg.msg_type === 'ping') {
      const sent = this.pingSent.get(msg.req_id)
      if (sent !== undefined) {
        this.pingSent.delete(msg.req_id)
        const rtt = performance.now() - sent
        const hist = [...this.snap.rttHistory, rtt].slice(-60)
        this.snap.rtt = rtt
        this.snap.rttHistory = hist
        this.snap.rttAvg = hist.reduce((a, b) => a + b, 0) / hist.length
        this.emit()
      }
      return
    }
    if (msg.error) {
      const sym = msg.echo_req?.ticks_history
      if (sym) {
        const s = this.series.get(sym) ?? blankSeries(sym)
        // A failed backfill page keeps the ticks already loaded.
        if (!s.loaded) s.error = msg.error.message
        s.backfilling = false
        this.series.set(sym, s)
        this.emit()
      }
      return
    }
    if (msg.msg_type === 'history') {
      const sym: string = msg.echo_req.ticks_history
      if (!this.snap.selected.includes(sym)) {
        if (msg.subscription?.id) this.send({ forget: msg.subscription.id })
        return
      }
      const prices: number[] = (msg.history?.prices ?? []).map(Number)
      const times: number[] = (msg.history?.times ?? []).map(Number)
      // Older page requested to fill the 5000-tick window.
      if (!msg.echo_req.subscribe) {
        this.onBackfill(sym, prices, times, Number(msg.echo_req.count))
        return
      }
      if (msg.subscription?.id) this.subs.set(sym, msg.subscription.id)
      const pip = Number(msg.pip_size ?? MARKET_BY_SYMBOL[sym]?.pip ?? 2)
      const s: SeriesState = {
        symbol: sym,
        pip,
        prices,
        times,
        digits: prices.map((p) => lastDigit(p, pip)),
        receivedAt: performance.now(),
        liveTicks: 0,
        loaded: true,
        backfilling: false,
      }
      this.series.set(sym, s)
      this.requestOlder(s)
      this.emit()
      return
    }
    if (msg.msg_type === 'tick' && msg.tick) {
      const { symbol, quote, epoch, pip_size } = msg.tick
      const s = this.series.get(symbol)
      if (!s || !this.snap.selected.includes(symbol)) return
      if (pip_size !== undefined) s.pip = Number(pip_size)
      this.push(s, Number(quote), Number(epoch))
    }
  }

  /** Asks for the page of ticks just before the oldest one held. */
  private requestOlder(s: SeriesState) {
    const need = WINDOW - s.prices.length
    if (need <= 0 || !s.times.length) {
      s.backfilling = false
      return
    }
    s.backfilling = true
    this.send({
      ticks_history: s.symbol,
      count: Math.min(HISTORY_PAGE, need),
      end: s.times[0] - 1,
      style: 'ticks',
    })
  }

  private onBackfill(
    sym: string,
    prices: number[],
    times: number[],
    asked: number,
  ) {
    const s = this.series.get(sym)
    if (!s) return
    const oldest = s.times[0] ?? Infinity
    // Keep only ticks strictly older than what we already hold.
    const keep = times.findIndex((t) => t >= oldest)
    const n = keep === -1 ? times.length : keep
    if (n > 0) {
      const room = WINDOW - s.prices.length
      const from = Math.max(0, n - room)
      const p = prices.slice(from, n)
      s.prices = [...p, ...s.prices]
      s.times = [...times.slice(from, n), ...s.times]
      s.digits = [...p.map((x) => lastDigit(x, s.pip)), ...s.digits]
    }
    // Stop when the venue has nothing older or the window is full.
    if (n === 0 || times.length < asked) s.backfilling = false
    else this.requestOlder(s)
    this.emit()
  }

  private push(s: SeriesState, price: number, epoch: number) {
    s.prices.push(price)
    s.times.push(epoch)
    s.digits.push(lastDigit(price, s.pip))
    if (s.prices.length > WINDOW) {
      s.prices.shift()
      s.times.shift()
      s.digits.shift()
    }
    s.receivedAt = performance.now()
    s.liveTicks++
    this.tickStamps.push(Date.now())
    this.emit()
  }

  private updateRate() {
    const cutoff = Date.now() - 60_000
    while (this.tickStamps.length && this.tickStamps[0] < cutoff)
      this.tickStamps.shift()
    this.snap.ticksPerMin = this.tickStamps.length
    this.emit()
  }

  // ---------- simulated fallback ----------

  private seedSim(symbol: string) {
    const m = MARKET_BY_SYMBOL[symbol]
    const pip = m?.pip ?? 2
    const prices: number[] = []
    const times: number[] = []
    let p = 1000 + Math.random() * 9000
    const now = Math.floor(Date.now() / 1000)
    for (let i = 0; i < WINDOW; i++) {
      p = step(p, pip)
      prices.push(p)
      times.push(now - (WINDOW - i) * (m?.cadence ?? 1))
    }
    this.series.set(symbol, {
      symbol,
      pip,
      prices,
      times,
      digits: prices.map((x) => lastDigit(x, pip)),
      receivedAt: performance.now(),
      liveTicks: 0,
      loaded: true,
      backfilling: false,
    })
  }

  private startSim() {
    this.snap.mode = 'simulated'
    this.snap.rtt = null
    // Never mix simulated ticks into a real series.
    for (const s of this.snap.selected) this.seedSim(s)
    let n = 0
    this.simTimer = setInterval(() => {
      n++
      for (const sym of this.snap.selected) {
        const s = this.series.get(sym)
        const cadence = MARKET_BY_SYMBOL[sym]?.cadence ?? 1
        if (s && n % cadence === 0) {
          this.push(
            s,
            step(s.prices[s.prices.length - 1], s.pip),
            Math.floor(Date.now() / 1000),
          )
        }
      }
    }, 1000)
    this.emit()
  }

  private stopSim() {
    clearInterval(this.simTimer)
  }
}

function blankSeries(symbol: string): SeriesState {
  return {
    symbol,
    pip: MARKET_BY_SYMBOL[symbol]?.pip ?? 2,
    prices: [],
    times: [],
    digits: [],
    receivedAt: 0,
    liveTicks: 0,
    loaded: false,
    backfilling: false,
  }
}

function step(p: number, pip: number) {
  const g =
    Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) *
    Math.cos(2 * Math.PI * Math.random())
  const next = p * (1 + g * 0.0004)
  return Math.round(next * 10 ** pip) / 10 ** pip
}

let store: FeedStore | null = null

export function getFeed(): FeedStore {
  if (!store) store = new FeedStore()
  return store
}

export type { FeedStore }
