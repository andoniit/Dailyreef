"use client";

import { useState } from "react";
import { tasksDoneInMonth, useReef } from "@/lib/store";
import { dayKey, daysInMonth, monthKey, monthLabel } from "@/lib/date";

/**
 * A target for how many tasks to finish this month, with pace.
 *
 * "On track" is the useful number, not the raw count: 12 of 30 means
 * nothing on its own, but 12 of 30 with 10 days gone tells you whether to
 * push today.
 */
export function MonthlyGoal() {
  const tasks = useReef((s) => s.tasks);
  const goal = useReef((s) => s.monthlyGoal);
  const setGoal = useReef((s) => s.setMonthlyGoal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal));

  const done = tasksDoneInMonth(tasks, monthKey());
  const pct = Math.min(100, Math.round((done / Math.max(1, goal)) * 100));

  const today = dayKey();
  const dayOfMonth = Number(today.slice(8, 10));
  const total = daysInMonth(today);
  const expected = Math.round((goal * dayOfMonth) / total);
  const ahead = done - expected;

  function commit() {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0) setGoal(n);
    else setDraft(String(goal));
    setEditing(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-ink">
          {monthLabel()} goal
        </h2>
        {editing ? (
          <input
            autoFocus
            type="number"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(String(goal));
                setEditing(false);
              }
            }}
            className="w-14 rounded-md border border-line-strong bg-transparent px-1.5 py-0.5 text-right text-[12px] tabular-nums text-ink outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(String(goal));
              setEditing(true);
            }}
            className="text-[11.5px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
          >
            {goal} tasks
          </button>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[22px] font-semibold tabular-nums leading-none text-ink">
          {done}
        </span>
        <span className="text-[12px] text-ink-3">of {goal}</span>
      </div>

      <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-[rgba(0,0,0,0.06)]">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-1.5 text-[11.5px] text-ink-3">
        {done >= goal
          ? "Goal met — anything else is extra."
          : ahead >= 0
            ? `On track — ${ahead} ahead of pace.`
            : `${-ahead} behind pace, ${total - dayOfMonth} days left.`}
      </p>
    </section>
  );
}
