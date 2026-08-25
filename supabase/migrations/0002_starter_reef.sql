-- A new tank used to open with three items and no coins, which reads as
-- empty. This seeds a small composed reef instead, plus a welcome grant
-- so the shop is usable on day one.
--
-- Fish are deliberately NOT included: they stay the thing you earn.

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

-- signup: profile (with a welcome grant) + the starter reef
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, points, lifetime)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    60,
    60
  )
  on conflict (id) do nothing;

  perform public.seed_starter_reef(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── Backfill an account that already signed up ────────────────────
-- The trigger only fires on signup, so an existing tank stays as it was.
-- Replace the address, then run these two statements:
--
--   select public.seed_starter_reef(id) from auth.users
--    where email = 'you@example.com';
--
--   update public.profiles set points = points + 60, lifetime = lifetime + 60
--    where id = (select id from auth.users where email = 'you@example.com');
