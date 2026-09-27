/**
 * Estimated 1-Rep-Max (e1RM).
 *
 * We average the Epley and Brzycki formulas, which agree well up to ~10 reps.
 * Above 10 reps both degrade badly, so we clamp: sets with >10 reps are still
 * usable but their estimate is capped to the 10-rep estimate to avoid rewarding
 * high-rep "endurance" sets as if they were maximal strength.
 */

export const EPLEY = (weightKg: number, reps: number): number =>
  weightKg * (1 + reps / 30);

export const BRZYCKI = (weightKg: number, reps: number): number =>
  reps >= 37 ? weightKg * 36 : weightKg * (36 / (37 - reps));

/**
 * Averaged e1RM for a single set.
 * - 1 rep -> returns the weight itself (a true 1RM).
 * - reps clamped at 10 for the estimate window.
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  const cappedReps = Math.min(reps, 10);
  return (EPLEY(weightKg, cappedReps) + BRZYCKI(weightKg, cappedReps)) / 2;
}

/** Best e1RM across a list of sets for one exercise. */
export function bestE1RM(sets: { weightKg: number; reps: number }[]): number {
  return sets.reduce((best, s) => Math.max(best, estimate1RM(s.weightKg, s.reps)), 0);
}

/** Training volume / tonnage for a set (sets*reps*weight is summed by the caller). */
export const tonnage = (weightKg: number, reps: number): number =>
  Math.max(0, weightKg) * Math.max(0, reps);
