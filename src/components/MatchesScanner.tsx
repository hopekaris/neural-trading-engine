
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { getFeed } from "../lib/feed";
import { MARKETS } from "../lib/markets";
import { scanMatches } from "../lib/matches-scanner";

export default function MatchesScanner() {
  const feed = getFeed();

  const [market, setMarket] = useState("R_50");

  // Subscribe to the existing Deriv feed.
  const version = useSyncExternalStore(
    feed.subscribe,
    feed.getVersion,
    () => 0,
  );

  // Start the existing feed and focus the default market.
  useEffect(() => {
    feed.start();
    feed.setFocus("R_50");
  }, [feed]);

  // Manually select another market.
  function changeMarket(symbol: string) {
    setMarket(symbol);
    feed.setFocus(symbol);
  }

  // Read the selected market's own digit history.
  const digits = useMemo(() => {
    const series = feed.series.get(market);

    if (!series) return [];

    return series.digits.slice(-5000);
  }, [feed, version, market]);

  // Run the Matches analysis.
  const result = useMemo(
    () => scanMatches(digits, market),
    [digits, market],
  );

  const isSimulated = feed.snap.mode === "simulated";

  return (
    <main className="w-full space-y-5 rounded-xl border p-4">

      <header>
        <h2 className="text-xl font-bold">
          Neural Matches Scanner
        </h2>

        <p className="text-sm text-gray-500">
          Manual market selection · 5,000 tick analysis
        </p>
      </header>

      {/* MARKET SELECTOR */}
      <section className="space-y-2">
        <label className="text-sm font-semibold">
          Select market
        </label>

        <select
          value={market}
          onChange={(event) =>
            changeMarket(event.target.value)
          }
          className="w-full rounded-lg border bg-transparent p-3"
        >
          {MARKETS.map((item) => (
            <option
              key={item.symbol}
              value={item.symbol}
            >
              {item.name} ({item.symbol})
            </option>
          ))}
        </select>
      </section>

      {/* FEED STATUS */}
      <section className="rounded-lg border p-3 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">
            Feed status
          </span>

          <strong>{feed.snap.mode.toUpperCase()}</strong>
        </div>

        {isSimulated && (
          <p className="rounded-lg border border-yellow-500 p-3 text-sm">
            SIMULATED FEED: These are generated test ticks,
            not live Deriv market data. Do not use them
            for trading decisions.
          </p>
        )}

        <div className="flex justify-between text-sm">
          <span>Selected market</span>
          <strong>{market}</strong>
        </div>

        <div className="flex justify-between text-sm">
          <span>Tick memory</span>
          <strong>{result.ticksUsed}/5000</strong>
        </div>

        <div className="flex justify-between text-sm">
          <span>Validation sample</span>
          <strong>{result.validationSamples}</strong>
        </div>
      </section>

      {/* PREDICTION */}
      <section className="rounded-xl border p-4 space-y-3">
        <p className="text-sm text-gray-500">
          Highest-ranked predicted digit
        </p>

        <div className="text-6xl font-bold">
          {result.predictedDigit ?? "--"}
        </div>

        <div className="flex justify-between text-sm">
          <span>Estimated probability</span>
          <strong>
            {(result.estimatedProbability * 100).toFixed(2)}%
          </strong>
        </div>

        <div className="flex justify-between text-sm">
          <span>Historical validation accuracy</span>
          <strong>
            {result.validationAccuracy === null
              ? "N/A"
              : `${(
                  result.validationAccuracy * 100
                ).toFixed(2)}%`}
          </strong>
        </div>

        <div className="rounded-lg border p-3">
          <strong>
            {isSimulated ? "SIMULATED" : result.status}
          </strong>

          <p className="mt-1 text-sm">
            {result.message}
          </p>
        </div>
      </section>

      {/* DIGIT RANKING */}
      <section className="space-y-3">
        <h3 className="font-semibold">
          All digit predictions
        </h3>

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
              <div className="flex justify-between">
                <strong>
                  #{index + 1} Digit {item.digit}
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

              <div className="mt-2 text-xs text-gray-500">
                Validation selections:{" "}
                {item.validationSelections}
                {" · "}
                Hits: {item.validationHits}
              </div>

              <div className="text-xs text-gray-500">
                Validation hit rate:{" "}
                {item.validationHitRate === null
                  ? "N/A"
                  : `${(
                      item.validationHitRate * 100
                    ).toFixed(2)}%`}
              </div>
            </div>
          ))
        )}
      </section>

      <footer className="text-xs text-gray-500">
        Analysis only. CHECK means historical statistical
        tests passed; it does not guarantee the next digit.
        No trades are placed by this scanner.
      </footer>

    </main>
  );
}
