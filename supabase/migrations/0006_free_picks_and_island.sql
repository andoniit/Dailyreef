-- Free starter picks, and the island as a permanent fixture.
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- Safe to re-run: every statement is guarded.

-- ── items can be gifts, which are never sellable ──────────────────
alter table public.aquarium_items
  add column if not exists gift boolean not null default false;

-- ── profiles remember which free picks have been taken ────────────
-- One pick per category, ever. Stored as the category names claimed.
alter table public.profiles
  add column if not exists free_claimed text[] not null default '{}';

-- ── every tank gets an island ─────────────────────────────────────
-- The island is part of the tank rather than something you own, so any
-- profile without one is given one at the default back corner (-3, -3).
insert into public.aquarium_items (user_id, item_id, x, z, rot, scale, seed, gift)
select p.id, 'island', -3, -3, 0, 1, 0.42, false
from public.profiles p
where not exists (
  select 1 from public.aquarium_items a
  where a.user_id = p.id and a.item_id = 'island'
);

-- ── and never more than one ───────────────────────────────────────
-- Guards against an older client having inserted a second one.
delete from public.aquarium_items a
using public.aquarium_items b
where a.item_id = 'island'
  and b.item_id = 'island'
  and a.user_id = b.user_id
  and a.ctid > b.ctid;

create unique index if not exists aquarium_items_one_island
  on public.aquarium_items (user_id)
  where item_id = 'island';
