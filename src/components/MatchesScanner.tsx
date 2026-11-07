
import { useMemo, useState } from "react";
import {
  MATCHES_MARKETS,
  scanMatches,
  type MatchesMarket,
  type MatchTick,
} from "@/lib/matches-scanner";

type Props = {
  // Supply the selected market's existing Deriv tick history.
  getMarketTicks: (market: MatchesMarket) => MatchTick[];
};

export default function MatchesScanner({ getMarketTicks }: Props) {
  const [market, setMarket] = useState<MatchesMarket>("R_50");

  const quotes = getMarketTicks(market);

  const result = useMemo(
    () => scanMatches(quotes, market),
    [quotes, market],
  );

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
          Select synthetic market
        </label>

        <select
          className="w-full rounded-lg border bg-transparent p-3"
          value={market}
          onChange={(event) =>
            setMarket(event.target.value as MatchesMarket)
          }
        >
          {MATCHES_MARKETS.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-xl border p-4">
        <p className="text-sm text-gray-500">
          Selected market: {market}
        </p>

        <p className="mt-2 text-sm">
          Tick memory: {result.ticksUsed}/5000
        </p>

        <div className="my-4">
          <p className="text-sm text-gray-500">
            Predicted digit
          </p>

          <div className="text-5xl font-bold">
            {result.predictedDigit ?? "--"}
          </div>
        </div>

        <div className="text-sm">
          Estimated probability:{" "}
          {(result.estimatedProbability * 100).toFixed(2)}%
        </div>

        <div className="text-sm">
          Validation accuracy:{" "}
          {result.validationAccuracy === null
            ? "N/A"
            : `${(result.validationAccuracy * 100).toFixed(2)}%`}
        </div>

        <div className="mt-3 rounded-lg border p-3">
          <strong>Status: {result.status}</strong>
          <p className="mt-1 text-sm">{result.message}</p>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-semibold">
          Digit ranking
        </h3>

        {result.digits.length === 0 ? (
          <p className="text-sm text-gray-500">
            Collecting 5,000 ticks before analysis.
          </p>
        ) : (
          <div className="space-y-3">
            {result.digits.map((item, index) => (
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

                <p className="mt-2 text-xs text-gray-500">
                  Validation selections: {item.validationSelections}
                  {" · "}
                  Hits: {item.validationHits}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-500">
        Statistical estimates only. A high ranking is not a
        guarantee of the next digit. CHECK means the configured
        historical validation rules passed, not that a trade
        is guaranteed to win.
      </p>
    </main>
  );
}
