# Neural Trading Engine

A live analytical engine for synthetic volatility indices. It streams ticks in real time, keeps the last 5,000 ticks per market, and continuously scores the last-digit distribution and contract opportunities.

## What's in it
- **Probability engine (neural digit skew):** distribution of digits 0–9 over the last 5,000 ticks, per-digit z-scores, a χ² goodness-of-fit test, a skew index, and the hot and cold digits. Recomputed on every tick, with analysis time shown in microseconds.
- **Pattern recognition:** a first-order digit transition map, parity streaks and repeat rate.
- **Confidence scoring:** signals for Matches, Differs, Even/Odd, Over/Under (any barrier) and Rise/Fall. Each signal has a 0–100 statistical confidence score, a configurable 87–98 high-confidence band, and a walk-forward backtest over the window.
- **AI accuracy advantage estimator:** takes daily contracts, stake per contract and payout. It gives high-confidence accuracy (lower bound of the 95% Wilson interval), break-even, accuracy advantage, EV, expected daily P&L range and the chance of a losing day.
- **AI digit scanner:** ranks every market you choose by its strongest signal, re-scanned each second, plus a feed-latency monitor.

Confidence scores measure statistical significance, not win probability. The backtest columns show how the signals actually performed.

## Tech
TanStack Start (React 19), Tailwind CSS v4, TypeScript, and the public Deriv WebSocket API for ticks. It is deployed on Netlify.

## Run locally
```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # engine unit tests
```

## Roadmap
See [PLAN.md](./PLAN.md). Next up is a low-latency Node.js ingestion worker on a VPS near the broker endpoint. After that come persistent tick history, trained ML models, an AI analyst, accounts and alerts.
