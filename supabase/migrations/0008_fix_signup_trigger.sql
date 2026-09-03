-- Signup was failing outright with "Database error saving new user".
--
-- 0007 renamed profiles.points to shells. handle_new_user(), last
-- redefined back in 0002, still inserted into `points`. The trigger runs
-- inside the auth service's own transaction, so raising there aborts the
-- insert into auth.users and no account is created at all — and the
-- message the client gets names neither the column nor the table, which
-- is why a rename in one migration went unnoticed until someone tried to
-- sign up.
--
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- The profile is the one thing signup cannot do without: with no row
  -- here the app has no wallet and no sand to stand on, so this is left
  -- to fail loudly.
  --
  -- `display_name` comes from the nickname the sign-up form now asks
  -- for, passed up as user metadata. The split_part fallback keeps
  -- accounts made before that field existed from ending up nameless.
  insert into public.profiles (id, email, display_name, shells, lifetime)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''),
             split_part(new.email, '@', 1)),
    60,
    60
  )
  on conflict (id) do nothing;

  -- Decoration is not worth losing an account over. Seeding used to sit
  -- in the same all-or-nothing block as the profile, which is how a
  -- column rename came to stop people signing up at all; a warning in
  -- the Postgres log is the right price for a tank that comes up bare.
  begin
    perform public.seed_starter_reef(new.id);

    -- 0006 made the island a fixture of every tank but only backfilled
    -- the profiles that already existed, so every signup since has come
    -- up without one.
    insert into public.aquarium_items (user_id, item_id, x, z, rot, scale, seed)
    select new.id, 'island', -3, -3, 0, 1, 0.42
    where not exists (
      select 1 from public.aquarium_items
      where user_id = new.id and item_id = 'island'
    );
  exception when others then
    raise warning 'seeding the starter reef for % failed: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── Accounts caught by the bug ────────────────────────────────────
-- A signup that failed here left nothing behind: auth.users was rolled
-- back with it, so there is no half-made account to repair. Anyone who
-- hit the error simply signs up again once this has run.
--
-- An account that predates 0006 and still has no island gets one:
insert into public.aquarium_items (user_id, item_id, x, z, rot, scale, seed)
select p.id, 'island', -3, -3, 0, 1, 0.42
from public.profiles p
where not exists (
  select 1 from public.aquarium_items a
  where a.user_id = p.id and a.item_id = 'island'
);
