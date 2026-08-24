import type { CatalogItem } from "./types";

export const CATALOG: CatalogItem[] = [
  // ── Fish ──────────────────────────────────────────────────────────
  { id: "guppy",     name: "Guppy",        category: "fish", cost: 20,  colors: ["#f9a03f", "#ffd9a0"], variant: "small",  blurb: "Darts about near the surface." },
  { id: "clownfish", name: "Clownfish",    category: "fish", cost: 30,  colors: ["#ff7043", "#fff3e0"], variant: "small",  blurb: "Never strays far from an anemone." },
  { id: "neon",      name: "Neon Tetra",   category: "fish", cost: 35,  colors: ["#38bdf8", "#f43f5e"], variant: "small",  blurb: "A flick of blue in the midwater." },
  { id: "tang",      name: "Blue Tang",    category: "fish", cost: 50,  colors: ["#2563eb", "#fbbf24"], variant: "medium", blurb: "Broad, calm, unhurried." },
  { id: "angel",     name: "Angelfish",    category: "fish", cost: 65,  colors: ["#fcd34d", "#7c3aed"], variant: "tall",   blurb: "Tall fins, slow glide." },
  { id: "koi",       name: "Koi",          category: "fish", cost: 80,  colors: ["#fef3c7", "#ef4444"], variant: "medium", blurb: "Patient and long-lived." },
  { id: "seahorse",  name: "Seahorse",     category: "fish", cost: 95,  colors: ["#fbbf24", "#f59e0b"], variant: "seahorse", blurb: "Hovers upright, drifting." },
  { id: "jelly",     name: "Moon Jelly",   category: "fish", cost: 120, colors: ["#c4b5fd", "#a78bfa"], variant: "jelly",  blurb: "Pulses through the deep water." },
  { id: "ray",       name: "Manta Ray",    category: "fish", cost: 180, colors: ["#1e3a8a", "#93c5fd"], variant: "ray",    blurb: "The tank's quiet giant." },

  // ── Plants ────────────────────────────────────────────────────────
  { id: "seagrass",  name: "Seagrass",     category: "plant", cost: 12, colors: ["#4ade80", "#16a34a"], variant: "grass",  blurb: "A soft green tuft." },
  { id: "kelp",      name: "Kelp",         category: "plant", cost: 22, colors: ["#15803d", "#22c55e"], variant: "kelp",   blurb: "Tall ribbons that sway." },
  { id: "teal-weed", name: "Teal Weed",    category: "plant", cost: 28, colors: ["#2dd4bf", "#5eead4"], variant: "kelp",   blurb: "Pale and feathery." },
  { id: "violet-fan",name: "Violet Fan",   category: "plant", cost: 40, colors: ["#a855f7", "#d8b4fe"], variant: "fan",    blurb: "Fans out to catch the current." },
  { id: "anemone",   name: "Anemone",      category: "plant", cost: 55, colors: ["#fb7185", "#fda4af"], variant: "anemone",blurb: "Waving tentacles, always busy." },

  // ── Rocks ─────────────────────────────────────────────────────────
  { id: "pebbles",   name: "Pebble Cluster", category: "rock", cost: 8,  colors: ["#d6d3d1", "#a8a29e"], variant: "pebbles", blurb: "Three small stones." },
  { id: "boulder",   name: "Boulder",        category: "rock", cost: 18, colors: ["#b9a48c", "#8c7a66"], variant: "boulder", blurb: "Weathered and round." },
  { id: "slate",     name: "Slate Stack",    category: "rock", cost: 30, colors: ["#94a3b8", "#64748b"], variant: "stack",   blurb: "Flat layers piled up." },
  { id: "arch",      name: "Arch Rock",      category: "rock", cost: 50, colors: ["#a3937c", "#7a6a56"], variant: "arch",    blurb: "A doorway for the fish." },

  // ── Coral ─────────────────────────────────────────────────────────
  { id: "brain",     name: "Brain Coral",    category: "coral", cost: 35, colors: ["#fbbf24", "#f59e0b"], variant: "brain",   blurb: "Domed and grooved." },
  { id: "staghorn",  name: "Staghorn Coral", category: "coral", cost: 45, colors: ["#fb923c", "#fdba74"], variant: "staghorn",blurb: "Antlers reaching up." },
  { id: "bubble",    name: "Bubble Coral",   category: "coral", cost: 55, colors: ["#67e8f9", "#a5f3fc"], variant: "bubble",  blurb: "A cluster of glassy beads." },
  { id: "pink-tube", name: "Tube Coral",     category: "coral", cost: 60, colors: ["#f472b6", "#fbcfe8"], variant: "tube",    blurb: "Slender pink pipes." },

  // ── Decor ─────────────────────────────────────────────────────────
  { id: "chest",     name: "Treasure Chest", category: "decor", cost: 90,  colors: ["#92400e", "#fcd34d"], variant: "chest",  blurb: "Bubbles escape the lid." },
  { id: "amphora",   name: "Amphora",        category: "decor", cost: 110, colors: ["#c2703f", "#e8b98d"], variant: "amphora",blurb: "Toppled and half-buried." },
  { id: "wreck",     name: "Shipwreck",      category: "decor", cost: 200, colors: ["#7c4a2d", "#a86b45"], variant: "wreck",  blurb: "The centrepiece of any reef." },

  // ── Sand (global floor styles) ────────────────────────────────────
  { id: "sand-shore",  name: "Shore Sand",  category: "sand", cost: 0,   colors: ["#f7e3c6", "#e2914b"], variant: "sand", blurb: "Warm and default." },
  { id: "sand-pink",   name: "Pink Sand",   category: "sand", cost: 60,  colors: ["#fbd7dc", "#e08a98"], variant: "sand", blurb: "Crushed coral shore." },
  { id: "sand-white",  name: "White Sand",  category: "sand", cost: 80,  colors: ["#f6fafd", "#b9c8d6"], variant: "sand", blurb: "Bright lagoon floor." },
  { id: "sand-black",  name: "Volcanic Sand", category: "sand", cost: 120, colors: ["#4d525b", "#2a2e35"], variant: "sand", blurb: "Dark grain from a young island." },
];

export const BY_ID: Record<string, CatalogItem> = Object.fromEntries(
  CATALOG.map((i) => [i.id, i])
);

export const CATEGORY_LABEL: Record<string, string> = {
  fish: "Fish",
  plant: "Plants",
  rock: "Stones",
  coral: "Coral",
  decor: "Decor",
  sand: "Sand",
};

export const DEFAULT_SAND = "sand-shore";
