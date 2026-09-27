/**
 * DOTS strength normalization.
 *
 * DOTS maps "kg lifted" to a bodyweight- and sex-normalized score, so a 60kg
 * lifter and a 100kg lifter can be compared fairly on strength LEVEL.
 *
 *   DOTS = liftedKg * 500 / (a*bw^4 + b*bw^3 + c*bw^2 + d*bw + e)   (bw in kg)
 *
 * Coefficients are the widely-used 2020 DOTS set. They are constants of the
 * formula, not tuning knobs — do not "adjust" them. Validate against a known
 * DOTS calculator before launch (see scoring.test.ts for sanity anchors).
 */

interface DotsCoeffs {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
}

const MALE: DotsCoeffs = {
  a: -0.000001093,
  b: 0.0007391293,
  c: -0.1918759221,
  d: 24.0900756,
  e: -307.75076,
};

const FEMALE: DotsCoeffs = {
  a: -0.0000010706,
  b: 0.0005158568,
  c: -0.1126655495,
  d: 13.6175032,
  e: -57.96288,
};

/** DOTS points for a given lift, bodyweight and sex. */
export function dots(liftedKg: number, bodyweightKg: number, sex: "male" | "female"): number {
  if (liftedKg <= 0 || bodyweightKg <= 0) return 0;
  const k = sex === "female" ? FEMALE : MALE;
  const bw = bodyweightKg;
  const denom = k.a * bw ** 4 + k.b * bw ** 3 + k.c * bw ** 2 + k.d * bw + k.e;
  if (denom <= 0) return 0;
  return (liftedKg * 500) / denom;
}

/**
 * Map a DOTS value to a 0-100 "StrengthLevel".
 *
 * PLACEHOLDER: until we have real population data we map against rough strength
 * standards (DOTS ~50 = untrained, ~500 = world-elite). Replace this with a true
 * demographic percentile (percentile(DOTS | sex, age)) once the user base exists
 * — that is the anti-sandbagging anchor described in the design doc.
 */
export function strengthLevelFromDots(dotsValue: number): number {
  const ELITE_DOTS = 500;
  const level = (dotsValue / ELITE_DOTS) * 100;
  return Math.max(0, Math.min(100, level));
}
