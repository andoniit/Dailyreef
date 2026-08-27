import type { HabitCategory } from "./types";

/**
 * Habit categories, and what a habit in each is worth.
 *
 * Looking after yourself is what the app is for, so those categories are
 * marked `core`: they offer higher reward tiers than the rest and sort to
 * the top of the list. A gym session and "reply to emails" are not worth
 * the same number of fish, and the shape of the reward ladder is what
 * says so — not a note in the docs.
 */
export type CategoryDef = {
  id: HabitCategory;
  label: string;
  /** the app's own purpose: self-care beats everything else */
  core: boolean;
  /** reward tiers offered when creating a habit in this category */
  rewards: [number, number, number];
  /** tailwind text colour for the category dot */
  tint: string;
  hint: string;
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: "fitness",
    label: "Fitness",
    core: true,
    rewards: [25, 40, 60],
    tint: "#ef6c5a",
    hint: "Gym, running, stretching, sport",
  },
  {
    id: "food",
    label: "Food",
    core: true,
    rewards: [20, 35, 50],
    tint: "#f0a742",
    hint: "Cooking, eating properly, hydration",
  },
  {
    id: "hygiene",
    label: "Hygiene",
    core: true,
    rewards: [20, 30, 45],
    tint: "#3fb8d4",
    hint: "Bath, shower, teeth, skincare",
  },
  {
    id: "selfcare",
    label: "Self-care",
    core: true,
    rewards: [20, 35, 50],
    tint: "#8b7ce8",
    hint: "Sleep, rest, meditation, journalling",
  },
  {
    id: "mind",
    label: "Mind",
    core: false,
    rewards: [10, 18, 28],
    tint: "#4a9c6d",
    hint: "Reading, study, practice",
  },
  {
    id: "other",
    label: "Other",
    core: false,
    rewards: [8, 14, 22],
    tint: "#8d9299",
    hint: "Anything else",
  },
];

export const CATEGORY_BY_ID: Record<HabitCategory, CategoryDef> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
    HabitCategory,
    CategoryDef
  >;

export const DEFAULT_CATEGORY: HabitCategory = "selfcare";

/** Core categories first, then by list order, then by name. */
export function categoryRank(id: HabitCategory): number {
  const i = CATEGORIES.findIndex((c) => c.id === id);
  return i < 0 ? CATEGORIES.length : i;
}

/**
 * Guess a category from what the habit is called, so the picker starts on
 * the right one instead of making you set it every time.
 */
const KEYWORDS: Array<[HabitCategory, RegExp]> = [
  [
    "fitness",
    /\b(gym|workout|work out|exercise|run|running|jog|walk|steps|yoga|stretch|swim|cycle|cycling|lift|train|training|sport|pushup|pilates)\b/i,
  ],
  [
    "food",
    /\b(cook|cooking|meal|breakfast|lunch|dinner|eat|eating|water|hydrate|veg|vegetables|fruit|protein|groceries|meal prep)\b/i,
  ],
  [
    "hygiene",
    /\b(bath|bathe|shower|wash|teeth|brush|floss|skincare|skin care|shave|hair|groom|clean)\b/i,
  ],
  [
    "selfcare",
    /\b(sleep|bed|rest|nap|meditat|breathe|journal|gratitude|therapy|screen|relax|self care|selfcare|mindful)\b/i,
  ],
  [
    "mind",
    /\b(read|reading|book|study|learn|practice|practise|course|language|write|writing|code|coding)\b/i,
  ],
];

export function guessCategory(name: string): HabitCategory {
  for (const [id, re] of KEYWORDS) {
    if (re.test(name)) return id;
  }
  return DEFAULT_CATEGORY;
}
