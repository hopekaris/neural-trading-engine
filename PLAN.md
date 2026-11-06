# Neural Trading Engine — Roadmap

The engine is built in small, self-contained milestones. Each one ships something usable on its own.

## 1. Live engine surface ✅ (done)
- Engine screen: live price and digit tape, a 5,000-tick digit-skew probability engine (distribution, z-scores, χ², skew index), a digit transition map, contract signals for Matches, Differs, Even/Odd, Over/Under and Rise/Fall with confidence scoring and walk-forward backtests, and the accuracy advantage estimator.
- Digit scanner screen: every chosen market re-analysed each second and ranked by its strongest signal, plus a feed-latency monitor.
- Live ticks are streamed from the public Deriv WebSocket straight into the browser, with a clearly labelled simulated fallback.

## 2. Low-latency server ingestion worker
- A lightweight Node.js worker (`ingest/`) that holds a persistent WebSocket to the broker, keeps the 5,000-tick window per market in memory, and runs the `src/lib/engine.ts` analysis server-side.
- Deploy it to a small VPS (AWS Lightsail / DigitalOcean / Linode). First measure ping RTT to the broker endpoint from 3–4 candidate regions and pick the lowest (Europe is usually a good first candidate).
- Run it under systemd or pm2 with auto-restart, heartbeat pings and reconnect-with-backoff.
- Expose a WebSocket/SSE stream of `{ symbol, tick, analysis }` frames. The browser subscribes to that stream instead of the broker, so the feed store in `src/lib/feed.ts` only needs its transport swapped.
- The UI shows broker→worker latency and worker→browser latency separately.

## 3. Persistent tick and signal history
- Netlify Database (Postgres + Drizzle): `ticks`, `signals` and `signal_outcomes` tables written by the worker.
- Backtests run over days of history instead of the in-memory window. The scanner shows rolling 24h / 7d accuracy per signal.

## 4. ML pattern-recognition models
- Train lightweight models (logistic regression / gradient-boosted trees on digit n-grams, parity runs and transition features) offline on the stored history, one per market and contract type.
- Score live ticks in the worker. Report calibrated probabilities and out-of-sample accuracy next to the statistical confidence score. Retire models whose live accuracy falls below break-even.

## 5. AI analyst
- Netlify AI Gateway explains the current scanner board in plain language: which markets show significant skew, how reliable the evidence is, and suggested stake sizing from the estimator.

## 6. Accounts and alerts
- Netlify Identity sign-in, saved market sets, estimator presets and threshold preferences.
- Push or email alerts when a market enters the high-confidence band and its backtested edge is positive.

## 7. Trade execution (optional, behind explicit opt-in)
- Connect a broker API token server-side, then add paper trading first and live order placement with hard daily loss limits.
