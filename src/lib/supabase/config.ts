export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Supabase renamed the browser-safe key from "anon" to "publishable".
 * Newer dashboards hand out PUBLISHABLE_KEY, older ones ANON_KEY — accept
 * either so the project works whichever one you copied.
 */
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** False until the project's env vars are filled in — the app then runs on-device. */
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
