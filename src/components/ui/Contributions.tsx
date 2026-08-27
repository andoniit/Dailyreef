"use client";

import { useMemo } from "react";
import { completionsOn, useReef } from "@/lib/store";
import { contributionDays, dayKey, monthKey, prettyDate } from "@/lib/date";

const WEEKS = 18;

/** Five steps, so a heavy day is visibly different from a light one. */
function level(n: number, busiest: number): number {
  if (n === 0) return 0;
  if (busiest <= 1) return 4;
  const share = n / busiest;
  if (share <= 0.25) return 1;
  if (share <= 0.5) return 2;
  if (share <= 0.75) return 3;
  return 4;
}

const SHADES = [
  "rgba(0,0,0,0.055)",
  "rgba(45,167,134,0.30)",
  "rgba(45,167,134,0.52)",
  "rgba(45,167,134,0.76)",
  "rgba(45,167,134,1)",
];

/**
 * GitHub-style completion grid: one dot per day, darker the more you got
 * done. Columns are weeks, rows are weekdays.
 */
export function Contributions() {
  const habits = useReef((s) => s.habits);
  const tasks = useReef((s) => s.tasks);

  const { days, counts, busiest, streak, monthTotal } = useMemo(() => {
    const days = contributionDays(WEEKS);
    const counts = days.map((d) => completionsOn(d, habits, tasks));
    const busiest = counts.reduce((a, b) => Math.max(a, b), 0);

    // current run of consecutive days with anything done, ending today
    // (or yesterday, while today is still open)
    const today = dayKey();
    const idxToday = days.indexOf(today);
    let streak = 0;
    if (idxToday >= 0) {
      let i = counts[idxToday] > 0 ? idxToday : idxToday - 1;
      while (i >= 0 && counts[i] > 0) {
        streak++;
        i--;
      }
    }

    const month = monthKey();
    const monthTotal = days.reduce(
      (sum, d, i) => (d.startsWith(month) ? sum + counts[i] : sum),
      0,
    );
    return { days, counts, busiest, streak, monthTotal };
  }, [habits, tasks]);

  const today = dayKey();

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-baseline justify-between px-3.5 pt-3">
        <h2 className="text-[13px] font-semibold text-ink">Activity</h2>
        <span className="text-[11.5px] text-ink-2">
          {streak > 0 ? `${streak} day streak` : "No streak yet"}
        </span>
      </header>

      <div className="overflow-x-auto px-3.5 py-3">
        {/* Columns are weeks. grid-flow-col with 7 rows lays the days out
            down each column, which is the shape the eye expects. */}
        <div
          className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
          role="img"
          aria-label={`Completion activity for the last ${WEEKS} weeks`}
        >
          {days.map((d, i) => {
            const n = counts[i];
            const future = d > today;
            return (
              <span
                key={d}
                title={`${prettyDate(d)} — ${n} completed`}
                className={`h-[10px] w-[10px] rounded-[2.5px] ${
                  d === today ? "ring-[1.5px] ring-ink-3" : ""
                }`}
                style={{
                  background: future ? "transparent" : SHADES[level(n, busiest)],
                  border: future ? "1px dashed rgba(0,0,0,0.10)" : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      <footer className="flex items-center justify-between px-3.5 pb-3 text-[11.5px] text-ink-3">
        <span>{monthTotal} completed this month</span>
        <span className="flex items-center gap-1">
          Less
          {SHADES.map((c) => (
            <span
              key={c}
              className="h-[8px] w-[8px] rounded-[2px]"
              style={{ background: c }}
            />
          ))}
          More
        </span>
      </footer>
    </section>
  );
}
