# AGENTS.md — Neural Trading Engine

Continue from **PLAN.md**. Milestone 1 (the live UI) is done. Milestone 2, the server-side ingestion worker, is next.

## Architecture
- `src/lib/markets.ts`: the volatility index catalogue, the 5,000-tick `WINDOW`, the feed endpoints (`FEED_URLS`, the new `api.derivws.com` public channel first) and `HISTORY_PAGE` (the venue caps history at 1,000 ticks per request, so the store pages backwards to fill the window).
- `src/lib/engine.ts`: **pure** analysis functions (digit stats, χ², transition map, contract signals with walk-forward backtest, accuracy estimator). They have no DOM or network access, so the future server worker can import them unchanged. They are unit-tested in `engine.test.ts`.
- `src/lib/feed.ts`: the client-only singleton `FeedStore`. It holds the WebSocket to Deriv (`ticks_history` + `subscribe`), the rolling series per symbol, ping RTT, ticks/min, market selection and focus (persisted to localStorage), and a simulated fallback after 3 failed connects. Updates are batched with requestAnimationFrame and exposed via `subscribe`/`getVersion`.
- `src/lib/useFeed.ts`: `useFeed()` (useSyncExternalStore; starts the feed in an effect, null during SSR) and `useAnalysis()`.
- `src/components/AppShell.tsx`: header, nav, feed status, market chips and the disclaimer footer. It is mounted as the root route `component`.
- Routes: `/` is the Engine screen (`routes/index.tsx`), `/matches` is the Matches predictor (`routes/matches.tsx`, driven by the pure `matchesPredict` in engine.ts) and `/scanner` is the Digit scanner (`routes/scanner.tsx`).
- `src/components/ui.tsx`: shared Panel, Stat, Meter, Skeleton and the formatters.

## Conventions and decisions
- The dark theme tokens (`ink`, `panel`, `line`, `pulse`, `heat`, `cold`, `volt`) are defined in `src/styles.css` `@theme`. The fonts are Space Grotesk and JetBrains Mono.
- Charts are hand-built with divs and SVG (the template's chart.js dependency is unused and can be removed).
- Browser APIs only run in effects or the feed store, never during SSR render.
- Last digit = `round(price × 10^pip) mod 10`. Always use the pip size reported by the feed so trailing zeros count.
- Confidence = two-sided significance of the recommended side's hit-rate against its fair odds (Bonferroni ×10 for Matches/Differs). Keep it labelled as significance, not win probability. Never present projected accuracy without the backtest sample size.
- Payouts are approximated as fair odds minus a 2.3% margin (`payoutFor`). The estimator lets users override them.
- When milestone 2 lands, swap only the transport inside `FeedStore` so the UI contract stays the same.
