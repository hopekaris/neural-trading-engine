export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Tick {
  quote: number | string;
  symbol?: string;
  epoch?: number;
}

export interface DigitStats {
  digit: number;
  count: number;
  percentage: number;
}

export interface AnalysisResult {
  totalTicks: number;
  lastDigit: number | null;
  frequencies: DigitStats[];
  hotDigits: number[];
  coldDigits: number[];
  predictedDigit: number;
  probability: number;
  baselineProbability: number;
  evidenceScore: number;
  recommendation: "CHECK" | "WAIT";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  message: string;
}

export function extractLastDigit(
  quote: number | string
): Digit {
  const value = String(quote);

  const decimal = value.split(".")[1] || "";

  const digits = decimal.replace(/\D/g, "");

  if (digits.length > 0) {
    return Number(digits[digits.length - 1]) as Digit;
  }

  const whole = value.replace(/\D/g, "");

  return Number(whole[whole.length - 1] || 0) as Digit;
}

export function analyzeWindow(
  ticks: Tick[],
  windowSize = 500
): AnalysisResult {
  const selectedTicks = ticks.slice(-windowSize);

  const digits = selectedTicks.map(tick =>
    extractLastDigit(tick.quote)
  );

  const counts = Array(10).fill(0);

  digits.forEach(digit => {
    counts[digit]++;
  });

  const totalTicks = digits.length;

  const frequencies: DigitStats[] = counts.map(
    (count, digit) => ({
      digit,
      count,
      percentage:
        totalTicks > 0
          ? Number(((count / totalTicks) * 100).toFixed(2))
          : 0
    })
  );

  const sorted = [...frequencies].sort(
    (a, b) => b.count - a.count
  );

  const hotDigits = sorted.slice(0, 3).map(x => x.digit);

  const coldDigits = [...frequencies]
    .sort((a, b) => a.count - b.count)
    .slice(0, 3)
    .map(x => x.digit);

  const predictedDigit = sorted[0]?.digit ?? 0;

  const probability =
    totalTicks > 0
      ? Number(
          ((counts[predictedDigit] / totalTicks) * 100).toFixed(2)
        )
      : 0;

  const baselineProbability = 10;

  const evidenceScore =
    totalTicks >= 100
      ? Math.max(
          0,
          Number((probability - baselineProbability).toFixed(2))
        )
      : 0;

  const recommendation =
    totalTicks >= 100 && evidenceScore >= 2
      ? "CHECK"
      : "WAIT";

  const confidence =
    totalTicks >= 500 && evidenceScore >= 3
      ? "HIGH"
      : totalTicks >= 100 && evidenceScore >= 2
      ? "MEDIUM"
      : "LOW";

  return {
    totalTicks,
    lastDigit: digits.length
      ? digits[digits.length - 1]
      : null,
    frequencies,
    hotDigits,
    coldDigits,
    predictedDigit,
    probability,
    baselineProbability,
    evidenceScore,
    recommendation,
    confidence,
    message:
      recommendation === "CHECK"
        ? "Historical frequency evidence detected. Review before trading."
        : "Insufficient evidence. Continue collecting ticks."
  };
}

export function analyzeContractEvidence(
  ticks: Tick[],
  predictedDigit: number,
  windowSize = 500
): AnalysisResult {
  const result = analyzeWindow(ticks, windowSize);

  const validDigit = Math.max(
    0,
    Math.min(9, Math.floor(predictedDigit))
  );

  const matchingDigit = result.frequencies[validDigit];

  const probability = matchingDigit.percentage;

  const evidenceScore = Math.max(
    0,
    Number((probability - 10).toFixed(2))
  );

  return {
    ...result,
    predictedDigit: validDigit,
    probability,
    evidenceScore,
    recommendation:
      result.totalTicks >= 100 && evidenceScore >= 2
        ? "CHECK"
        : "WAIT",
    confidence:
      result.totalTicks >= 500 && evidenceScore >= 3
        ? "HIGH"
        : result.totalTicks >= 100 && evidenceScore >= 2
        ? "MEDIUM"
        : "LOW",
    message:
      result.totalTicks < 100
        ? "Collect at least 100 ticks before evaluating."
        : "Review the historical frequency evidence before making a decision."
  };
    }
