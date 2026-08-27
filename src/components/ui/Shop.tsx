"use client";

import { useMemo, useState } from "react";
import { CATALOG, CATEGORY_LABEL } from "@/lib/catalog";
import { FREE_CATEGORIES, useReef } from "@/lib/store";
import type { Category } from "@/lib/types";
import { Close, Coin } from "./icons";
import { ItemThumb } from "./ItemThumb";

/** "free" is a pseudo-tab: the starter picks, not a catalog category. */
type Tab = Category | "free";
const ORDER: Tab[] = ["free", "fish", "plant", "rock", "coral", "decor", "sand"];
const TAB_LABEL: Record<string, string> = { ...CATEGORY_LABEL, free: "Free" };

export function Shop({ onClose }: { onClose: () => void }) {
  const points = useReef((s) => s.points);
  const items = useReef((s) => s.items);
  const ownedSands = useReef((s) => s.ownedSands);
  const sand = useReef((s) => s.sand);
  const buy = useReef((s) => s.buy);
  const setSand = useReef((s) => s.setSand);
  const claimFree = useReef((s) => s.claimFree);
  const freeClaimed = useReef((s) => s.freeClaimed);
  const [tab, setTab] = useState<Tab>("free");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.itemId] = (c[i.itemId] ?? 0) + 1;
    return c;
  }, [items]);

  // The island is a fixture of every tank rather than stock, so it is
  // never listed for sale.
  const shown = CATALOG.filter((i) => i.category === tab && i.id !== "island");
  const unclaimed = FREE_CATEGORIES.filter((c) => !freeClaimed.includes(c));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(0,0,0,0.28)] p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[20px] border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.22)] sm:rounded-[20px]"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">DailyReef shop</h2>
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[14px] font-semibold tabular-nums text-ink">
            <Coin className="h-4 w-4 text-coin" />
            {points}
          </span>
          <button
            onClick={onClose}
            aria-label="Close shop"
            className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <Close />
          </button>
        </header>

        <nav className="scroll-thin flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
          {ORDER.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === c
                  ? "bg-accent-soft text-accent"
                  : "text-ink-2 hover:bg-panel-2"
              }`}
            >
              {TAB_LABEL[c]}
              {c === "free" && unclaimed.length > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-px text-[10.5px] font-semibold text-white">
                  {unclaimed.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {tab === "free" ? (
          <FreePicks
            claimed={freeClaimed}
            counts={counts}
            onClaim={claimFree}
          />
        ) : (
        <div className="scroll-thin grid gap-2 overflow-y-auto p-3 sm:grid-cols-2">
          {shown.map((item) => {
            const isSand = item.category === "sand";
            const owned = isSand ? ownedSands.includes(item.id) : false;
            const equipped = isSand && sand === item.id;
            const affordable = points >= item.cost;
            const count = counts[item.id] ?? 0;

            let label = `Buy`;
            if (equipped) label = "In use";
            else if (owned) label = "Use";

            const disabled = equipped || (!owned && !affordable);

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 p-3"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-panel">
                  <ItemThumb item={item} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[14px] font-medium text-ink">
                    {item.name}
                    {count > 0 && (
                      <span className="rounded-full bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent">
                        {count}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-ink-3">{item.blurb}</p>
                </div>
                <button
                  onClick={() => (owned ? setSand(item.id) : buy(item.id))}
                  disabled={disabled}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold tabular-nums transition-colors ${
                    disabled
                      ? "bg-panel text-ink-3"
                      : owned
                        ? "bg-accent text-white hover:opacity-90"
                        : "bg-accent text-white hover:opacity-90"
                  }`}
                >
                  {owned || equipped ? (
                    label
                  ) : (
                    <>
                      <Coin className="h-3.5 w-3.5" />
                      {item.cost}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}

/**
 * The starter gift: one item free from each of four categories.
 *
 * Grouped by category with the whole category on offer, because the pick
 * is the point — a fixed handout would not need a screen. Claimed items
 * are fixtures afterwards and cannot be sold, which is stated here rather
 * than discovered later when the Sell button is missing.
 */
function FreePicks({
  claimed,
  counts,
  onClaim,
}: {
  claimed: string[];
  counts: Record<string, number>;
  onClaim: (id: string) => boolean;
}) {
  return (
    <div className="scroll-thin overflow-y-auto p-3">
      <p className="mb-3 rounded-xl bg-accent-soft px-3 py-2 text-[12.5px] leading-relaxed text-accent">
        One free pick from each group to start your reef. Free items are
        yours for good — they can&apos;t be sold.
      </p>

      <div className="space-y-4">
        {FREE_CATEGORIES.map((cat) => {
          const taken = claimed.includes(cat);
          const options = CATALOG.filter((i) => i.category === cat);
          return (
            <section key={cat}>
              <header className="mb-1.5 flex items-baseline gap-2 px-0.5">
                <h3 className="text-[13px] font-semibold text-ink">
                  {CATEGORY_LABEL[cat]}
                </h3>
                <span className="text-[11.5px] text-ink-3">
                  {taken ? "already claimed" : "pick one, free"}
                </span>
              </header>

              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((item) => {
                  const count = counts[item.id] ?? 0;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-xl border border-line bg-panel-2 p-3 ${
                        taken ? "opacity-45" : ""
                      }`}
                    >
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-panel">
                        <ItemThumb item={item} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-[14px] font-medium text-ink">
                          {item.name}
                          {count > 0 && (
                            <span className="rounded-full bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent">
                              {count}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[12px] text-ink-3">
                          {item.blurb}
                        </p>
                      </div>
                      <button
                        onClick={() => onClaim(item.id)}
                        disabled={taken}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${
                          taken
                            ? "bg-panel text-ink-3"
                            : "bg-accent text-white hover:opacity-90"
                        }`}
                      >
                        {taken ? "—" : "Free"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
