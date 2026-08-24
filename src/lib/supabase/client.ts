"use client";

import { createBrowserClient } from "@supabase/ssr";
import { HAS_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client, or null when the project isn't configured yet. */
export function supabase() {
  if (!HAS_SUPABASE) return null;
  if (!cached) cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
