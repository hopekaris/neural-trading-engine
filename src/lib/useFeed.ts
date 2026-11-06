import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { analyze, type Analysis, type EngineConfig } from './engine'
import { getFeed, type SeriesState } from './feed'

const noop = () => () => {}

/** Subscribes a component to the live feed; returns null during SSR. */
export function useFeed() {
  const [client, setClient] = useState(false)
  useEffect(() => {
    getFeed().start()
    setClient(true)
  }, [])
  const feed = client ? getFeed() : null
  const version = useSyncExternalStore(
    feed ? feed.subscribe : noop,
    feed ? feed.getVersion : () => 0,
    () => 0,
  )
  return { feed, version }
}

/** Runs the analytical engine on a series, recomputing on every new tick. */
export function useAnalysis(
  series: SeriesState | undefined,
  cfg: EngineConfig,
): Analysis | null {
  const len = series?.prices.length ?? 0
  const last = series?.times[len - 1] ?? 0
  return useMemo(() => {
    if (!series || len < 60) return null
    return analyze(series.digits, series.prices, cfg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    series,
    len,
    last,
    series?.liveTicks,
    cfg.lookback,
    cfg.barrier,
    cfg.threshold,
  ])
}
