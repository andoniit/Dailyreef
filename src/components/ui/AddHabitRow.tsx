"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, CATEGORY_BY_ID, guessCategory } from "@/lib/habits";
import type { HabitCategory } from "@/lib/types";
import { Coin, Plus } from "./icons";

/**
 * Creating a habit: name, category, reward.
 *
 * The category is guessed from the name as you type, so the common case
 * needs no interaction at all — and because each category carries its own
 * reward ladder, picking "Fitness" is also what makes a gym session worth
 * more than answering email.
 */
export function AddHabitRow({
  onAdd,
}: {
  onAdd: (name: string, reward: number, category: HabitCategory) => void;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [category, setCategory] = useState<HabitCategory>("selfcare");
  /** true until the user picks a category by hand; then guessing stops */
  const [auto, setAuto] = useState(true);
  const [reward, setReward] = useState<number | null>(null);

  const def = CATEGORY_BY_ID[category];

  // re-guess while the user is still typing and hasn't overridden it
  useEffect(() => {
    if (!auto || !value.trim()) return;
    const guess = guessCategory(value);
    setCategory((prev) => (prev === guess ? prev : guess));
  }, [value, auto]);

  // a reward that isn't on the new category's ladder would be stranded
  const tiers = def.rewards;
  const active = reward !== null && tiers.includes(reward) ? reward : tiers[1];

  function submit() {
    const t = value.trim();
    if (!t) return;
    onAdd(t, active, category);
    setValue("");
    setReward(null);
    setAuto(true);
  }

  const open = focused || value.length > 0;

  return (
    <div className="px-3.5">
      <div className="flex items-center gap-3 py-2.5">
        <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Plus className="h-3.5 w-3.5" />
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Add a habit"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        {value.trim() && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={submit}
            className="shrink-0 rounded-full bg-accent px-3 py-1 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Add
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-2 pb-3 pl-[38px]">
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCategory(c.id);
                  setAuto(false);
                  setReward(null);
                }}
                title={c.hint}
                className={`flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[12px] font-medium transition-colors ${
                  c.id === category
                    ? "bg-ink text-white"
                    : "bg-[rgba(0,0,0,0.045)] text-ink-2 hover:text-ink"
                }`}
              >
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: c.tint }}
                />
                {c.label}
                {c.core && <span className="text-[10px] opacity-70">★</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-0.5 text-[12px] text-ink-3">Worth</span>
            {tiers.map((r) => (
              <button
                key={r}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setReward(r)}
                className={`flex items-center gap-1 rounded-full px-2 py-[3px] text-[12px] font-medium transition-colors ${
                  r === active
                    ? "bg-accent text-white"
                    : "bg-[rgba(0,0,0,0.045)] text-ink-2 hover:text-ink"
                }`}
              >
                <Coin className={r === active ? "h-3 w-3 text-white" : "h-3 w-3 text-coin"} />
                {r}
              </button>
            ))}
            {def.core && (
              <span className="ml-1 text-[11px] text-ink-3">
                pays more — it&apos;s the point
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
