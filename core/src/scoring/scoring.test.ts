import { describe, it, expect } from "vitest";
import { estimate1RM, EPLEY, BRZYCKI } from "./e1rm.js";
import { dots } from "./dots.js";
import { expectedWeeklyProgress } from "./expected.js";
import { scoreWith } from "./index.js";
import type { ScoringInput, Athlete } from "./types.js";

describe("e1RM", () => {
  it("returns the weight itself for a true 1RM", () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });
  it("Epley 100x5 = 116.7", () => {
    expect(EPLEY(100, 5)).toBeCloseTo(116.67, 1);
  });
  it("Brzycki 100x5 = 112.5", () => {
    expect(BRZYCKI(100, 5)).toBeCloseTo(112.5, 1);
  });
  it("averages the two formulas", () => {
    expect(estimate1RM(100, 5)).toBeCloseTo((116.67 + 112.5) / 2, 1);
  });
  it("caps rep window at 10 so high-rep sets aren't over-credited", () => {
    expect(estimate1RM(60, 20)).toBe(estimate1RM(60, 10));
  });
});

describe("DOTS", () => {
  // Sanity anchors: a ~500 DOTS lift is world-elite territory; untrained is low.
  it("normalizes so a heavier lifter's raw advantage shrinks", () => {
    const light = dots(80, 60, "male"); // 60kg lifter squats 80
    const heavy = dots(180, 100, "male"); // 100kg lifter squats 180
    // raw ratio is 1:2.25; DOTS ratio must be much smaller
    expect(heavy / light).toBeLessThan(2.25);
    expect(heavy).toBeGreaterThan(light); // heavy is genuinely stronger
  });
  it("is positive and finite for normal inputs", () => {
    expect(Number.isFinite(dots(140, 83, "male"))).toBe(true);
    expect(dots(140, 83, "male")).toBeGreaterThan(0);
  });
});

describe("expected progress decays with training age", () => {
  it("novice expects far more than a veteran", () => {
    const novice = expectedWeeklyProgress(2).expectedRate;
    const veteran = expectedWeeklyProgress(200).expectedRate;
    expect(novice).toBeGreaterThan(veteran * 5);
  });
});

// --- The fairness headline ---
const novice: Athlete = { id: "a", sex: "male", bodyweightKg: 60, trainingAgeWeeks: 8 };
const veteran: Athlete = { id: "b", sex: "male", bodyweightKg: 100, trainingAgeWeeks: 260 };

describe("fairness: equal RELATIVE effort -> near-equal scores despite 1:2.25 raw gap", () => {
  // Each athlete progresses roughly at their OWN expected rate this week:
  // novice 72 -> 76 (~5.6%), veteran 180 -> 181 (~0.6%). Single clean 1-rep set each.
  const noviceInput: ScoringInput = {
    athlete: novice,
    sessionsPlanned: 1,
    priorBestE1rmByExercise: { squat: 72 },
    windowSets: [
      { exerciseId: "squat", weightKg: 76, reps: 1, loadable: true, performedAt: "2026-01-05T10:00:00Z" },
    ],
  };
  const veteranInput: ScoringInput = {
    athlete: veteran,
    sessionsPlanned: 1,
    priorBestE1rmByExercise: { squat: 180 },
    windowSets: [
      { exerciseId: "squat", weightKg: 181, reps: 1, loadable: true, performedAt: "2026-01-05T10:00:00Z" },
    ],
  };

  it("lands the two within ~12 points (raw kg were 76 vs 181)", () => {
    const n = scoreWith("serious", noviceInput).value;
    const v = scoreWith("serious", veteranInput).value;
    expect(Math.abs(n - v)).toBeLessThan(12);
  });

  it("still credits the veteran's genuinely higher strength level", () => {
    const n = scoreWith("serious", noviceInput);
    const v = scoreWith("serious", veteranInput);
    expect(v.breakdown.strengthLevel!).toBeGreaterThan(n.breakdown.strengthLevel!);
  });
});

describe("merit: a novice OVER-performing beats a veteran who only holds", () => {
  // novice smashes it (72 -> 82, ~14%), veteran holds (180 -> 180).
  const noviceInput: ScoringInput = {
    athlete: novice,
    sessionsPlanned: 1,
    priorBestE1rmByExercise: { squat: 72 },
    windowSets: [
      { exerciseId: "squat", weightKg: 82, reps: 1, loadable: true, performedAt: "2026-01-05T10:00:00Z" },
    ],
  };
  const veteranInput: ScoringInput = {
    athlete: veteran,
    sessionsPlanned: 1,
    priorBestE1rmByExercise: { squat: 180 },
    windowSets: [
      { exerciseId: "squat", weightKg: 180, reps: 1, loadable: true, performedAt: "2026-01-05T10:00:00Z" },
    ],
  };

  it("gives the novice the higher improvement component", () => {
    const n = scoreWith("serious", noviceInput);
    const v = scoreWith("serious", veteranInput);
    expect(n.breakdown.improvement!).toBeGreaterThan(v.breakdown.improvement!);
  });

  it("lets over-performance win overall despite a lower strength level", () => {
    const n = scoreWith("serious", noviceInput);
    const v = scoreWith("serious", veteranInput);
    expect(v.breakdown.strengthLevel!).toBeGreaterThan(n.breakdown.strengthLevel!); // vet is stronger
    expect(n.value).toBeGreaterThan(v.value); // but the novice earned this week
  });
});

describe("safety: ego-lifting is capped (a reckless jump can't dominate)", () => {
  it("credits a 40% weekly jump no more than the 8% cap allows", () => {
    const reckless: ScoringInput = {
      athlete: novice,
      sessionsPlanned: 1,
      priorBestE1rmByExercise: { squat: 100 },
      windowSets: [
        { exerciseId: "squat", weightKg: 140, reps: 1, loadable: true, performedAt: "2026-01-05T10:00:00Z" },
      ],
    };
    const capped: ScoringInput = {
      ...reckless,
      windowSets: [
        { exerciseId: "squat", weightKg: 108, reps: 1, loadable: true, performedAt: "2026-01-05T10:00:00Z" },
      ],
    };
    // both are >= the 8% cap, so the improvement component must be identical
    expect(scoreWith("serious", reckless).breakdown.improvement).toBe(
      scoreWith("serious", capped).breakdown.improvement,
    );
  });
});

describe("simple XP scorer (mass path) uses the same contract", () => {
  const input: ScoringInput = {
    athlete: { id: "c", sex: "female", bodyweightKg: 65, trainingAgeWeeks: 12 },
    sessionsPlanned: 3,
    priorBestE1rmByExercise: { squat: 40 },
    windowSets: [
      { exerciseId: "squat", weightKg: 45, reps: 5, loadable: true, performedAt: "2026-01-05T10:00:00Z" },
      { exerciseId: "squat", weightKg: 45, reps: 5, loadable: true, performedAt: "2026-01-07T10:00:00Z" },
    ],
  };
  it("produces XP with a PR bonus and streak multiplier", () => {
    const s = scoreWith("mass", input);
    expect(s.provider).toBe("simple-xp-v1");
    expect(s.value).toBeGreaterThan(0);
    expect(s.breakdown.prCount).toBe(1);
  });
});
