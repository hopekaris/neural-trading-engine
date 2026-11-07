
import { WINDOW } from "./markets";

const VALIDATION_TICKS = 1000;
const RANDOM_BASELINE = 0.10;
const MIN_SELECTIONS = 30;

export type DigitResult = {
  digit: number;
  probability: number;
  validationSelections: number;
  validationHits: number;
  validationHitRate: number | null;
  lowerBound: number | null;
};

export type MatchesResult = {
  market: string;
  status: "CHECK" | "WAIT" | "COLLECTING";
  predictedDigit: number | null;
  estimatedProbability: number;
  validationAccuracy: number | null;
  validationSamples: number;
  digits: DigitResult[];
  ticksUsed: number;
  message: string;
};

function wilsonLowerBound(hits: number, total: number): number {
  if (total === 0) return 0;

  const z = 1.96;
  const p = hits / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;

  const centre = p + z2 / (2 * total);
  const margin =
    z *
    Math.sqrt(
      (p * (1 - p)) / total +
        z2 / (4 * total * total),
    );

  return Math.max(0, (centre - margin) / denominator);
}

function predictProbabilities(history: number[]): number[] {
  const scores = Array(10).fill(1) as number[];

  // Overall historical digit frequency.
  for (const digit of history) {
    scores[digit] += 1;
  }

  // Recent sequence context.
  const contexts = [
    { length: 1, weight: 0.5 },
    { length: 2, weight: 1 },
    { length: 3, weight: 1.5 },
  ];

  for (const context of contexts) {
    if (history.length <= context.length) continue;

    const recent = history.slice(-context.length);
    const counts = Array(10).fill(0) as number[];

    for (
      let i = context.length;
      i < history.length;
      i++
    ) {
      const matches = recent.every(
        (value, index) =>
          history[i - context.length + index] === value,
      );

      if (matches) {
        counts[history[i]]++;
      }
    }

    for (let digit = 0; digit < 10; digit++) {
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

function validateModel(digits: number[]) {
  const start = Math.max(1, digits.length - VALIDATION_TICKS);

  const selections = Array(10).fill(0) as number[];
  const hits = Array(10).fill(0) as number[];

  let correct = 0;
  let total = 0;

  for (let i = start; i < digits.length; i++) {
    // Only use ticks available before the prediction.
    const training = digits.slice(0, i);
    const actual = digits[i];

    const probabilities = predictProbabilities(training);
    const prediction = rankDigits(probabilities)[0];

    selections[prediction]++;
    total++;

    if (prediction === actual) {
      hits[prediction]++;
      correct++;
    }
  }

  return {
    selections,
    hits,
    total,
    accuracy: total ? correct / total : null,
    accuracyLowerBound: total
      ? wilsonLowerBound(correct, total)
      : null,
  };
}

export function scanMatches(
  inputDigits: readonly number[],
  market: string,
): MatchesResult {
  const digits = inputDigits
    .slice(-WINDOW)
    .map(Number)
    .filter(
      (digit) =>
        Number.isInteger(digit) &&
        digit >= 0 &&
        digit <= 9,
    );

  if (digits.length < WINDOW) {
    return {
      market,
      status: "COLLECTING",
      predictedDigit: null,
      estimatedProbability: 0,
      validationAccuracy: null,
      validationSamples: 0,
      digits: [],
      ticksUsed: digits.length,
      message: `Collecting ticks: ${digits.length}/${WINDOW}`,
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
        selections > 0
          ? wilsonLowerBound(hits, selections)
          : null,
    };
  });

  const best = results[0];

  const enoughSelections =
    best.validationSelections >= MIN_SELECTIONS;

  const digitPassed =
    enoughSelections &&
    best.lowerBound !== null &&
    best.lowerBound > RANDOM_BASELINE;

  const overallPassed =
    validation.accuracyLowerBound !== null &&
    validation.accuracyLowerBound > RANDOM_BASELINE;

  const status =
    digitPassed && overallPassed ? "CHECK" : "WAIT";

  return {
    market,
    status,
    predictedDigit: best.digit,
    estimatedProbability: best.probability,
    validationAccuracy: validation.accuracy,
    validationSamples: validation.total,
    digits: results,
    ticksUsed: digits.length,
    message:
      status === "CHECK"
        ? "Historical validation passed the configured statistical rules. This is not a guarantee."
        : "No digit has passed the configured high-confidence validation rules.",
  };
}
