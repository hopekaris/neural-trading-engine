import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  MATCHES_MARKETS,
  scanMatches,
  type MatchesMarket,
  type MatchTick,
} from "@/lib/matches-scanner";
import { getFeed } from "@/lib/feed";

export default function MatchesScanner() {
  const feed = getFeed();

  const [market, setMarket] = useState<MatchesMarket>("R_50");

  // Subscribe to updates from your existing live feed.
  const feedVersion = useSyncExternalStore(
    feed.subscribe,
    feed.getVersion,
    () => 0,
  );

  // Start the existing Deriv feed; do not create another connection.
  useEffect(() => {
    feed.start();
    feed.setFocus(market);
  }, [feed]);

  // Switch the existing feed to the manually selected market.
  function changeMarket(value: string) {
    const selected = value as MatchesMarket;
    setMarket(selected);
    feed.setFocus(selected);
  }

  // Read the selected market's own 5,000-tick history.
  const quotes = useMemo<MatchTick[]>(() => {
    const series = feed.series.get(market);

    if (!series) return [];

    return series.prices.map((price) => ({
      quote: price,
      pip_size: series.pip,
    }));
  }, [feed, feedVersion, market]);

  // Analyse the selected market.
  const result = useMemo(
    () => scanMatches(quotes, market),
    [quotes, market],
  );

  const simulated = feed.snap.mode === "simulated";

  return (
    <main className="w-full space-y-5 rounded-xl border p-4">
      <header>
        <h2 className="text-xl font-bold">
          Matches Prediction Scanner
        </h2>
        <p className="text-sm text-gray-500">
          Manual market selection · 5,000 tick memory
        </p>
      </header>

      <section className="space-y-2">
        <label className="block text-sm font-semibold">
          Select market
        </label>

        <select
          className="w-full rounded-lg border bg-transparent p-3"
          value={market}
          onChange={(event) => changeMarket(event.target.value)}
        >
          {MATCHES_MARKETS.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">
            Feed connection
          </span>
          <strong>{feed.snap.mode.toUpperCase()}</strong>
        </div>

        {simulated && (
          <p className="rounded-lg border border-yellow-500 p-3 text-sm">
            SIMULATED DATA: These are generated ticks, not live
            Deriv market data. Do not use these predictions for trading.
          </p>
        )}

        <div className="flex justify-between text-sm">
          <span>Selected market</span>
          <strong>{market}</strong>
        </div>

        <div className="flex justify-between text-sm">
          <span>Tick history</span>
          <strong>{result.ticksUsed}/5000</strong>
        </div>

        <div className="pt-3">
          <p className="text-sm text-gray-500">
            Predicted digit
          </p>

          <div className="text-6xl font-bold">
            {result.predictedDigit ?? "--"}
          </div>
        </div>

        <div className="flex justify-between text-sm">
          <span>Estimated probability</span>
          <strong>
            {(result.estimatedProbability * 100).toFixed(2)}%
          </strong>
        </div>

        <div className="flex justify-between text-sm">
          <span>Validation accuracy</span>
          <strong>
            {result.validationAccuracy === null
              ? "N/A"
              : `${(result.validationAccuracy * 100).toFixed(2)}%`}
          </strong>
        </div>

        <div className="rounded-lg border p-3">
          <strong>
            {simulated ? "SIMULATED" : result.status}
          </strong>
          <p className="mt-1 text-sm">
            {result.message}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Digit ranking</h3>

        {result.digits.length === 0 ? (
          <p className="text-sm text-gray-500">
            {result.message}
          </p>
        ) : (
          result.digits.map((item, index) => (
            <div
              key={item.digit}
              className="rounded-lg border p-3"
            >
              <div className="flex justify-between text-sm">
                <strong>
                  #{index + 1} — Digit {item.digit}
                </strong>
                <strong>
                  {(item.probability * 100).toFixed(2)}%
                </strong>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded bg-gray-200">
                <div
                  className="h-full rounded bg-blue-600"
                  style={{
                    width: `${Math.min(
                      100,
                      item.probability * 100,
                    )}%`,
                  }}
                />
              </div>

              <p className="mt-2 text-xs text-gray-500">
                Validation selections: {item.validationSelections}
                {" · "}
                Hits: {item.validationHits}
              </p>
            </div>
          ))
        )}
      </section>

      <p className="text-xs text-gray-500">
        Statistical estimates only. A CHECK is not a guarantee
        of the next digit or a profitable trade.
      </p>
    </main>
  );
      }
