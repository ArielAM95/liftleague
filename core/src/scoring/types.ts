/**
 * Shared scoring types.
 *
 * These types are the CONTRACT between the app and the scoring service.
 * Both scoring directions (mass-market XP vs. serious normalized DOTS/z-score)
 * implement `ScoreProvider`, so the rest of the app never depends on which one
 * is active. Swapping the direction is a one-line factory change (see index.ts).
 */

export type Sex = "male" | "female";

/** A single logged working set (the shared logging primitive). */
export interface LoggedSet {
  exerciseId: string;
  weightKg: number; // external load; 0 for pure bodyweight movements
  reps: number;
  /** ISO timestamp of when the set was performed. */
  performedAt: string;
  /** Whether this exercise accepts external load (from the exercise seed `loadable` flag). */
  loadable: boolean;
}

/** Minimal athlete context needed for normalization. */
export interface Athlete {
  id: string;
  sex: Sex;
  bodyweightKg: number;
  ageYears?: number;
  /** Weeks since the athlete started training (drives the "expected progress" model). */
  trainingAgeWeeks: number;
}

/** Everything the scorer needs to score one athlete for one competition window (e.g. a week). */
export interface ScoringInput {
  athlete: Athlete;
  /** All sets performed inside the current competition window. */
  windowSets: LoggedSet[];
  /**
   * Best estimated-1RM per exercise BEFORE this window (the athlete's prior baseline).
   * Used to measure improvement. Empty for a brand-new athlete (calibration period).
   */
  priorBestE1rmByExercise: Record<string, number>;
  /** Number of sessions the athlete planned/committed to in this window (for consistency). */
  sessionsPlanned: number;
}

/** The unit-less competition score plus a breakdown for transparency in the UI. */
export interface Score {
  /** Final competition score for ranking within a league. Higher is better. */
  value: number;
  /** Human-readable breakdown, shown in the UI and useful for debugging fairness. */
  breakdown: Record<string, number>;
  /** Which provider produced this (for analytics / A-B attribution). */
  provider: string;
}

/**
 * The single seam that keeps both product directions open.
 * Implementations MUST be pure functions of the input (deterministic, testable).
 */
export interface ScoreProvider {
  readonly name: string;
  score(input: ScoringInput): Score;
}
