/**
 * Load the cleaned exercise seed into Supabase.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
 *
 * Uses the service-role key (server-side only — never ship it in the app).
 * Source: free-exercise-db (yuhonas), The Unlicense / public domain.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SeedExercise {
  id: string;
  name: string;
  category: string | null;
  equipment: string | null;
  level: string | null;
  mechanic: string | null;
  force: string | null;
  loadable: boolean;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  images: string[];
  instructions: string[];
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const file = join(__dirname, "..", "data", "mvp_exercises_seed.json");
  const seed: SeedExercise[] = JSON.parse(readFileSync(file, "utf8"));
  console.log(`Loaded ${seed.length} exercises from seed`);

  const rows = seed.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    equipment: e.equipment,
    level: e.level,
    mechanic: e.mechanic,
    force: e.force,
    loadable: e.loadable,
    primary_muscles: e.primaryMuscles,
    secondary_muscles: e.secondaryMuscles,
    images: e.images,
    instructions: e.instructions,
  }));

  // Upsert in chunks to stay well under payload limits.
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("exercises").upsert(batch, { onConflict: "id" });
    if (error) throw error;
    console.log(`Upserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
