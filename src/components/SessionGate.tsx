"use client";

import { useEffect, useState } from "react";
import { loadSnapshot, setCloudUser } from "@/lib/cloud";
import { useReef } from "@/lib/store";
import { HAS_SUPABASE } from "@/lib/supabase/config";
import { supabase } from "@/lib/supabase/client";

export type Account = { id: string; email: string } | null;

/**
 * Resolves the signed-in user, pulls their data into the store, and keeps
 * the store pointed at the right account. Local-only when Supabase is unset.
 */
export function useSession(): { account: Account; ready: boolean } {
  const hydrate = useReef((s) => s.hydrate);
  const setReady = useReef((s) => s.setReady);
  const ready = useReef((s) => s.ready);
  const [account, setAccount] = useState<Account>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const db = supabase();
      if (!HAS_SUPABASE || !db) {
        setReady(true);
        return;
      }

      const {
        data: { user },
      } = await db.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setCloudUser(null);
        setReady(true);
        return;
      }

      setAccount({ id: user.id, email: user.email ?? "" });
      setCloudUser(user.id);

      const snap = await loadSnapshot();
      if (cancelled) return;
      if (snap) hydrate(snap);
      else setReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [hydrate, setReady]);

  return { account, ready };
}
