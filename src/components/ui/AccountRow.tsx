"use client";

import { useRouter } from "next/navigation";
import { setCloudHydrated, setCloudUser } from "@/lib/cloud";
import { supabase } from "@/lib/supabase/client";

export function AccountRow({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    const db = supabase();
    if (!db) return;
    await db.auth.signOut();
    setCloudUser(null);
    setCloudHydrated(false);
    localStorage.removeItem("reef-store");
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-line px-5 py-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold uppercase text-accent">
        {email.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{email}</span>
      <button
        onClick={signOut}
        className="shrink-0 text-[13px] text-accent transition-opacity hover:opacity-70"
      >
        Sign out
      </button>
    </div>
  );
}
