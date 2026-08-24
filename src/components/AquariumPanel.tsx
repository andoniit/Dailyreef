"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BY_ID } from "@/lib/catalog";
import { useReef } from "@/lib/store";
import { Cart, Coin } from "./ui/icons";
import { Shop } from "./ui/Shop";

const Tank = dynamic(() => import("./aquarium/Tank"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-[13px] text-ink-3">
      Filling the tank…
    </div>
  ),
});

export function AquariumPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const items = useReef((s) => s.items);
  const sellItem = useReef((s) => s.sellItem);

  const sel = items.find((i) => i.uid === selected);
  const selItem = sel ? BY_ID[sel.itemId] : null;
  const refund = selItem ? Math.floor(selItem.cost / 2) : 0;
  const isFish = selItem?.category === "fish";

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-line bg-gradient-to-b from-white to-[#eef4fa] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="min-h-0 flex-1">
        <Tank selected={selected} onSelect={setSelected} />
      </div>

      {/* selection card */}
      {selItem && sel && (
        <div className="animate-pop-in absolute bottom-3 left-3 flex items-center gap-3 rounded-2xl border border-line bg-panel/92 px-3.5 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          <div>
            <p className="text-[13px] font-medium text-ink">{selItem.name}</p>
            <p className="text-[11px] text-ink-3">
              {isFish ? "Swims freely" : "Drag on the sand to move"}
            </p>
          </div>
          <button
            onClick={() => {
              sellItem(sel.uid);
              setSelected(null);
            }}
            className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-danger hover:text-danger"
          >
            Sell
            <span className="flex items-center gap-0.5 text-coin">
              <Coin className="h-3 w-3" />
              {refund}
            </span>
          </button>
        </div>
      )}

      <button
        onClick={() => setShopOpen(true)}
        className="absolute right-3.5 top-3.5 flex items-center gap-1.5 rounded-full border border-line bg-panel/92 px-3.5 py-2 text-[13.5px] font-medium text-ink shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-colors hover:bg-panel"
      >
        <Cart />
        Shop
      </button>

      <p className="pointer-events-none absolute bottom-3.5 right-4 text-[11.5px] text-ink-3">
        Drag to rotate
      </p>

      {shopOpen && <Shop onClose={() => setShopOpen(false)} />}
    </section>
  );
}
