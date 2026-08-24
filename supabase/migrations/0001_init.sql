-- Reef — schema, row level security and signup trigger.
-- Paste this whole file into the Supabase SQL editor and run it once.

-- ── profile: one row per user, holds the wallet and tank settings ──
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text,
  display_name text,
  points       integer not null default 0,
  lifetime     integer not null default 0,
  sand         text    not null default 'sand-shore',
  owned_sands  text[]  not null default array['sand-shore'],
  last_seen    date    not null default current_date,
  created_at   timestamptz not null default now()
);

-- ── habits: repeat every day ──────────────────────────────────────
create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  reward     integer not null default 10,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits (user_id, position);

-- ── habit_logs: one row per habit per completed day ───────────────
create table if not exists public.habit_logs (
  habit_id uuid not null references public.habits on delete cascade,
  user_id  uuid not null references auth.users on delete cascade,
  day      date not null,
  primary key (habit_id, day)
);
create index if not exists habit_logs_user_idx on public.habit_logs (user_id, day);

-- ── tasks: one-off, rolls over while unfinished ───────────────────
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  title        text not null,
  reward       integer not null default 5,
  day          date not null default current_date,
  done         boolean not null default false,
  completed_at date,
  created_at   timestamptz not null default now()
);
create index if not exists tasks_user_idx on public.tasks (user_id, created_at);

-- ── aquarium_items: everything placed in the tank ─────────────────
create table if not exists public.aquarium_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  item_id    text not null,
  x          real not null default 0,
  z          real not null default 0,
  rot        real not null default 0,
  scale      real not null default 1,
  seed       real not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists aquarium_items_user_idx on public.aquarium_items (user_id);

-- ── row level security: a user only ever sees their own rows ──────
alter table public.profiles       enable row level security;
alter table public.habits         enable row level security;
alter table public.habit_logs     enable row level security;
alter table public.tasks          enable row level security;
alter table public.aquarium_items enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own habits" on public.habits;
create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own habit logs" on public.habit_logs;
create policy "own habit logs" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own items" on public.aquarium_items;
create policy "own items" on public.aquarium_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── give every new signup a profile and a few starter plants ──────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.aquarium_items (user_id, item_id, x, z, rot, scale, seed)
  values
    (new.id, 'seagrass', -1.5,  0.9, 1.2, 1.0, 0.31),
    (new.id, 'seagrass',  1.6, -1.1, 3.4, 0.95, 0.72),
    (new.id, 'pebbles',   0.4,  1.5, 0.6, 1.05, 0.18);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
