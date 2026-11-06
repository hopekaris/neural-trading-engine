/**
 * Volatility index catalogue streamed by the engine.
 * `pip` is a fallback only — the live feed reports the real pip size.
 */
export interface Market {
  symbol: string
  name: string
  short: string
  pip: number
  /** Seconds between ticks on the venue. */
  cadence: number
}

export const MARKETS: Market[] = [
  {
    symbol: 'R_10',
    name: 'Volatility 10 Index',
    short: 'V10',
    pip: 3,
    cadence: 2,
  },
  {
    symbol: 'R_25',
    name: 'Volatility 25 Index',
    short: 'V25',
    pip: 3,
    cadence: 2,
  },
  {
    symbol: 'R_50',
    name: 'Volatility 50 Index',
    short: 'V50',
    pip: 4,
    cadence: 2,
  },
  {
    symbol: 'R_75',
    name: 'Volatility 75 Index',
    short: 'V75',
    pip: 4,
    cadence: 2,
  },
  {
    symbol: 'R_100',
    name: 'Volatility 100 Index',
    short: 'V100',
    pip: 2,
    cadence: 2,
  },
  {
    symbol: '1HZ10V',
    name: 'Volatility 10 (1s) Index',
    short: 'V10·1s',
    pip: 2,
    cadence: 1,
  },
  {
    symbol: '1HZ25V',
    name: 'Volatility 25 (1s) Index',
    short: 'V25·1s',
    pip: 2,
    cadence: 1,
  },
  {
    symbol: '1HZ50V',
    name: 'Volatility 50 (1s) Index',
    short: 'V50·1s',
    pip: 2,
    cadence: 1,
  },
  {
    symbol: '1HZ75V',
    name: 'Volatility 75 (1s) Index',
    short: 'V75·1s',
    pip: 2,
    cadence: 1,
  },
  {
    symbol: '1HZ100V',
    name: 'Volatility 100 (1s) Index',
    short: 'V100·1s',
    pip: 2,
    cadence: 1,
  },
]

export const MARKET_BY_SYMBOL: Record<string, Market> = Object.fromEntries(
  MARKETS.map((m) => [m.symbol, m]),
)

export const DEFAULT_SELECTED = ['R_10', 'R_50', 'R_100', '1HZ10V', '1HZ100V']

/** Rolling window the probability engine analyses. */
export const WINDOW = 5000

/**
 * Public Deriv WebSocket endpoints, tried in order. The first is Deriv's
 * current public market-data channel (no auth). The legacy v3 endpoint is kept
 * as a fallback only, because it now rejects handshakes.
 */
export const FEED_URLS = [
  'wss://api.derivws.com/trading/v1/options/ws/public',
  'wss://ws.derivws.com/websockets/v3?app_id=1089',
]

/** The venue returns at most this many ticks per `ticks_history` request. */
export const HISTORY_PAGE = 1000

/** How long a Matches prediction digit is held before a new one is issued (seconds). */
export const PREDICTION_WINDOW_SEC = 30
