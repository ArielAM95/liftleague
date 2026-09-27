/**
 * NormalizedScorer — the "serious lifter" direction (Path A).
 *
 * Implements the hybrid from the design doc:
 *   CompetitionScore = 0.30*StrengthLevel + 0.50*Improvement + 0.20*Consistency
 *
 * - StrengthLevel: DOTS-based, bodyweight/sex normalized (anti-sandbagging anchor)
 * - Improvement:   expectation-adjusted z-score (fair across experience levels)
 * - Consistency:   sessions logged vs planned
 *
 * Safety guardrail baked in: weekly credited improvement is capped so ego-lifting
 * (huge unsafe jumps) is NOT the dominant strategy.
 */
import type { ScoreProvider, ScoringInput, Score } from "../types.js";
import { estimate1RM, bestE1RM } from "../e1rm.js";
import { dots, strengthLevelFromDots } from "../dots.js";
import { expectedWeeklyProgress, progressZ } from "../expected.js";

const WEIGHTS = { strengthLevel: 0.3, improvement: 0.5, consistency: 0.2 } as const;

/** Max fractional gain credited per week (safety cap against ego-lifting). */
const WEEKLY_GAIN_CAP = 0.08;

function windowWeeks(input: ScoringInput): number {
  const times = input.windowSets.map((s) => Date.parse(s.performedAt)).filter(Number.isFinite);
  if (times.length < 2) return 1;
  const span = (Math.max(...times) - Math.min(...times)) / (7 * 24 * 3600 * 1000);
  return Math.max(1, Math.round(span) || 1);
}

export class NormalizedScorer implements ScoreProvider {
  readonly name = "normalized-v1";

  score(input: ScoringInput): Score {
    const { athlete, windowSets } = input;

    // Best e1RM this window, per exercise.
    const bestThisWindow: Record<string, number> = {};
    for (const s of windowSets) {
      const e = estimate1RM(s.weightKg, s.reps);
      if (e > (bestThisWindow[s.exerciseId] ?? 0)) bestThisWindow[s.exerciseId] = e;
    }

    // --- StrengthLevel: DOTS of the best loadable lift this window ---
    let bestDots = 0;
    for (const s of windowSets) {
      if (!s.loadable) continue;
      const e = estimate1RM(s.weightKg, s.reps);
      bestDots = Math.max(bestDots, dots(e, athlete.bodyweightKg, athlete.sex));
    }
    const strengthLevel = strengthLevelFromDots(bestDots);

    // --- Improvement: mean expectation-adjusted z across improved exercises ---
    const weeks = windowWeeks(input);
    const exp = expectedWeeklyProgress(athlete.trainingAgeWeeks, weeks);
    const zs: number[] = [];
    for (const [exId, best] of Object.entries(bestThisWindow)) {
      const prior = input.priorBestE1rmByExercise[exId];
      if (!prior || prior <= 0) continue; // new lift / calibration -> no improvement credit yet
      const rawRate = best / prior - 1;
      const cappedRate = Math.min(rawRate, WEEKLY_GAIN_CAP * weeks); // safety cap
      zs.push(progressZ(cappedRate, exp));
    }
    const meanZ = zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : 0;
    const improvement = clip(50 + 15 * meanZ, 0, 100);

    // --- Consistency: sessions logged vs planned ---
    const sessionsLogged = countSessions(windowSets);
    const planned = Math.max(1, input.sessionsPlanned);
    const consistency = clip((sessionsLogged / planned) * 100, 0, 100);

    const value =
      WEIGHTS.strengthLevel * strengthLevel +
      WEIGHTS.improvement * improvement +
      WEIGHTS.consistency * consistency;

    return {
      value: round2(value),
      provider: this.name,
      breakdown: {
        strengthLevel: round2(strengthLevel),
        improvement: round2(improvement),
        consistency: round2(consistency),
        bestDots: round2(bestDots),
        meanZ: round2(meanZ),
        sessionsLogged,
      },
    };
  }
}

/** Number of distinct calendar days with at least one set. */
function countSessions(sets: ScoringInput["windowSets"]): number {
  const days = new Set(sets.map((s) => s.performedAt.slice(0, 10)));
  return days.size;
}

const clip = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

// re-export for tests that want the raw helper
export { bestE1RM };
