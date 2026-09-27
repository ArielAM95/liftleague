/**
 * Scoring façade + factory.
 *
 * This is the single seam that keeps both product directions open.
 * The whole app calls `getScorer()` and `scorer.score(input)` — nothing else
 * knows whether we're running the mass-market XP scorer or the serious
 * normalized scorer. Flipping direction (or A/B-testing both) is one env/flag.
 *
 * Fork point (from the decision framework): when we hit the "commitment point"
 * and choose a direction based on data, we just fix DEFAULT_DIRECTION — the rest
 * of the codebase does not change.
 */
import type { ScoreProvider, ScoringInput, Score } from "./types.js";
import { NormalizedScorer } from "./providers/normalized.js";
import { SimpleXpScorer } from "./providers/simpleXp.js";

export type ScoringDirection = "serious" | "mass";

const REGISTRY: Record<ScoringDirection, () => ScoreProvider> = {
  serious: () => new NormalizedScorer(),
  mass: () => new SimpleXpScorer(),
};

/**
 * Resolve the active scorer. `override` lets the A/B framework assign a cohort
 * (e.g. PostHog feature flag) a specific direction per user.
 */
export function getScorer(override?: ScoringDirection): ScoreProvider {
  const direction: ScoringDirection =
    override ?? (process.env.SCORING_DIRECTION as ScoringDirection) ?? "serious";
  const make = REGISTRY[direction] ?? REGISTRY.serious;
  return make();
}

/** Convenience: score once with an explicit direction. */
export function scoreWith(direction: ScoringDirection, input: ScoringInput): Score {
  return getScorer(direction).score(input);
}

export * from "./types.js";
export { estimate1RM, bestE1RM, tonnage } from "./e1rm.js";
export { dots, strengthLevelFromDots } from "./dots.js";
export { expectedWeeklyProgress, progressZ } from "./expected.js";
export { NormalizedScorer } from "./providers/normalized.js";
export { SimpleXpScorer } from "./providers/simpleXp.js";
