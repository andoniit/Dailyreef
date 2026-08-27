"use client";

import { useMemo, useState } from "react";
import { useReef } from "@/lib/store";
import { addDays, dayKey, relativeDay } from "@/lib/date";
import type { Task } from "@/lib/types";
import { AddTaskRow } from "./AddTaskRow";
import { Check, Coin, Trash } from "./icons";

/** How far ahead a task may be scheduled. */
export const AHEAD_DAYS = 7;

function TaskRow({ task, onEarn }: { task: Task; onEarn: (n: number) => void }) {
  const toggle = useReef((s) => s.toggleTask);
  const remove = useReef((s) => s.removeTask);
  const rename = useReef((s) => s.renameTask);
  const moveDay = useReef((s) => s.moveTaskToDay);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const today = dayKey();
  const overdue = !task.done && task.day < today;

  function commit() {
    const t = draft.trim();
    if (t && t !== task.title) rename(task.id, t);
    else setDraft(task.title);
    setEditing(false);
  }

  return (
    <li className="group flex items-center gap-3 px-3.5 py-3">
      <button
        onClick={() => onEarn(toggle(task.id))}
        aria-label={task.done ? `Undo ${task.title}` : `Complete ${task.title}`}
        className={`grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full border transition-all active:scale-90 ${
          task.done
            ? "border-accent bg-accent text-white"
            : "border-line-strong text-transparent hover:border-accent"
        }`}
      >
        <Check className="h-3 w-3" />
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={`min-w-0 flex-1 truncate text-left text-[15px] ${
            task.done ? "text-ink-3 line-through" : "text-ink"
          }`}
        >
          {task.title}
          {overdue && (
            <span className="ml-1.5 text-[11px] font-medium text-danger">
              overdue
            </span>
          )}
        </button>
      )}

      {/* Push a task to tomorrow without deleting and retyping it. */}
      {!task.done && (
        <button
          onClick={() => moveDay(task.id, addDays(task.day < today ? today : task.day, 1))}
          title="Push to the next day"
          aria-label={`Push ${task.title} to the next day`}
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-ink-3 opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover:opacity-100"
        >
          →
        </button>
      )}

      <span
        className={`flex shrink-0 items-center gap-1 text-[13px] font-medium tabular-nums ${
          task.done ? "text-ink-3" : "text-ink-2"
        }`}
      >
        <Coin className={`h-3.5 w-3.5 ${task.done ? "text-ink-3" : "text-coin"}`} />
        {task.reward}
      </span>

      <button
        onClick={() => remove(task.id)}
        aria-label={`Delete ${task.title}`}
        className="-mr-1 shrink-0 rounded-full p-1 text-ink-3 opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
      >
        <Trash />
      </button>
    </li>
  );
}

export function TaskPanel({ onEarn }: { onEarn: (n: number) => void }) {
  const tasks = useReef((s) => s.tasks);
  const addTask = useReef((s) => s.addTask);
  const clearDone = useReef((s) => s.clearDone);

  const today = dayKey();

  /**
   * Grouped by the day they're scheduled for. Overdue tasks are folded
   * into today rather than shown under a past date — they are what you
   * still have to do now, not history.
   */
  const groups = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    const by = new Map<string, Task[]>();
    for (const t of open) {
      const key = t.day < today ? today : t.day;
      const list = by.get(key);
      if (list) list.push(t);
      else by.set(key, [t]);
    }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, today]);

  const open = tasks.filter((t) => !t.done);
  // Only today's completions. Finished tasks are now kept as history for
  // the monthly goal and the activity grid, so listing every one of them
  // would fill this panel with months of past work.
  const done = tasks.filter((t) => t.done && t.completedAt === today);
  const todayCount = open.filter((t) => t.day <= today).length;

  return (
    <section className="flex flex-col">
      <header className="flex items-baseline justify-between px-1 pb-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Tasks</h2>
        {done.length > 0 ? (
          <button
            onClick={clearDone}
            className="text-[13px] text-accent transition-opacity hover:opacity-70"
          >
            Clear {done.length} done
          </button>
        ) : (
          <span className="text-[13px] tabular-nums text-ink-2">
            {todayCount ? `${todayCount} to do today` : "Nothing due today"}
          </span>
        )}
      </header>

      <div className="divide-hairline overflow-hidden rounded-[14px] border border-line bg-panel">
        {tasks.length === 0 && (
          <p className="px-3.5 py-5 text-[13.5px] leading-relaxed text-ink-2">
            One-off things to do. Schedule them up to a week ahead — anything
            you don&apos;t finish rolls over to today.
          </p>
        )}

        {groups.map(([day, list]) => (
          <div key={day}>
            {/* Only label a group when it isn't today; a lone "Today"
                heading above the only group is noise. */}
            {(day !== today || groups.length > 1) && (
              <p className="bg-[rgba(0,0,0,0.018)] px-3.5 py-1.5 text-[11.5px] font-medium text-ink-2">
                {relativeDay(day)}
              </p>
            )}
            <ul className="divide-hairline">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} onEarn={onEarn} />
              ))}
            </ul>
          </div>
        ))}

        {done.length > 0 && (
          <ul className="divide-hairline">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onEarn={onEarn} />
            ))}
          </ul>
        )}

        <AddTaskRow onAdd={addTask} />
      </div>
    </section>
  );
}
