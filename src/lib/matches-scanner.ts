export const MATCHES_MARKETS = [
  "R_10",
  "R_25",
  "R_50",
  "R_75",
  "R_100",
  "1HZ10V",
  "1HZ25V",
  "1HZ50V",
  "1HZ75V",
  "1HZ100V",
] as const;

export type MatchesMarket = (typeof MATCHES_MARKETS)[number];

export const TICK_MEMORY = 5000;
const VALIDATION_TICKS = 1000;
const RANDOM_BASELINE = 0.10;
const MIN_VALIDATION_SELECTIONS = 30;

export type MatchTick = {
  quote: string | number;
  pip_size?: number;
};

export type DigitResult = {
  digit: number;
  probability: number;
  validationSelections: number;
  validationHits: number;
  validationHitRate: number | null;
  lowerBound: number | null;
};

export type MatchesResult = {
  market: MatchesMarket;
  status: "CHECK" | "WAIT" | "COLLECTING";
  predictedDigit: number | null;
  estimatedProbability: number;
  validationAccuracy: number | null;
  validationSamples: number;
  digits: DigitResult[];
  ticksUsed: number;
  message: string;
};

/**
 * Deriv quotes should ideally be kept as strings so trailing decimal
 * places are preserved. pip_size helps restore precision for numbers.
 */
function getLastDigit(tick: MatchTick): number | null {
  let quote: string;

  if (typeof tick.quote === "number") {
    quote =
      Number.isInteger(tick.pip_size)
        ? tick.quote.toFixed(tick.pip_size)
        : String(tick.quote);
  } else {
    quote = tick.quote.trim();
  }

  const digits = quote.replace(/\D/g, "");
  if (!digits.length) return null;

  return Number(digits[digits.length - 1]);
}

function wilsonLowerBound(successes: number, total: number): number {
  if (total === 0) return 0;

  const z = 1.96;
  const p = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;

  const centre = p + z2 / (2 * total);
  const margin =
    z *
    Math.sqrt(
      (p * (1 - p)) / total + z2 / (4 * total * total),
    );

  return Math.max(0, (centre - margin) / denominator);
}

/**
 * Predicts the next digit from overall frequencies and recent
 * one-, two-, and three-digit contexts.
 */
function predictProbabilities(history: number[]): number[] {
  const scores = Array(10).fill(1) as number[];

  // Overall digit frequencies.
  for (const digit of history) {
    scores[digit] += 1;
  }

  // Recent sequence contexts.
  const contextLengths = [
    { length: 1, weight: 0.5 },
    { length: 2, weight: 1.0 },
    { length: 3, weight: 1.5 },
  ];

  for (const context of contextLengths) {
    if (history.length <= context.length) continue;

    const recentContext = history.slice(-context.length);
    const counts = Array(10).fill(0) as number[];

    for (let i = context.length; i < history.length; i++) {
      const previous = history.slice(i - context.length, i);

      const matches = previous.every(
        (value, index) => value === recentContext[index],
      );

      if (matches) counts[history[i]] += 1;
    }

    for (let digit = 0; digit <= 9; digit++) {
      scores[digit] += counts[digit] * context.weight;
    }
  }

  const total = scores.reduce((sum, value) => sum + value, 0);
  return scores.map((value) => value / total);
}

function rankDigits(probabilities: number[]): number[] {
  return probabilities
    .map((probability, digit) => ({ digit, probability }))
    .sort((a, b) => b.probability - a.probability)
    .map((item) => item.digit);
}

/**
 * Runs chronological walk-forward validation.
 * Each test prediction only sees ticks that came before it.
 */
function validateModel(digits: number[]) {
  const start = Math.max(1, digits.length - VALIDATION_TICKS);

  const selections = Array(10).fill(0) as number[];
  const hits = Array(10).fill(0) as number[];

  let correctTopPredictions = 0;
  let totalPredictions = 0;

  for (let i = start; i < digits.length; i++) {
    const trainingHistory = digits.slice(0, i);
    const actualDigit = digits[i];

    const probabilities = predictProbabilities(trainingHistory);
    const predictedDigit = rankDigits(probabilities)[0];

    selections[predictedDigit] += 1;
    totalPredictions += 1;

    if (predictedDigit === actualDigit) {
      hits[predictedDigit] += 1;
      correctTopPredictions += 1;
    }
  }

  return {
    selections,
    hits,
    totalPredictions,
    topAccuracy:
      totalPredictions > 0
        ? correctTopPredictions / totalPredictions
        : null,
    topAccuracyLowerBound:
      totalPredictions > 0
        ? wilsonLowerBound(correctTopPredictions, totalPredictions)
        : null,
  };
}

export function scanMatches(
  ticks: MatchTick[],
  market: MatchesMarket,
): MatchesResult {
  const usableTicks = ticks.slice(-TICK_MEMORY);
  const digits = usableTicks
    .map(getLastDigit)
    .filter((digit): digit is number => digit !== null);

  if (digits.length < TICK_MEMORY) {
    return {
      market,
      status: "COLLECTING",
      predictedDigit: null,
      estimatedProbability: 0,
      validationAccuracy: null,
      validationSamples: 0,
      digits: [],
      ticksUsed: digits.length,
      message: `Collecting ticks: ${digits.length}/${TICK_MEMORY}`,
    };
  }

  const validation = validateModel(digits);
  const probabilities = predictProbabilities(digits);
  const ranking = rankDigits(probabilities);

  const results: DigitResult[] = ranking.map((digit) => {
    const selections = validation.selections[digit];
    const hits = validation.hits[digit];

    return {
      digit,
      probability: probabilities[digit],
      validationSelections: selections,
      validationHits: hits,
      validationHitRate:
        selections > 0 ? hits / selections : null,
      lowerBound:
        selections > 0 ? wilsonLowerBound(hits, selections) : null,
    };
  });

  const best = results[0];

  const enoughEvidence =
    best.validationSelections >= MIN_VALIDATION_SELECTIONS;

  const validatedAboveBaseline =
    enoughEvidence &&
    best.lowerBound !== null &&
    best.lowerBound > RANDOM_BASELINE;

  const modelAboveBaseline =
    validation.topAccuracyLowerBound !== null &&
    validation.topAccuracyLowerBound > RANDOM_BASELINE;

  const status =
    validatedAboveBaseline && modelAboveBaseline
      ? "CHECK"
      : "WAIT";

  return {
    market,
    status,
    predictedDigit: best.digit,
    estimatedProbability: best.probability,
    validationAccuracy: validation.topAccuracy,
    validationSamples: validation.totalPredictions,
    digits: results,
    ticksUsed: digits.length,
    message:
      status === "CHECK"
        ? "The leading digit passed the validation rules. This is statistical evidence, not a guarantee."
        : "No digit has passed the high-confidence validation rules. Wait for more evidence.",
  };
}
