"use client";

import { useState } from "react";
import { addDays, dayKey, relativeDay } from "@/lib/date";
import { Coin, Plus } from "./icons";

/** How far ahead a task may be scheduled, counting today. */
const AHEAD = 8;

/**
 * Creating a task: title, which day, reward.
 *
 * The day strip is the whole point of scheduling ahead — it defaults to
 * today, so the quick case stays one keystroke, but a week is one click
 * away without a date picker.
 */
export function AddTaskRow({
  onAdd,
}: {
  onAdd: (title: string, reward: number, day: string) => void;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [reward, setReward] = useState(10);
  const [day, setDay] = useState(dayKey());

  const days = Array.from({ length: AHEAD }, (_, i) => addDays(dayKey(), i));

  function submit() {
    const t = value.trim();
    if (!t) return;
    onAdd(t, reward, day);
    setValue("");
    // deliberately keeps the chosen day: filling a whole day in one go is
    // the common case, and resetting to today each time fights that
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
          placeholder="Add a task"
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
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="mr-0.5 shrink-0 text-[12px] text-ink-3">When</span>
            {days.map((d) => (
              <button
                key={d}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setDay(d)}
                className={`shrink-0 rounded-full px-2 py-[3px] text-[12px] font-medium transition-colors ${
                  d === day
                    ? "bg-ink text-white"
                    : "bg-[rgba(0,0,0,0.045)] text-ink-2 hover:text-ink"
                }`}
              >
                {relativeDay(d)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-0.5 text-[12px] text-ink-3">Worth</span>
            {[5, 10, 20].map((r) => (
              <button
                key={r}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setReward(r)}
                className={`flex items-center gap-1 rounded-full px-2 py-[3px] text-[12px] font-medium transition-colors ${
                  r === reward
                    ? "bg-accent text-white"
                    : "bg-[rgba(0,0,0,0.045)] text-ink-2 hover:text-ink"
                }`}
              >
                <Coin className={r === reward ? "h-3 w-3 text-white" : "h-3 w-3 text-coin"} />
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
