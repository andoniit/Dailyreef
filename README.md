# DailyReef

A habit and task tracker that pays you in coins for showing up. Coins buy fish,
plants, stones, coral and sand for a 3D isometric aquarium that grows with you.

- **Habits** — things you repeat every day. Checking one off pays out and extends its streak.
- **Tasks** — one-off things for today. Anything unfinished rolls over to tomorrow.
- **The reef** — spend coins in the shop, drag scenery around the sand, sell anything back for half.

Built with Next.js, React Three Fiber and Tailwind. Works on-device out of the
box; add Supabase keys for accounts and cross-device sync.

## Run it

```bash
npm install
npm run dev
```

## Accounts and sync (optional, free)

1. Create a free project at [supabase.com](https://supabase.com) (500 MB Postgres, 50k monthly users).
2. Open the SQL editor and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Copy `.env.local.example` to `.env.local` and fill in the project URL and anon key
   from **Project Settings → API**.
4. Restart `npm run dev`. The app now requires sign-in and stores everything in Postgres.

Every table is protected by row level security, so a user can only ever read and
write their own rows. Without the env vars the app skips auth entirely and keeps
state in `localStorage`.
