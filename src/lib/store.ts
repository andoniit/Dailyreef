"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Habit, HabitCategory, PlacedItem, Task } from "./types";
import { BY_ID, DEFAULT_SAND } from "./catalog";
import { addDays, dayKey, daysBetween, relativeDay } from "./date";
import { DEFAULT_CATEGORY, categoryRank, guessCategory } from "./habits";
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
/** Categories offering a one-off free pick when you start out. */
export const FREE_CATEGORIES = ["fish", "plant", "rock", "coral"] as const;
export type FreeCategory = (typeof FREE_CATEGORIES)[number];

export const MAX_FEEDS_PER_DAY = 10;

/**
 * How long finished tasks are kept.
 *
 * Long enough that the monthly goal and the 18-week contribution grid
 * both read complete history, short enough that the table stays small.
 */
export const RETAIN_DAYS = 400;
export const STARVE_DAYS = 3;
/**
 * Share of a day's tasks that has to be finished to earn the next day's
 * food. Judged once, at rollover: the carry-forward there rewrites `day`
 * on everything still unfinished, so once today has absorbed yesterday's
 * stragglers the ratio cannot be reconstructed.
 */
export const FEED_TASK_RATIO = 0.5;
/** How much one feed drop grows a fish, and the cap on total growth. */
const GROWTH_PER_FEED = 0.055;

/**
 * Where an island may sit. The four corners are quarter islands cut flush
 * by the two tank walls they touch; the centre is a full round one that
 * no wall crosses, so it gets a smaller footprint to leave reef around it.
 */
export type IslandSpot = {
  id: string;
  label: string;
  x: number;
  z: number;
  /** start angle of the fan, and how far it sweeps */
  a0: number;
  span: number;
  /** footprint radius from the anchor */
  r: number;
  /** corners are sliced by the walls; the centre island is not */
  cuts: boolean;
};

const Q = Math.PI / 2;
export const ISLAND_SPOTS: IslandSpot[] = [
  { id: "back",   label: "Back",   x: -3, z: -3, a0: 0,     span: Q, r: 2.15, cuts: true },
  { id: "right",  label: "Right",  x:  3, z: -3, a0: Q,     span: Q, r: 2.15, cuts: true },
  { id: "front",  label: "Front",  x:  3, z:  3, a0: Q * 2, span: Q, r: 2.15, cuts: true },
  { id: "left",   label: "Left",   x: -3, z:  3, a0: Q * 3, span: Q, r: 2.15, cuts: true },
  { id: "centre", label: "Centre", x:  0, z:  0, a0: 0, span: Q * 4, r: 1.55, cuts: false },
];

export const DEFAULT_ISLAND_SPOT = ISLAND_SPOTS[0];

/** The spot an island instance is sitting on, matched by its anchor. */
export function islandSpotAt(x: number, z: number): IslandSpot {
  return (
    ISLAND_SPOTS.find((s) => s.x === x && s.z === z) ?? DEFAULT_ISLAND_SPOT
  );
}

/** Keep placed items this far clear of an island's footprint. */
export const ISLAND_CLEAR = 0.25;

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
  /** how many tasks the user aims to finish this month */
  monthlyGoal: number;
  /** categories whose free starter pick has already been taken */
  freeClaimed: string[];
  /** when true, nothing in the tank can be moved or sold */
  locked: boolean;
  /** backdrop behind the diorama */
  reefBg: "light" | "dark";
  /** dayKey -> how many times food was dropped that day */
  feeds: Record<string, number>;
  /** the day an overfeeding death last happened, so it is capped at one */
  overfedDeath: string | null;
  /** dayKey of the last feeding, or null if never fed */
  lastFed: string | null;
  /** whether today's food was earned by the last day's tasks */
  feedUnlocked: boolean;
  /** the day that verdict was reached for, so a stale one cannot leak */
  feedUnlockedOn: string | null;
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
  /** reposition the island onto one of the allowed spots */
  setIslandSpot: (spotId: string) => void;
  clearNotice: () => void;

  addHabit: (name: string, reward: number, category: HabitCategory) => void;
  setHabitCategory: (id: string, category: HabitCategory) => void;
  setHabitReward: (id: string, reward: number) => void;
  renameHabit: (id: string, name: string) => void;
  removeHabit: (id: string) => void;
  toggleHabit: (id: string, day?: string) => number;

  addTask: (title: string, reward: number, day?: string) => void;
  renameTask: (id: string, title: string) => void;
  moveTaskToDay: (id: string, day: string) => void;
  setMonthlyGoal: (n: number) => void;
  /** take the one free item allowed in its category */
  claimFree: (itemId: string) => boolean;
  /** the island is a fixture: put one back if the tank has none */
  ensureIsland: () => void;
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
  // simply buried and the purchase looks like it did nothing. Measured
  // against where the island actually is, since it can be moved.
  const island = items.find((i) => i.itemId === "island");
  const spot = island ? islandSpotAt(island.x, island.z) : null;
  const clearOfIsland = (x: number, z: number) =>
    !spot || Math.hypot(x - spot.x, z - spot.z) > spot.r + ISLAND_CLEAR;

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
    { itemId: "island", x: DEFAULT_ISLAND_SPOT.x, z: DEFAULT_ISLAND_SPOT.z, seed: 0.42 },
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
      monthlyGoal: 30,
      freeClaimed: [],
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
      feedUnlocked: true,
      feedUnlockedOn: null,
      overfedDeath: null,
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

      setIslandSpot: (spotId) => {
        const s = get();
        if (s.locked) return;
        const spot = ISLAND_SPOTS.find((x) => x.id === spotId);
        const island = s.items.find((i) => i.itemId === "island");
        if (!spot || !island) return;
        set({
          items: s.items.map((i) =>
            i.uid === island.uid ? { ...i, x: spot.x, z: spot.z } : i,
          ),
        });
        cloud.moveItem(island.uid, spot.x, spot.z);
      },

      recordFeed: () => {
        const today = dayKey();
        const s = get();
        if (!canFeed(s)) return;
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

        // Eating always grows a fish, right up to the cap. Applied before
        // any death so the survivors still benefit from the feed.
        let items = s.items.map((i) => {
          if (!fishIds.has(i.uid)) return i;
          const next = { ...i };
          next.growth = Math.min(1, (i.growth ?? 0) + GROWTH_PER_FEED);
          // a feed within the limit cures hunger
          if (!overfed && i.ailing === "hunger") next.ailing = null;
          return next;
        });

        let notice: string | null = s.notice;

        // At most ONE death per day.
        //
        // Charging a fish for every drop past the limit is what emptied a
        // tank of 18 in a single session: once the counter is over, each
        // further tap costs another fish, permanently, with nothing
        // asking whether you meant it. Capping it means a bad day costs
        // one fish rather than the whole reef, and the warning below still
        // makes it clear to stop.
        const alreadyDiedToday = s.overfedDeath === today;

        if (overfed && !alreadyDiedToday) {
          const victim =
            items.find((i) => fishIds.has(i.uid) && i.ailing) ??
            items.find((i) => fishIds.has(i.uid));
          if (victim) {
            items = items.filter((i) => i.uid !== victim.uid);
            const name = BY_ID[victim.itemId]?.name ?? "fish";
            notice =
              `You overfed — ${count} feeds today. Your ${name} died. ` +
              `No more will die today, but stop feeding until tomorrow.`;
            cloud.deleteItem(victim.uid);
          }
        } else if (overfed) {
          notice =
            `Still overfeeding — ${count} feeds today. ` +
            `Nothing more will die today, but the food is going to waste.`;
        }

        set({
          feeds,
          lastFed: today,
          notice,
          items,
          overfedDeath: overfed && !alreadyDiedToday ? today : s.overfedDeath,
        });
        cloud.profile({ last_seen: get().lastSeen });
      },

      addHabit: (name, reward, category = DEFAULT_CATEGORY) => {
        const habit: Habit = {
          id: uid(),
          name: name.trim(),
          reward,
          category,
          createdAt: dayKey(),
          log: {},
        };
        set((s) => ({ habits: [...s.habits, habit] }));
        cloud.insertHabit(habit, get().habits.length);
      },

      setHabitCategory: (id, category) => {
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, category } : h)),
        }));
        cloud.updateHabit(id, { category });
      },

      setHabitReward: (id, reward) => {
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, reward } : h)),
        }));
        cloud.updateHabit(id, { reward });
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

      addTask: (title, reward, day = dayKey()) => {
        const task: Task = {
          id: uid(),
          title: title.trim(),
          reward,
          day,
          done: false,
          completedAt: null,
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        cloud.insertTask(task);
      },

      renameTask: (id, title) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, title: title.trim() } : t)),
        }));
        cloud.updateTask(id, { title: title.trim() });
      },

      moveTaskToDay: (id, day) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, day } : t)),
        }));
        cloud.updateTask(id, { day });
      },

      setMonthlyGoal: (n) => {
        const monthlyGoal = Math.max(1, Math.round(n));
        set({ monthlyGoal });
        cloud.profile({ monthly_goal: monthlyGoal });
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
        // Clears today's finished tasks only. Sweeping every completed
        // task would delete the history the monthly goal counts.
        const today = dayKey();
        const ids = get()
          .tasks.filter((t) => t.done && t.completedAt === today)
          .map((t) => t.id);
        set((s) => ({
          tasks: s.tasks.filter((t) => !(t.done && t.completedAt === today)),
        }));
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
          ...(isIsland
            ? { x: DEFAULT_ISLAND_SPOT.x, z: DEFAULT_ISLAND_SPOT.z }
            : findSpot(s.items)),
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

      /**
       * The island is part of the tank rather than something you own, so
       * every tank has exactly one. Called after the cloud snapshot has
       * landed — doing it during hydrate would fire the insert while the
       * write gate is still closed and it would be dropped silently.
       */
      ensureIsland: () => {
        const s = get();
        if (s.items.some((i) => i.itemId === "island")) return;
        const placed: PlacedItem = {
          uid: uid(),
          itemId: "island",
          x: DEFAULT_ISLAND_SPOT.x,
          z: DEFAULT_ISLAND_SPOT.z,
          rot: 0,
          scale: 1,
          seed: Math.random(),
        };
        set({ items: [...s.items, placed] });
        cloud.insertItem(placed);
      },

      claimFree: (itemId) => {
        const item = BY_ID[itemId];
        const s = get();
        if (!item) return false;
        if (!(FREE_CATEGORIES as readonly string[]).includes(item.category)) return false;
        // one per category, ever
        if (s.freeClaimed.includes(item.category)) return false;

        const placed: PlacedItem = {
          uid: uid(),
          itemId,
          ...findSpot(s.items),
          rot: Math.random() * Math.PI * 2,
          scale: 0.9 + Math.random() * 0.25,
          seed: Math.random(),
          gift: true,
        };
        const freeClaimed = [...s.freeClaimed, item.category];
        set({ items: [...s.items, placed], freeClaimed });
        cloud.insertItem(placed);
        cloud.profile({ free_claimed: freeClaimed });
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
        // Gifts and the island are fixtures, not stock: neither can be
        // turned back into coins. Guarded here rather than only in the UI
        // so nothing else in the app can sell them by accident.
        if (item.gift || item.itemId === "island") return;
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

        // Completed tasks are HISTORY, not clutter, and deleting them was
        // a real bug: tasksDoneInMonth() counts finished tasks, so wiping
        // yesterday's every morning meant the monthly goal could only ever
        // see today and permanently read near zero. The contribution grid
        // lost the same data.
        //
        // Only genuinely ancient ones are dropped, well past any view that
        // reads them, so the table still cannot grow without bound.
        const cutoff = addDays(today, -RETAIN_DAYS);
        const stale = s.tasks.filter(
          (t) => t.done && t.completedAt !== null && t.completedAt < cutoff,
        );
        // Only OVERDUE tasks roll forward. Carrying everything that
        // isn't today would drag next Friday's task back to this morning
        // the moment the date turned over.
        const carried = s.tasks.filter((t) => !t.done && t.day < today);

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

        // ── food ─────────────────────────────────────────────────
        // Whether today gets fed at all is settled by the day that just
        // ended. It has to happen here, before the carry below moves
        // every unfinished task onto today: after that the day's
        // denominator is gone and the ratio reads as if nothing was due.
        const ended = s.tasks.filter((t) => t.day === s.lastSeen);
        const finished = ended.filter((t) => t.done).length;
        // A day with nothing scheduled cannot be failed. Locking someone
        // out for a day they were never given anything to do would let a
        // quiet week starve a tank through no fault of the player's.
        const feedUnlocked =
          ended.length === 0 || finished / ended.length >= FEED_TASK_RATIO;
        if (!feedUnlocked) {
          notes.push(
            `${relativeDay(s.lastSeen)} came in under half — ${finished} of ` +
              `${ended.length} tasks — so there is no food today. Finish half ` +
              `of today's to feed tomorrow.`,
          );
        }

        // yesterday's tally is spent; keep only today's
        const feeds = s.feeds[today] !== undefined ? { [today]: s.feeds[today] } : {};

        set({
          lastSeen: today,
          feeds,
          feedUnlocked,
          feedUnlockedOn: today,
          notice: notes.length ? notes.join(" ") : null,
          items,
          tasks: s.tasks
            .filter((t) => !t.done || (t.completedAt ?? today) >= cutoff)
            .map((t) => (!t.done && t.day < today ? { ...t, day: today } : t)),
        });

        doomed.forEach((d) => cloud.deleteItem(d.uid));
        cloud.deleteTasks(stale.map((t) => t.id));
        carried.forEach((t) => cloud.updateTask(t.id, { day: today }));
        cloud.profile({ last_seen: today });
      },
    }),
    {
      name: "reef-store",
      version: 3,
      migrate: (persisted) => {
        // v2 habits predate categories, and the goal predates nothing —
        // both need a value or the UI reads undefined on first paint.
        const st = persisted as Partial<State>;
        return {
          ...st,
          monthlyGoal: st.monthlyGoal ?? 30,
          habits: (st.habits ?? []).map((h) => ({
            ...h,
            category: h.category ?? guessCategory(h.name),
          })),
        } as State & Actions;
      },
      partialize: ({ ready, ...rest }) => rest,
    }
  )
);

/**
 * Whether food may be dropped today.
 *
 * The verdict is only trusted for the day the rollover reached it for.
 * Anything else — a fresh install, a day whose rollover has not run yet —
 * feeds freely rather than locking someone out on a technicality.
 *
 * An ailing fish lifts the gate outright. Starvation is measured from the
 * last feed and collected at the next rollover, so a locked tank holding
 * a starving fish would be a death that nothing the player did that day
 * could prevent: the warning says "feed it today or it dies", and that
 * has to stay true.
 */
export function canFeed(
  s: Pick<State, "feedUnlocked" | "feedUnlockedOn" | "items">,
): boolean {
  const fish = (i: PlacedItem) => BY_ID[i.itemId]?.category === "fish";
  if (s.items.some((i) => fish(i) && i.ailing)) return true;
  return s.feedUnlockedOn === dayKey() ? s.feedUnlocked : true;
}

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

/**
 * Habits in display order: core self-care categories first, since those
 * are what the app is for, then by the category list's own order.
 */
export function sortedHabits(habits: Habit[]): Habit[] {
  return [...habits].sort(
    (a, b) => categoryRank(a.category) - categoryRank(b.category),
  );
}

/** How much was completed on a given day — habits done plus tasks done. */
export function completionsOn(
  day: string,
  habits: Habit[],
  tasks: Task[],
): number {
  let n = 0;
  for (const h of habits) if (h.log[day]) n++;
  for (const t of tasks) if (t.done && t.completedAt === day) n++;
  return n;
}

/** Tasks finished inside the given month bucket, e.g. "2026-08". */
export function tasksDoneInMonth(tasks: Task[], month: string): number {
  return tasks.filter((t) => t.done && t.completedAt?.startsWith(month)).length;
}
