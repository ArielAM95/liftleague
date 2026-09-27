/**
 * Expected-progress model.
 *
 * The fairness core: instead of rewarding raw % improvement (which favors
 * beginners and invites sandbagging), we ask "did you progress FASTER than
 * expected for someone like you?" — an expectation-adjusted z-score.
 *
 * Expected weekly improvement decays with training age: novices make big
 * "newbie gains", advanced lifters crawl. We model expected weekly fractional
 * gain as an exponential decay, with a floor for lifelong slow progress.
 *
 * PLACEHOLDER MODEL: the decay constants below are literature-informed priors.
 * Replace with a Bayesian fit on real user data once available (see design doc,
 * "expectedRate = f(trainingAge, currentStrength)").
 */

export interface ExpectedProgress {
  /** Expected fractional e1RM gain for the window (e.g. 0.05 = +5%). */
  expectedRate: number;
  /** Standard deviation of that rate, for the z-score. */
  sd: number;
}

/**
 * @param trainingAgeWeeks weeks since the athlete started training
 * @param windowWeeks length of the competition window (default 1 week)
 */
export function expectedWeeklyProgress(
  trainingAgeWeeks: number,
  windowWeeks = 1,
): ExpectedProgress {
  // Novice starts ~6%/week, decays toward a ~0.2%/week floor.
  const NOVICE_RATE = 0.06;
  const FLOOR_RATE = 0.002;
  const DECAY_WEEKS = 26; // ~6 months to lose most of the newbie-gain bonus

  const t = Math.max(0, trainingAgeWeeks);
  const weekly = FLOOR_RATE + (NOVICE_RATE - FLOOR_RATE) * Math.exp(-t / DECAY_WEEKS);

  // SD scales with the expected rate (more uncertainty when gains are big).
  const weeklySd = Math.max(0.005, weekly * 0.6);

  return {
    expectedRate: weekly * windowWeeks,
    sd: weeklySd * Math.sqrt(windowWeeks),
  };
}

/** Expectation-adjusted z-score of an observed fractional gain. */
export function progressZ(
  observedRate: number,
  { expectedRate, sd }: ExpectedProgress,
): number {
  if (sd <= 0) return 0;
  return (observedRate - expectedRate) / sd;
}
