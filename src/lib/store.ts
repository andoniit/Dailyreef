"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Habit, PlacedItem, Task } from "./types";
import { BY_ID, DEFAULT_SAND } from "./catalog";
import { addDays, dayKey, daysBetween } from "./date";
import { cloud, type Snapshot } from "./cloud";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Where the island is anchored. Lives here rather than in the island
 * component so the store doesn't have to import a three.js module — that
 * would both pull the 3D bundle into the sidebar and form an import cycle
 * back through TANK.
 */
/** Feeding rules. */
export const MAX_FEEDS_PER_DAY = 10;
export const STARVE_DAYS = 3;
/** How much one feed drop grows a fish, and the cap on total growth. */
const GROWTH_PER_FEED = 0.055;

export const ISLAND_X = -3;
export const ISLAND_Z = -3;
/** Keep placed items this far clear of the island's footprint. */
export const ISLAND_CLEAR = 2.35;

export const TANK = {
  /** half-extent of the sand floor that items may occupy */
  half: 2.05,
  floorY: -1.0,
  sandBottom: -2.6,
  waterTop: 2.2,
};

type State = {
  points: number;
  lifetime: number;
  habits: Habit[];
  tasks: Task[];
  items: PlacedItem[];
  sand: string;
  ownedSands: string[];
  lastSeen: string;
  /** when true, nothing in the tank can be moved or sold */
  locked: boolean;
  /** backdrop behind the diorama */
  reefBg: "light" | "dark";
  /** dayKey -> how many times food was dropped that day */
  feeds: Record<string, number>;
  /** dayKey of the last feeding, or null if never fed */
  lastFed: string | null;
  /** what the last rollover did, so the UI can report it once */
  notice: string | null;
  /** true once cloud data has landed (or we know we're local-only) */
  ready: boolean;
};

type Actions = {
  hydrate: (snap: Snapshot) => void;
  setReady: (v: boolean) => void;
  setLocked: (v: boolean) => void;
  setReefBg: (v: "light" | "dark") => void;
  /** one drop of food: grows the fish, and punishes overfeeding */
  recordFeed: () => void;
  clearNotice: () => void;

  addHabit: (name: string, reward: number) => void;
  renameHabit: (id: string, name: string) => void;
  removeHabit: (id: string) => void;
  toggleHabit: (id: string, day?: string) => number;

  addTask: (title: string, reward: number) => void;
  toggleTask: (id: string) => number;
  removeTask: (id: string) => void;
  clearDone: () => void;

  buy: (itemId: string) => boolean;
  moveItem: (uid: string, x: number, z: number) => void;
  sellItem: (uid: string) => void;
  setSand: (id: string) => void;

  rollover: () => void;
};

/** Scatter a new item somewhere plausible, biased away from existing ones. */
function findSpot(items: PlacedItem[]): { x: number; z: number } {
  // The island is solid ground; anything dropped inside its footprint is
  // simply buried and the purchase looks like it did nothing.
  const hasIsland = items.some((i) => i.itemId === "island");
  const clearOfIsland = (x: number, z: number) =>
    !hasIsland || Math.hypot(x - ISLAND_X, z - ISLAND_Z) > ISLAND_CLEAR;

  let best = { x: 0, z: 0 };
  let bestDist = -1;
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() * 2 - 1) * TANK.half;
    const z = (Math.random() * 2 - 1) * TANK.half;
    if (!clearOfIsland(x, z)) continue;
    let nearest = Infinity;
    for (const it of items) {
      const d = (it.x - x) ** 2 + (it.z - z) ** 2;
      if (d < nearest) nearest = d;
    }
    if (nearest > bestDist) {
      bestDist = nearest;
      best = { x, z };
    }
    if (nearest > 0.9) break;
  }
  return best;
}

/** Free scenery so a brand-new tank isn't bare (cloud accounts get these from SQL). */
const starter = (): PlacedItem[] =>
  [
    { itemId: "kelp", x: -1.62, z: 0.78, seed: 0.31 },
    { itemId: "seagrass", x: 0.92, z: 1.48, seed: 0.72 },
    { itemId: "teal-weed", x: -0.44, z: -1.22, seed: 0.18 },
    { itemId: "pebbles", x: 1.38, z: 0.34, seed: 0.55 },
    { itemId: "boulder", x: -1.8, z: -0.62, seed: 0.41 },
    { itemId: "brain", x: 0.48, z: -0.18, seed: 0.63 },
    { itemId: "violet-fan", x: 1.24, z: -1.46, seed: 0.27 },
  ].map((s) => ({
    ...s,
    uid: uid(),
    rot: Math.random() * Math.PI * 2,
    scale: 0.92 + Math.random() * 0.16,
  }));

export const useReef = create<State & Actions>()(
  persist(
    (set, get) => ({
      points: 60,
      lifetime: 60,
      habits: [],
      tasks: [],
      items: starter(),
      sand: DEFAULT_SAND,
      ownedSands: [DEFAULT_SAND],
      lastSeen: dayKey(),
      locked: false,
      reefBg: "light",
      feeds: {},
      lastFed: null,
      notice: null,
      ready: false,

      hydrate: (snap) =>
        set((s) => {
          // growth and ailing live only on the device: the cloud tables
          // have no columns for them, so a snapshot's items carry neither.
          // Without this merge every cloud load would silently reset every
          // fish to newborn and cure every sickness.
          const prev = new Map(s.items.map((i) => [i.uid, i]));
          return {
            ...snap,
            items: snap.items.map((i) => {
              const p = prev.get(i.uid);
              return p ? { ...i, growth: p.growth, ailing: p.ailing } : i;
            }),
            ready: true,
          };
        }),
      setReady: (v) => set({ ready: v }),
      setLocked: (v) => set({ locked: v }),
      setReefBg: (v) => set({ reefBg: v }),
      clearNotice: () => set({ notice: null }),

      recordFeed: () => {
        const today = dayKey();
        const s = get();
        const count = (s.feeds[today] ?? 0) + 1;
        const feeds = { ...s.feeds, [today]: count };

        const fishIds = new Set(
          s.items.filter((i) => BY_ID[i.itemId]?.category === "fish").map((i) => i.uid),
        );
        if (fishIds.size === 0) {
          set({ feeds, lastFed: today });
          return;
        }

        const overfed = count > MAX_FEEDS_PER_DAY;
        let notice: string | null = null;

        // Only one fish sickens per day from overfeeding — the offence is
        // "you overfed today", not "you dropped one pellet too many".
        const alreadySick = s.items.some((i) => i.ailing === "overfed");
        const victim =
          overfed && !alreadySick
            ? s.items.find((i) => fishIds.has(i.uid) && !i.ailing)
            : undefined;
        if (victim) {
          notice = `You overfed today. A ${BY_ID[victim.itemId]?.name ?? "fish"} is sick — stop feeding, or it won't last the day.`;
        }

        set({
          feeds,
          lastFed: today,
          notice: notice ?? s.notice,
          items: s.items.map((i) => {
            if (!fishIds.has(i.uid)) return i;
            const next = { ...i };
            // eating always grows a fish, right up to the cap
            next.growth = Math.min(1, (i.growth ?? 0) + GROWTH_PER_FEED);
            if (victim && i.uid === victim.uid) {
              next.ailing = "overfed";
            } else if (!overfed && i.ailing === "hunger") {
              // a proper feed cures hunger; it cannot cure overfeeding
              next.ailing = null;
            }
            return next;
          }),
        });
      },

      addHabit: (name, reward) => {
        const habit: Habit = {
          id: uid(),
          name: name.trim(),
          reward,
          createdAt: dayKey(),
          log: {},
        };
        set((s) => ({ habits: [...s.habits, habit] }));
        cloud.insertHabit(habit, get().habits.length);
      },

      renameHabit: (id, name) => {
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, name: name.trim() } : h)),
        }));
        cloud.updateHabit(id, { name: name.trim() });
      },

      removeHabit: (id) => {
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
        cloud.deleteHabit(id);
      },

      toggleHabit: (id, day = dayKey()) => {
        const habit = get().habits.find((h) => h.id === id);
        if (!habit) return 0;
        const on = !habit.log[day];
        const delta = on ? habit.reward : -habit.reward;

        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;
            const log = { ...h.log };
            if (on) log[day] = true;
            else delete log[day];
            return { ...h, log };
          }),
          points: Math.max(0, s.points + delta),
          lifetime: on ? s.lifetime + habit.reward : s.lifetime,
        }));

        cloud.setHabitLog(id, day, on);
        cloud.profile({ points: get().points, lifetime: get().lifetime });
        return delta;
      },

      addTask: (title, reward) => {
        const task: Task = {
          id: uid(),
          title: title.trim(),
          reward,
          day: dayKey(),
          done: false,
          completedAt: null,
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        cloud.insertTask(task);
      },

      toggleTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return 0;
        const on = !task.done;
        const delta = on ? task.reward : -task.reward;
        const completedAt = on ? dayKey() : null;

        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: on, completedAt } : t)),
          points: Math.max(0, s.points + delta),
          lifetime: on ? s.lifetime + task.reward : s.lifetime,
        }));

        cloud.updateTask(id, { done: on, completed_at: completedAt });
        cloud.profile({ points: get().points, lifetime: get().lifetime });
        return delta;
      },

      removeTask: (id) => {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
        cloud.deleteTasks([id]);
      },

      clearDone: () => {
        const ids = get()
          .tasks.filter((t) => t.done)
          .map((t) => t.id);
        set((s) => ({ tasks: s.tasks.filter((t) => !t.done) }));
        cloud.deleteTasks(ids);
      },

      buy: (itemId) => {
        const item = BY_ID[itemId];
        const s = get();
        if (!item || s.points < item.cost) return false;

        if (item.category === "sand") {
          if (s.ownedSands.includes(itemId)) {
            set({ sand: itemId });
            cloud.profile({ sand: itemId });
            return true;
          }
          const ownedSands = [...s.ownedSands, itemId];
          const points = s.points - item.cost;
          set({ points, ownedSands, sand: itemId });
          cloud.profile({ points, owned_sands: ownedSands, sand: itemId });
          return true;
        }

        // The island is a fixed corner feature: one per tank, always in
        // the same spot, never rotated or rescaled.
        const isIsland = itemId === "island";
        if (isIsland && s.items.some((i) => i.itemId === "island")) return false;

        const placed: PlacedItem = {
          uid: uid(),
          itemId,
          ...(isIsland ? { x: ISLAND_X, z: ISLAND_Z } : findSpot(s.items)),
          rot: isIsland ? 0 : Math.random() * Math.PI * 2,
          scale: isIsland ? 1 : 0.9 + Math.random() * 0.25,
          seed: Math.random(),
        };
        const points = s.points - item.cost;
        set({ points, items: [...s.items, placed] });
        cloud.insertItem(placed);
        cloud.profile({ points });
        return true;
      },

      moveItem: (id, x, z) => {
        // Guarded here rather than only in the UI: the drag handler, a
        // stray pointer event and any future caller all funnel through
        // this, so the lock cannot be routed around.
        if (get().locked) return;
        set((s) => ({ items: s.items.map((i) => (i.uid === id ? { ...i, x, z } : i)) }));
        cloud.moveItem(id, x, z);
      },

      sellItem: (id) => {
        const s = get();
        if (s.locked) return;
        const item = s.items.find((i) => i.uid === id);
        if (!item) return;
        const points = s.points + Math.floor((BY_ID[item.itemId]?.cost ?? 0) / 2);
        set({ items: s.items.filter((i) => i.uid !== id), points });
        cloud.deleteItem(id);
        cloud.profile({ points });
      },

      setSand: (id) => {
        if (!get().ownedSands.includes(id)) return;
        set({ sand: id });
        cloud.profile({ sand: id });
      },

      /** Carry unfinished tasks into today and drop stale completed ones. */
      rollover: () => {
        const today = dayKey();
        const s = get();
        if (s.lastSeen === today) return;

        const stale = s.tasks.filter((t) => t.done && t.completedAt !== today);
        const carried = s.tasks.filter((t) => !t.done && t.day !== today);

        // ── fish ─────────────────────────────────────────────────
        // A fish that was still ailing when the day turned over dies. It
        // had the whole of yesterday to be put right, so the player has
        // always had a chance to save it.
        const fish = (i: PlacedItem) => BY_ID[i.itemId]?.category === "fish";
        const doomed = s.items.filter((i) => fish(i) && i.ailing);
        let items = s.items.filter((i) => !(fish(i) && i.ailing));

        const notes: string[] = [];
        for (const d of doomed) {
          const why = d.ailing === "overfed" ? "from overfeeding" : "of hunger";
          notes.push(`Your ${BY_ID[d.itemId]?.name ?? "fish"} died ${why}.`);
        }

        // Starvation is measured from the last feed, not from the last
        // visit — coming back after a week without feeding still counts.
        const hungry = s.lastFed ? daysBetween(s.lastFed, today) : null;
        if (hungry !== null && hungry >= STARVE_DAYS) {
          const victim = items.find((i) => fish(i) && !i.ailing);
          if (victim) {
            items = items.map((i) =>
              i.uid === victim.uid ? { ...i, ailing: "hunger" as const } : i,
            );
            notes.push(
              `Nothing has been fed for ${hungry} days. A ${BY_ID[victim.itemId]?.name ?? "fish"} is starving — feed it today or it dies.`,
            );
          }
        }

        // yesterday's tally is spent; keep only today's
        const feeds = s.feeds[today] !== undefined ? { [today]: s.feeds[today] } : {};

        set({
          lastSeen: today,
          feeds,
          notice: notes.length ? notes.join(" ") : null,
          items,
          tasks: s.tasks
            .filter((t) => !t.done || t.completedAt === today)
            .map((t) => (t.done ? t : { ...t, day: today })),
        });

        doomed.forEach((d) => cloud.deleteItem(d.uid));
        cloud.deleteTasks(stale.map((t) => t.id));
        carried.forEach((t) => cloud.updateTask(t.id, { day: today }));
        cloud.profile({ last_seen: today });
      },
    }),
    {
      name: "reef-store",
      version: 2,
      // v1 data has the same shape; ids just aren't uuids yet
      migrate: (persisted) => persisted as State & Actions,
      partialize: ({ ready, ...rest }) => rest,
    }
  )
);

/** Consecutive completed days ending today (or yesterday, if today is still open). */
export function streakOf(habit: Habit): number {
  const today = dayKey();
  let cursor = habit.log[today] ? today : addDays(today, -1);
  let n = 0;
  while (habit.log[cursor]) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
