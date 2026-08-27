"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/habits";
import { MAX_FEEDS_PER_DAY, STARVE_DAYS } from "@/lib/store";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-[12.5px] font-semibold text-ink">{title}</h3>
      <div className="space-y-1 text-[12.5px] leading-relaxed text-ink-2">
        {children}
      </div>
    </div>
  );
}

/**
 * The rules, in the footer.
 *
 * Everything here is a live consequence of a constant in the code rather
 * than a number typed into prose — the feeding limits especially, since
 * those can delete a fish and must never drift out of date.
 */
export function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
      >
        <span className="text-[13px] font-semibold text-ink">How it works</span>
        <span
          className={`text-[11px] text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="space-y-3.5 border-t border-line px-3.5 py-3.5">
          <Section title="Habits repeat, tasks don't">
            <p>
              A <strong className="font-medium text-ink">habit</strong> is
              something you want to do every day — it comes back each morning
              and keeps a streak. A{" "}
              <strong className="font-medium text-ink">task</strong> is a
              one-off. Check either one off to earn coins.
            </p>
          </Section>

          <Section title="You set what things are worth">
            <p>
              Every habit and task carries the reward you chose for it. Looking
              after yourself is what this app is for, so those categories pay
              the most:
            </p>
            <ul className="mt-1 space-y-0.5">
              {/* Two columns, not one line: name and reward tiers together
                  with the hint wrap and the numbers break mid-ladder at
                  sidebar width. The hint moves to the tooltip. */}
              {CATEGORIES.map((c) => (
                <li
                  key={c.id}
                  title={c.hint}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      className="h-[7px] w-[7px] shrink-0 self-center rounded-full"
                      style={{ background: c.tint }}
                    />
                    <span className="truncate text-ink">{c.label}</span>
                    {c.core && <span className="text-[10px] text-coin">★</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-3">
                    {c.rewards.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              Starred categories sort to the top of your habit list. The
              category is guessed from what you type, and you can override it.
            </p>
          </Section>

          <Section title="Planning ahead">
            <p>
              Tasks can be scheduled up to a week out — pick the day when you
              add one, or use the arrow on a task to push it to the next day.
              Anything you don&apos;t finish rolls forward to today; tasks
              scheduled for a future day stay put until that day arrives.
            </p>
            <p>
              Set a monthly goal for how many tasks you want to finish, and the
              panel tells you whether you&apos;re ahead of or behind pace.
            </p>
          </Section>

          <Section title="The activity grid">
            <p>
              One square per day, darker the more you completed — habits ticked
              plus tasks finished. Dashed squares are days that haven&apos;t
              happened yet.
            </p>
          </Section>

          <Section title="Free picks">
            <p>
              The shop&apos;s <strong className="font-medium text-ink">Free</strong>{" "}
              tab gives you one item of your choosing from each of four
              groups — a fish, a plant, a stone and a coral — to start the
              reef off. They cost nothing and can never be sold.
            </p>
          </Section>

          <Section title="Spending coins">
            <p>
              Coins buy fish, plants, coral, rock and decor in the shop. Drag
              anything on the sand to move it, or sell it back for half.
            </p>
            <p>
              The palm island comes with every tank and can&apos;t be sold —
              select it to move it between the four corners and the centre.
            </p>
            <p>
              Lock the reef to stop yourself moving or selling things by
              accident.
            </p>
          </Section>

          <Section title="Feeding fish">
            <p>
              Hit <strong className="font-medium text-ink">Feed</strong> and
              click in the water to drop food. Fish that eat grow bigger, up to
              about half as large again.
            </p>
            <p className="text-danger">
              Feeding more than {MAX_FEEDS_PER_DAY} times in one day kills a
              fish on the spot, once per drop over the limit. Going{" "}
              {STARVE_DAYS} days without feeding makes a fish start starving —
              it sinks to the bottom and stops swimming, and dies at the next
              rollover unless you feed it.
            </p>
          </Section>
        </div>
      )}
    </section>
  );
}
