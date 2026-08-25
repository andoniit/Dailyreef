-- Drop the five Blender character fish into your tank.
--
-- Safe to re-run: it skips any species already present, so running it
-- twice won't leave you with duplicate fish.
--
-- Swap the address if you're seeding a different account.

insert into public.aquarium_items (user_id, item_id, x, z, rot, scale, seed)
select p.id, f.item_id, 0, 0, 0, 1.0, f.seed
  from public.profiles p
 cross join (values
      ('clownfish', 0.17),
      ('tang',      0.41),
      ('koi',       0.63),
      ('angel',     0.88),   -- betta veiltail
      ('angler',    0.29)    -- anglerfish, the glowing one
   ) as f(item_id, seed)
 where p.email = 'anikap1999@gmail.com'
   and not exists (
     select 1
       from public.aquarium_items a
      where a.user_id = p.id
        and a.item_id = f.item_id
   );

-- seed drives each fish's swim path, so distinct values keep them from
-- tracing the same loop

-- ── check what you ended up with ─────────────────────────────────
select a.item_id, count(*) as copies
  from public.aquarium_items a
  join public.profiles p on p.id = a.user_id
 where p.email = 'anikap1999@gmail.com'
 group by a.item_id
 order by a.item_id;
