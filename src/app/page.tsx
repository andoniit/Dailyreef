"use client";

import { useEffect, useRef, useState } from "react";
import { AquariumPanel } from "@/components/AquariumPanel";
import { HabitPanel } from "@/components/ui/HabitPanel";
import { TaskPanel } from "@/components/ui/TaskPanel";
import { Coin } from "@/components/ui/icons";
import { prettyDate } from "@/lib/date";
import { useReef } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { useSession } from "@/components/SessionGate";
import { AccountRow } from "@/components/ui/AccountRow";
import { Contributions } from "@/components/ui/Contributions";
import { MonthlyGoal } from "@/components/ui/MonthlyGoal";
import { HowItWorks } from "@/components/ui/HowItWorks";

type Flash = { id: number; delta: number };

export default function Home() {
  const hydrated = useHydrated();
  const { account, ready } = useSession();
  const loaded = hydrated && ready;
  const points = useReef((s) => s.points);
  const rollover = useReef((s) => s.rollover);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    rollover();
  }, [rollover]);

  function onEarn(delta: number) {
    if (!delta) return;
    const id = nextId.current++;
    setFlashes((f) => [...f, { id, delta }]);
    setTimeout(() => setFlashes((f) => f.filter((x) => x.id !== id)), 1400);
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col-reverse lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="flex w-full shrink-0 flex-col border-line bg-panel-2 lg:w-[360px] lg:border-r">
        <header className="flex shrink-0 items-center gap-4 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-ink">
              DailyReef
            </h1>
            <p className="mt-1.5 truncate text-[13.5px] text-ink-2">{prettyDate()}</p>
          </div>

          <div className="relative ml-auto flex items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <Coin className="h-[17px] w-[17px] text-coin" />
            <span className="text-[15px] font-semibold tabular-nums text-ink">
              {loaded ? points : 0}
            </span>
            <div className="pointer-events-none absolute -top-1 left-1/2">
              {flashes.map((f) => (
                <span
                  key={f.id}
                  className={`animate-float-up absolute -translate-x-1/2 whitespace-nowrap text-[13px] font-semibold ${
                    f.delta > 0 ? "text-accent" : "text-ink-3"
                  }`}
                >
                  {f.delta > 0 ? `+${f.delta}` : f.delta}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6 pt-2">
          {loaded ? <HabitPanel onEarn={onEarn} /> : <PanelSkeleton title="Habits" />}
          {loaded ? <TaskPanel onEarn={onEarn} /> : <PanelSkeleton title="Tasks" />}
          {loaded && <MonthlyGoal />}
          {loaded && <Contributions />}
          {/* rules live at the bottom of the sidebar, out of the way until
              they're wanted */}
          {loaded && <HowItWorks />}
        </div>

        {account && <AccountRow email={account.email} />}
      </aside>

      <main className="min-h-[54vh] flex-1 p-4 lg:min-h-0 lg:p-5">
        <AquariumPanel />
      </main>
    </div>
  );
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <section className="flex flex-col">
      <header className="px-1 pb-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      </header>
      <div className="h-24 rounded-[14px] border border-line bg-panel" />
    </section>
  );
}
