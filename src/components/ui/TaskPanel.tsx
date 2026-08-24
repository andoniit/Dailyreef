"use client";

import { useReef } from "@/lib/store";
import type { Task } from "@/lib/types";
import { AddRow } from "./AddRow";
import { Check, Coin, Trash } from "./icons";

function TaskRow({ task, onEarn }: { task: Task; onEarn: (n: number) => void }) {
  const toggle = useReef((s) => s.toggleTask);
  const remove = useReef((s) => s.removeTask);

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

      <p
        className={`min-w-0 flex-1 truncate text-[15px] ${
          task.done ? "text-ink-3 line-through" : "text-ink"
        }`}
      >
        {task.title}
      </p>

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

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

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
            {open.length ? `${open.length} to do` : "Just for today"}
          </span>
        )}
      </header>

      <div>
        <div className="divide-hairline overflow-hidden rounded-[14px] border border-line bg-panel">
          {tasks.length === 0 && (
            <p className="px-3.5 py-5 text-[13.5px] leading-relaxed text-ink-2">
              One-off things for today. Anything you don&apos;t finish rolls over
              to tomorrow.
            </p>
          )}
          <ul className="divide-hairline">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} onEarn={onEarn} />
            ))}
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onEarn={onEarn} />
            ))}
          </ul>
          <AddRow placeholder="Add a task" rewards={[5, 10, 20]} onAdd={addTask} />
        </div>
      </div>
    </section>
  );
}
