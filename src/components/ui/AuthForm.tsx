"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { HAS_SUPABASE } from "@/lib/supabase/config";

type Mode = "signin" | "signup";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const db = supabase();
    if (!db) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (!data.session) {
        return setNotice("Check your inbox to confirm the address, then sign in.");
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(error.message);
    }

    router.replace("/");
    router.refresh();
  }

  if (!HAS_SUPABASE) {
    return (
      <div className="w-full max-w-[380px] rounded-[18px] border border-line bg-panel p-6 text-[14px] leading-relaxed text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <h1 className="mb-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
          Almost there
        </h1>
        <p>
          Accounts need Supabase keys. Copy{" "}
          <code className="rounded bg-panel-2 px-1 py-0.5 text-[13px]">
            .env.local.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-panel-2 px-1 py-0.5 text-[13px]">.env.local</code>,
          fill in your project URL and anon key, then restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-[380px] rounded-[18px] border border-line bg-panel p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    >
      <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-ink">
        {mode === "signin" ? "Sign in to Reef" : "Create your Reef"}
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-2">
        {mode === "signin"
          ? "Your habits, tasks and tank, on every device."
          : "Start with an empty tank and fill it as you go."}
      </p>

      <label className="mt-6 block text-[13px] font-medium text-ink-2" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-1.5 w-full rounded-[10px] border border-line-strong bg-panel px-3 py-2.5 text-[15px] text-ink outline-none transition-colors focus:border-accent"
      />

      <label className="mt-4 block text-[13px] font-medium text-ink-2" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        required
        minLength={6}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1.5 w-full rounded-[10px] border border-line-strong bg-panel px-3 py-2.5 text-[15px] text-ink outline-none transition-colors focus:border-accent"
      />

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      {notice && <p className="mt-3 text-[13px] text-accent">{notice}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-[10px] bg-accent py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setNotice(null);
        }}
        className="mt-4 w-full text-center text-[13.5px] text-accent transition-opacity hover:opacity-70"
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
