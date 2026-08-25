"use client";

import { supabase } from "./supabase/client";
import type { Habit, PlacedItem, Task } from "./types";

export type Snapshot = {
  points: number;
  lifetime: number;
  habits: Habit[];
  tasks: Task[];
  items: PlacedItem[];
  sand: string;
  ownedSands: string[];
  lastSeen: string;
};

type HabitRow = { id: string; name: string; reward: number; created_at: string };
type TaskRow = {
  id: string;
  title: string;
  reward: number;
  day: string;
  done: boolean;
  completed_at: string | null;
};
type ItemRow = {
  id: string;
  item_id: string;
  x: number;
  z: number;
  rot: number;
  scale: number;
  seed: number;
};

let userId: string | null = null;

/**
 * Writes stay closed until the cloud snapshot has been loaded into the
 * store. zustand's persist middleware rehydrates from localStorage
 * synchronously, so without this gate a mutation fired between mount and
 * fetch pushes stale local state up and overwrites the real record.
 */
let hydrated = false;

export function setCloudUser(id: string | null) {
  userId = id;
  if (id === null) hydrated = false;
}

/** Called once the store holds cloud data and is safe to write back. */
export function setCloudHydrated(v: boolean) {
  hydrated = v;
}

export function cloudOn(): boolean {
  return Boolean(userId && hydrated && supabase());
}

function ready(): boolean {
  return Boolean(userId && hydrated);
}

function warn(label: string) {
  return (res: { error: { message: string } | null } | null) => {
    if (res?.error) console.error(`[reef] ${label}:`, res.error.message);
  };
}

/** Pull everything this user owns into one snapshot. */
export async function loadSnapshot(): Promise<Snapshot | null> {
  const db = supabase();
  if (!db || !userId) return null;

  const [profile, habits, logs, tasks, items] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).maybeSingle(),
    db.from("habits").select("*").eq("user_id", userId).order("position"),
    db.from("habit_logs").select("habit_id, day").eq("user_id", userId),
    db.from("tasks").select("*").eq("user_id", userId).order("created_at"),
    db.from("aquarium_items").select("*").eq("user_id", userId),
  ]);

  const err = profile.error ?? habits.error ?? logs.error ?? tasks.error ?? items.error;
  if (err) {
    console.error("[reef] load failed:", err.message);
    return null;
  }

  const byHabit: Record<string, Record<string, boolean>> = {};
  for (const row of logs.data ?? []) {
    (byHabit[row.habit_id] ??= {})[row.day as string] = true;
  }

  return {
    points: profile.data?.points ?? 0,
    lifetime: profile.data?.lifetime ?? 0,
    sand: profile.data?.sand ?? "sand-shore",
    ownedSands: profile.data?.owned_sands ?? ["sand-shore"],
    lastSeen: profile.data?.last_seen ?? new Date().toISOString().slice(0, 10),
    habits: ((habits.data ?? []) as HabitRow[]).map((h) => ({
      id: h.id,
      name: h.name,
      reward: h.reward,
      createdAt: String(h.created_at).slice(0, 10),
      log: byHabit[h.id] ?? {},
    })),
    tasks: ((tasks.data ?? []) as TaskRow[]).map((t) => ({
      id: t.id,
      title: t.title,
      reward: t.reward,
      day: t.day,
      done: t.done,
      completedAt: t.completed_at,
    })),
    items: ((items.data ?? []) as ItemRow[]).map((i) => ({
      uid: i.id,
      itemId: i.item_id,
      x: i.x,
      z: i.z,
      rot: i.rot,
      scale: i.scale,
      seed: i.seed,
    })),
  };
}

/* ── writes: optimistic, fire and forget ─────────────────────────── */

const moveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const cloud = {
  profile(patch: Partial<Record<string, unknown>>) {
    const db = supabase();
    if (!db || !ready()) return;
    void db.from("profiles").update(patch).eq("id", userId).then(warn("profile"));
  },

  insertHabit(h: Habit, position: number) {
    const db = supabase();
    if (!db || !ready()) return;
    void db
      .from("habits")
      .insert({ id: h.id, user_id: userId, name: h.name, reward: h.reward, position })
      .then(warn("insert habit"));
  },

  updateHabit(id: string, patch: Record<string, unknown>) {
    const db = supabase();
    if (!db || !ready()) return;
    void db.from("habits").update(patch).eq("id", id).then(warn("update habit"));
  },

  deleteHabit(id: string) {
    const db = supabase();
    if (!db || !ready()) return;
    void db.from("habits").delete().eq("id", id).then(warn("delete habit"));
  },

  setHabitLog(habitId: string, day: string, on: boolean) {
    const db = supabase();
    if (!db || !ready()) return;
    if (on) {
      void db
        .from("habit_logs")
        .upsert({ habit_id: habitId, user_id: userId, day })
        .then(warn("log habit"));
    } else {
      void db
        .from("habit_logs")
        .delete()
        .eq("habit_id", habitId)
        .eq("day", day)
        .then(warn("unlog habit"));
    }
  },

  insertTask(t: Task) {
    const db = supabase();
    if (!db || !ready()) return;
    void db
      .from("tasks")
      .insert({
        id: t.id,
        user_id: userId,
        title: t.title,
        reward: t.reward,
        day: t.day,
        done: t.done,
        completed_at: t.completedAt,
      })
      .then(warn("insert task"));
  },

  updateTask(id: string, patch: Record<string, unknown>) {
    const db = supabase();
    if (!db || !ready()) return;
    void db.from("tasks").update(patch).eq("id", id).then(warn("update task"));
  },

  deleteTasks(ids: string[]) {
    const db = supabase();
    if (!db || !ready() || ids.length === 0) return;
    void db.from("tasks").delete().in("id", ids).then(warn("delete tasks"));
  },

  insertItem(i: PlacedItem) {
    const db = supabase();
    if (!db || !ready()) return;
    void db
      .from("aquarium_items")
      .insert({
        id: i.uid,
        user_id: userId,
        item_id: i.itemId,
        x: i.x,
        z: i.z,
        rot: i.rot,
        scale: i.scale,
        seed: i.seed,
      })
      .then(warn("insert item"));
  },

  /** Dragging fires constantly — only the resting position is written. */
  moveItem(uid: string, x: number, z: number) {
    const db = supabase();
    if (!db || !ready()) return;
    clearTimeout(moveTimers[uid]);
    moveTimers[uid] = setTimeout(() => {
      void db.from("aquarium_items").update({ x, z }).eq("id", uid).then(warn("move item"));
    }, 500);
  },

  deleteItem(uid: string) {
    const db = supabase();
    if (!db || !ready()) return;
    clearTimeout(moveTimers[uid]);
    void db.from("aquarium_items").delete().eq("id", uid).then(warn("delete item"));
  },
};
