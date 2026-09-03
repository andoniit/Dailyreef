/**
 * Emits the data both clients need into ../shared/*.json.
 *
 * The TypeScript modules stay the single source of truth; the iOS app
 * bundles the generated JSON and decodes it. Hand-copying the catalog
 * into Swift would guarantee the two drift, and drift in the feeding
 * rules deletes fish.
 *
 *   node --experimental-strip-types --import ./scripts/register-ts.mjs \
 *        scripts/export-shared.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../shared");

const { CATALOG, CATEGORY_LABEL, DEFAULT_SAND } = await import("../src/lib/catalog.ts");
const { CATEGORIES, DEFAULT_CATEGORY } = await import("../src/lib/habits.ts");
const store = await import("../src/lib/store.ts");

mkdirSync(OUT, { recursive: true });

const write = (name, data) => {
  const file = path.join(OUT, name);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
};

write("catalog.json", {
  items: CATALOG,
  categoryLabel: CATEGORY_LABEL,
  defaultSand: DEFAULT_SAND,
});

write("habit-categories.json", {
  categories: CATEGORIES,
  defaultCategory: DEFAULT_CATEGORY,
});

write("rules.json", {
  maxFeedsPerDay: store.MAX_FEEDS_PER_DAY,
  starveDays: store.STARVE_DAYS,
  feedTaskRatio: store.FEED_TASK_RATIO,
  freeCategories: store.FREE_CATEGORIES,
  tank: store.TANK,
  islandSpots: store.ISLAND_SPOTS,
  defaultIslandSpot: store.DEFAULT_ISLAND_SPOT.id,
  islandClear: store.ISLAND_CLEAR,
});

console.log("\nShared data exported. Re-run this whenever catalog.ts,");
console.log("habits.ts or the rule constants in store.ts change.");
