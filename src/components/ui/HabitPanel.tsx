"use client";

import { sortedHabits, streakOf, useReef } from "@/lib/store";
import { CATEGORY_BY_ID } from "@/lib/habits";
import { dayKey, lastDays, weekdayLetter } from "@/lib/date";
import type { Habit } from "@/lib/types";
import { AddHabitRow } from "./AddHabitRow";
import { Check, Coin, Flame, Trash } from "./icons";

function WeekDots({ habit }: { habit: Habit }) {
  const days = lastDays(7);
  const today = dayKey();
  return (
    <div className="flex items-center gap-[5px]">
      {days.map((d) => {
        const on = !!habit.log[d];
        const isToday = d === today;
        return (
          <span
            key={d}
            title={`${weekdayLetter(d)} · ${d}`}
            className={`h-[6px] w-[6px] rounded-full ${
              on
                ? "bg-accent"
                : isToday
                  ? "bg-transparent ring-[1.5px] ring-inset ring-ink-3"
                  : "bg-[rgba(0,0,0,0.11)]"
            }`}
          />
        );
      })}
    </div>
  );
}

function HabitRow({ habit, onEarn }: { habit: Habit; onEarn: (n: number) => void }) {
  const toggle = useReef((s) => s.toggleHabit);
  const remove = useReef((s) => s.removeHabit);
  const done = !!habit.log[dayKey()];
  const streak = streakOf(habit);

  return (
    <li className="group flex items-center gap-3 px-3.5 py-3">
      <button
        onClick={() => onEarn(toggle(habit.id))}
        aria-label={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
        className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border transition-all active:scale-90 ${
          done
            ? "border-accent bg-accent text-white"
            : "border-line-strong text-transparent hover:border-accent"
        }`}
      >
        <Check />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: CATEGORY_BY_ID[habit.category].tint }}
            title={CATEGORY_BY_ID[habit.category].label}
          />
          <p className={`truncate text-[15px] leading-snug ${done ? "text-ink-2" : "text-ink"}`}>
            {habit.name}
          </p>
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <WeekDots habit={habit} />
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-ink-2">
              <Flame className="h-3 w-3 text-coin" />
              {streak}
            </span>
          )}
        </div>
      </div>

      <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium tabular-nums text-ink-2">
        <Coin className="h-3.5 w-3.5 text-coin" />
        {habit.reward}
      </span>

      <button
        onClick={() => remove(habit.id)}
        aria-label={`Delete ${habit.name}`}
        className="-mr-1 shrink-0 rounded-full p-1 text-ink-3 opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
      >
        <Trash />
      </button>
    </li>
  );
}

export function HabitPanel({ onEarn }: { onEarn: (n: number) => void }) {
  const raw = useReef((s) => s.habits);
  // core self-care categories rise to the top: that ordering is the app
  // saying what it is for
  const habits = sortedHabits(raw);
  const addHabit = useReef((s) => s.addHabit);
  const today = dayKey();
  const doneCount = habits.filter((h) => h.log[today]).length;

  return (
    <section className="flex flex-col">
      <header className="flex items-baseline justify-between px-1 pb-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Habits</h2>
        <span className="text-[13px] tabular-nums text-ink-2">
          {habits.length ? `${doneCount} of ${habits.length} today` : "Repeat every day"}
        </span>
      </header>

      <div>
        <div className="divide-hairline overflow-hidden rounded-[14px] border border-line bg-panel">
          {habits.length === 0 && (
            <p className="px-3.5 py-5 text-[13.5px] leading-relaxed text-ink-2">
              Add the habits you want to repeat every day. Each one you check off
              pays out coins for the reef.
            </p>
          )}
          <ul className="divide-hairline">
            {habits.map((h) => (
              <HabitRow key={h.id} habit={h} onEarn={onEarn} />
            ))}
          </ul>
          <AddHabitRow onAdd={addHabit} />
        </div>
      </div>
    </section>
  );
}
