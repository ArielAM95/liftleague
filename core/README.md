# LiftLeague — Core (MVP shared foundation)

Working name. This is the **zero-regret shared core** for the competitive
strength-training app: the parts that are identical whether we end up building
the **serious** direction ("Strava for the weight room") or the **mass** direction
(a casual gamified fitness game). We build this now and defer the fork.

> Design rationale, scoring math, game theory and the decision framework live in
> the product docs (sent separately). This repo is the runnable core.

## What's here

```
supabase/schema.sql        Postgres schema: profiles, gyms, exercises, workouts,
                           sets (with generated e1RM column), leagues, scores,
                           a leaderboard VIEW using window functions, and RLS.
src/scoring/               The scoring service — the single fork seam.
  types.ts                 ScoreProvider contract + shared types.
  e1rm.ts                  Estimated 1RM (Epley+Brzycki, rep-capped) + tonnage.
  dots.ts                  DOTS bodyweight/sex normalization + StrengthLevel map.
  expected.ts              Expected-progress model (the fairness core).
  providers/normalized.ts  SERIOUS scorer: 0.30*Level + 0.50*Improvement + 0.20*Consistency.
  providers/simpleXp.ts    MASS scorer: volume XP + PR bonus + streak multiplier.
  index.ts                 Façade + factory: getScorer() / scoreWith().
  scoring.test.ts          Tests incl. the novice-vs-veteran fairness proof.
scripts/seed-exercises.ts  Load the exercise DB into Supabase.
data/mvp_exercises_seed.json  678 curated lifts (from free-exercise-db, public domain).
```

## The one idea that keeps both directions open

Everything ranks off a single `ScoreProvider.score(input)` call. The app never
knows which scorer is live:

```ts
import { getScorer } from "./src/scoring";
const scorer = getScorer();            // env SCORING_DIRECTION, or A/B flag per user
const result = scorer.score(input);    // { value, breakdown, provider }
```

- **serious** → `NormalizedScorer` (DOTS + expectation-adjusted z-score). Fair
  across bodyweight/experience; a novice and a veteran land within ~15 points.
- **mass** → `SimpleXpScorer` (volume XP + PR bonus + streak). Legible, playful.

When the data tells us which direction wins (see the decision scorecard), we set
`DEFAULT_DIRECTION` and nothing else changes. Until then we can run **both** as an
A/B test by passing an override per cohort (e.g. from a PostHog flag).

## Run it

```bash
npm install
npm test          # runs the scoring tests, incl. the fairness proof
npm run typecheck

# load exercises into your Supabase project:
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
```

## Recommended stack (context)

- **Mobile:** React Native + Expo (one codebase, flexible for a data-first *or*
  animated/game UI; react-three-fiber / Rive available if we go mass).
- **Backend:** Supabase / Postgres — chosen because our core is rankings &
  percentiles, which SQL window functions do best.
- **Analytics/flags:** PostHog — required to run the two-variant A/B that decides
  the direction with data, not gut.
- **Weekly scoring job:** compute `league_scores` on a schedule (pg_cron or an
  Edge Function on cron), then leaderboards are a pure `select` from the view.

## Guardrails already baked in

- e1RM rep window capped at 10 (high-rep sets aren't over-credited).
- Serious scorer caps credited weekly gain at 8% → ego-lifting isn't the winning
  strategy (safety + anti-sandbagging).
- Workout data is private per RLS; only computed scores surface to a league.

## Not done yet (next bricks)

- Replace the placeholder `StrengthLevel` map + `expectedRate` priors with real
  demographic percentiles / a Bayesian fit once we have users.
- The Expo app shell (logging screen, league screen, onboarding — two variants).
- The weekly season-close job (promotion/relegation).
- Compliance guardrails from the safety review (waiver, consent, moderation).
