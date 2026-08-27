export type Category = "fish" | "plant" | "rock" | "coral" | "decor" | "sand";

export type CatalogItem = {
  id: string;
  name: string;
  category: Category;
  cost: number;
  /** [primary, secondary] hex colors used by the 3D model */
  colors: [string, string];
  /** shape key the renderer switches on */
  variant: string;
  blurb: string;
};

/** An instance of a catalog item living in the tank. */
export type PlacedItem = {
  uid: string;
  itemId: string;
  x: number;
  z: number;
  rot: number;
  scale: number;
  /** stable randomness for motion + silhouette */
  seed: number;
  /** fish only: 0..1 feeding progress, drives how large it has grown */
  growth?: number;
  /** fish only: ailing fish die at the next rollover unless fed properly */
  ailing?: "hunger" | "overfed" | null;
  /** claimed from the free starter picks — cannot be sold */
  gift?: boolean;
};

export type HabitCategory =
  | "fitness"
  | "food"
  | "hygiene"
  | "selfcare"
  | "mind"
  | "other";

export type Habit = {
  id: string;
  name: string;
  reward: number;
  category: HabitCategory;
  createdAt: string;
  /** dayKey -> true */
  log: Record<string, boolean>;
};

export type Task = {
  id: string;
  title: string;
  reward: number;
  day: string;
  done: boolean;
  completedAt: string | null;
};
