import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { HAS_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** Server Supabase client bound to the request cookies. */
export async function supabaseServer() {
  if (!HAS_SUPABASE) return null;
  const store = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component — middleware refreshes the session
        }
      },
    },
  });
}
