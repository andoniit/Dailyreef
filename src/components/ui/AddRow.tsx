"use client";

import { useState } from "react";
import { Coin, Plus } from "./icons";

/** Last row of a grouped list: type a title, pick a reward, hit return. */
export function AddRow({
  placeholder,
  rewards,
  onAdd,
}: {
  placeholder: string;
  rewards: number[];
  onAdd: (title: string, reward: number) => void;
}) {
  const [value, setValue] = useState("");
  const [reward, setReward] = useState(rewards[0]);
  const [focused, setFocused] = useState(false);

  function submit() {
    const t = value.trim();
    if (!t) return;
    onAdd(t, reward);
    setValue("");
  }

  const open = focused || value.length > 0;

  return (
    <div className="px-3.5">
      <div className="flex items-center gap-3 py-2.5">
        <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Plus className="h-3.5 w-3.5" />
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        {value.trim() && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={submit}
            className="shrink-0 rounded-full bg-accent px-3 py-1 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Add
          </button>
        )}
      </div>

      {open && (
        <div className="flex items-center gap-1.5 pb-2.5 pl-[38px]">
          <span className="mr-0.5 text-[12px] text-ink-3">Worth</span>
          {rewards.map((r) => (
            <button
              key={r}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setReward(r)}
              className={`flex items-center gap-1 rounded-full px-2 py-[3px] text-[12px] font-medium transition-colors ${
                r === reward
                  ? "bg-accent text-white"
                  : "bg-[rgba(0,0,0,0.045)] text-ink-2 hover:text-ink"
              }`}
            >
              <Coin className={r === reward ? "h-3 w-3 text-white" : "h-3 w-3 text-coin"} />
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
