"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BY_ID } from "@/lib/catalog";
import { ISLAND_SPOTS, MAX_FEEDS_PER_DAY, islandSpotAt, useReef } from "@/lib/store";
import { dayKey } from "@/lib/date";
import { Cart, Coin, Food, Lock, Moon, Sun, Unlock } from "./ui/icons";
import { Shop } from "./ui/Shop";

const Tank = dynamic(() => import("./aquarium/Tank"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-[13px] text-ink-3">
      Filling the tank…
    </div>
  ),
});

/**
 * The panel carries its own light/dark palette rather than driving the
 * app-wide theme tokens: the sidebar stays white either way, and only the
 * backdrop behind the diorama flips.
 */
const skin = {
  light: {
    shell: "border-line bg-gradient-to-b from-white to-[#eef3f8]",
    chrome: "border-line bg-panel/92 text-ink hover:bg-panel",
    chromeOn: "border-accent/35 bg-accent-soft text-accent hover:bg-accent-soft",
    card: "border-line bg-panel/92",
    title: "text-ink",
    sub: "text-ink-3",
    sell: "border-line text-ink-2 hover:border-danger hover:text-danger",
  },
  dark: {
    shell: "border-white/10 bg-gradient-to-b from-[#141d2a] to-[#070b11]",
    chrome: "border-white/12 bg-white/10 text-white hover:bg-white/[0.17]",
    chromeOn: "border-[#6cc3ff]/40 bg-[#6cc3ff]/20 text-[#9ad8ff] hover:bg-[#6cc3ff]/25",
    card: "border-white/12 bg-[#131c28]/88",
    title: "text-white",
    sub: "text-white/50",
    sell: "border-white/15 text-white/70 hover:border-danger hover:text-danger",
  },
} as const;

export function AquariumPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  // deliberately not persisted — feed mode is a momentary activity, and
  // reloading into it would swallow the next click meant for an item
  const [feeding, setFeeding] = useState(false);
  const items = useReef((s) => s.items);
  const sellItem = useReef((s) => s.sellItem);
  const locked = useReef((s) => s.locked);
  const setLocked = useReef((s) => s.setLocked);
  const reefBg = useReef((s) => s.reefBg);
  const setReefBg = useReef((s) => s.setReefBg);
  const feedsToday = useReef((s) => s.feeds[dayKey()] ?? 0);
  const notice = useReef((s) => s.notice);
  const clearNotice = useReef((s) => s.clearNotice);
  const ailing = useReef(
    (s) => s.items.filter((i) => i.ailing).length,
  );
  const setIslandSpot = useReef((s) => s.setIslandSpot);

  const dark = reefBg === "dark";
  const s = dark ? skin.dark : skin.light;

  const sel = items.find((i) => i.uid === selected);
  const selItem = sel ? BY_ID[sel.itemId] : null;
  const refund = selItem ? Math.floor(selItem.cost / 2) : 0;
  const isFish = selItem?.category === "fish";
  const isIsland = sel?.itemId === "island";
  const currentSpot = sel && isIsland ? islandSpotAt(sel.x, sel.z).id : null;

  const btn =
    "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px] font-medium shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-colors";

  return (
    <section
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors duration-300 ${s.shell}`}
    >
      <div className="min-h-0 flex-1">
        <Tank selected={selected} onSelect={setSelected} feeding={feeding} />
      </div>

      {/* selection card */}
      {selItem && sel && (
        <div
          className={`animate-pop-in absolute bottom-3 left-3 flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl ${s.card}`}
        >
          <div>
            <p className={`text-[13px] font-medium ${s.title}`}>{selItem.name}</p>
            <p className={`text-[11px] ${s.sub}`}>
              {locked
                ? "Locked — unlock to move or sell"
                : isIsland
                  ? "Part of the tank — choose where it sits"
                  : sel.gift
                    ? "A free pick — yours for good"
                  : isFish
                    ? "Swims freely"
                    : "Drag on the sand to move"}
            </p>
            {/* The island is anchored rather than draggable, so its
                placement needs explicit controls. */}
            {isIsland && !locked && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {ISLAND_SPOTS.map((spot) => (
                  <button
                    key={spot.id}
                    onClick={() => setIslandSpot(spot.id)}
                    aria-pressed={currentSpot === spot.id}
                    className={`rounded-full border px-2 py-0.5 text-[11.5px] font-medium transition-colors ${
                      currentSpot === spot.id ? s.chromeOn : s.chrome
                    }`}
                  >
                    {spot.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Gifts and the island are fixtures, so there is nothing to
              sell them for. Showing a dead Sell button would just invite
              a click that does nothing. */}
          {!locked && !sel.gift && !isIsland && (
            <button
              onClick={() => {
                sellItem(sel.uid);
                setSelected(null);
              }}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${s.sell}`}
            >
              Sell
              <span className="flex items-center gap-0.5 text-coin">
                <Coin className="h-3 w-3" />
                {refund}
              </span>
            </button>
          )}
        </div>
      )}

      <div className="absolute right-3.5 top-3.5 flex items-center gap-2">
        <button
          onClick={() => setReefBg(dark ? "light" : "dark")}
          className={`${btn} w-9 justify-center px-0 ${s.chrome}`}
          title={dark ? "Light background" : "Dark background"}
          aria-label={dark ? "Switch to light background" : "Switch to dark background"}
        >
          {dark ? <Sun /> : <Moon />}
        </button>

        <button
          onClick={() => setLocked(!locked)}
          className={`${btn} ${locked ? s.chromeOn : s.chrome}`}
          aria-pressed={locked}
          title={locked ? "Unlock the reef" : "Lock the reef"}
        >
          {locked ? <Lock /> : <Unlock />}
          {locked ? "Locked" : "Lock"}
        </button>

        <button
          onClick={() => {
            setFeeding((f) => !f);
            setSelected(null);
          }}
          className={`${btn} ${feeding ? s.chromeOn : s.chrome}`}
          aria-pressed={feeding}
          title={feeding ? "Stop feeding" : "Feed the fish"}
        >
          <Food />
          {feeding ? "Feeding" : "Feed"}
        </button>

        <button onClick={() => setShopOpen(true)} className={`${btn} ${s.chrome}`}>
          <Cart />
          Shop
        </button>
      </div>

      <p
        className={`pointer-events-none absolute bottom-3.5 right-4 text-[11.5px] ${s.sub}`}
      >
        {feeding
          ? `Feeds today ${feedsToday}/${MAX_FEEDS_PER_DAY}${
              feedsToday > MAX_FEEDS_PER_DAY ? " — overfed" : ""
            }`
          : "Drag to rotate"}
      </p>

      {/* Deaths and warnings have to be impossible to miss — losing a fish
          you paid for should never happen silently. */}
      {notice && (
        <div className="animate-pop-in absolute inset-x-3 top-16 mx-auto max-w-md rounded-2xl border border-danger/30 bg-panel/95 px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <p className="text-[13px] leading-snug text-ink">{notice}</p>
          <button
            onClick={clearNotice}
            className="mt-2 text-[12.5px] font-medium text-accent"
          >
            Dismiss
          </button>
        </div>
      )}

      {!notice && ailing > 0 && (
        <div className="pointer-events-none absolute left-3 top-16 rounded-full border border-danger/30 bg-panel/92 px-3 py-1.5 text-[12px] font-medium text-danger shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          {ailing === 1 ? "1 fish is sick" : `${ailing} fish are sick`}
        </div>
      )}

      {shopOpen && <Shop onClose={() => setShopOpen(false)} />}
    </section>
  );
}
