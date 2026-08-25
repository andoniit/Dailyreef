-- Backfill tanks that were created before the starter reef existed.
--
-- Self-contained: redefines the seeding function, then applies it. Safe to
-- run more than once — it only touches tanks holding fewer than 5 items.

create or replace function public.seed_starter_reef(target uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.aquarium_items (user_id, item_id, x, z, rot, scale, seed)
  values
    (target, 'kelp',       -1.62,  0.78, 1.20, 1.00, 0.31),
    (target, 'seagrass',    0.92,  1.48, 3.40, 0.95, 0.72),
    (target, 'teal-weed',  -0.44, -1.22, 0.60, 1.05, 0.18),
    (target, 'pebbles',     1.38,  0.34, 2.10, 1.00, 0.55),
    (target, 'boulder',    -1.80, -0.62, 4.80, 0.92, 0.41),
    (target, 'brain',       0.48, -0.18, 1.90, 1.00, 0.63),
    (target, 'violet-fan',  1.24, -1.46, 5.60, 0.95, 0.27);
end;
$$;

do $$
declare
  u record;
  n integer := 0;
begin
  for u in
    select p.id
      from public.profiles p
     where (select count(*) from public.aquarium_items a where a.user_id = p.id) < 5
  loop
    perform public.seed_starter_reef(u.id);
    update public.profiles
       set points = points + 60,
           lifetime = lifetime + 60
     where id = u.id;
    n := n + 1;
  end loop;
  raise notice 'seeded % tank(s)', n;
end $$;

-- Check the result:
select p.email,
       p.points,
       (select count(*) from public.aquarium_items a where a.user_id = p.id) as items
  from public.profiles p;
