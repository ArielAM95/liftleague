/**
 * SimpleXpScorer — the "mass-market game" direction (Path B).
 *
 * Deliberately simple and legible: XP from volume + a flat PR bonus + a
 * consistency streak multiplier. No bodyweight normalization, no DOTS — the
 * casual player just wants numbers to go up. Same ScoreProvider contract as the
 * serious scorer, so the app code is identical either way.
 */
import type { ScoreProvider, ScoringInput, Score } from "../types.js";
import { estimate1RM, tonnage } from "../e1rm.js";

const XP_PER_1000KG_VOLUME = 10; // 1000kg of tonnage -> 10 XP
const PR_BONUS_XP = 25; // each exercise where you beat your prior best
const STREAK_STEP = 0.1; // +10% per session-day, capped
const STREAK_CAP = 1.5;

export class SimpleXpScorer implements ScoreProvider {
  readonly name = "simple-xp-v1";

  score(input: ScoringInput): Score {
    const { windowSets } = input;

    let volume = 0;
    const bestThisWindow: Record<string, number> = {};
    for (const s of windowSets) {
      volume += tonnage(s.weightKg, s.reps);
      const e = estimate1RM(s.weightKg, s.reps);
      if (e > (bestThisWindow[s.exerciseId] ?? 0)) bestThisWindow[s.exerciseId] = e;
    }

    const volumeXp = (volume / 1000) * XP_PER_1000KG_VOLUME;

    let prCount = 0;
    for (const [exId, best] of Object.entries(bestThisWindow)) {
      const prior = input.priorBestE1rmByExercise[exId] ?? 0;
      if (best > prior && prior > 0) prCount += 1;
    }
    const prXp = prCount * PR_BONUS_XP;

    const sessionDays = new Set(windowSets.map((s) => s.performedAt.slice(0, 10))).size;
    const streakMult = Math.min(STREAK_CAP, 1 + sessionDays * STREAK_STEP);

    const value = Math.round((volumeXp + prXp) * streakMult);

    return {
      value,
      provider: this.name,
      breakdown: {
        volumeXp: Math.round(volumeXp),
        prXp,
        prCount,
        sessionDays,
        streakMult: Math.round(streakMult * 100) / 100,
        totalVolumeKg: Math.round(volume),
      },
    };
  }
}
