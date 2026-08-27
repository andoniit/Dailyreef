-- Habit categories, monthly task goal.
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- Safe to re-run: every statement is guarded.

-- ── habits gain a category ────────────────────────────────────────
-- Drives both the reward tiers offered and the sort order, so that
-- looking after yourself outranks everything else.
alter table public.habits
  add column if not exists category text not null default 'other';

-- Keep it to the categories the app knows about.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'habits_category_check'
  ) then
    alter table public.habits
      add constraint habits_category_check
      check (category in ('fitness','food','hygiene','selfcare','mind','other'));
  end if;
end $$;

-- ── profiles gain a monthly task goal ─────────────────────────────
alter table public.profiles
  add column if not exists monthly_goal integer not null default 30;

-- ── backfill: guess a category for habits created before this ─────
-- Only touches rows still sitting on the default, so re-running it will
-- not overwrite a category the user has since chosen by hand.
update public.habits set category = 'fitness'
where category = 'other' and name ~* '\m(gym|workout|work out|exercise|run|running|jog|walk|steps|yoga|stretch|swim|cycle|cycling|lift|train|training|sport|pushup|pilates)\M';

update public.habits set category = 'food'
where category = 'other' and name ~* '\m(cook|cooking|meal|breakfast|lunch|dinner|eat|eating|water|hydrate|veg|vegetables|fruit|protein|groceries)\M';

update public.habits set category = 'hygiene'
where category = 'other' and name ~* '\m(bath|bathe|shower|wash|teeth|brush|floss|skincare|shave|hair|groom|clean)\M';

update public.habits set category = 'selfcare'
where category = 'other' and name ~* '\m(sleep|bed|rest|nap|meditate|meditation|breathe|journal|gratitude|therapy|relax|mindful)\M';

update public.habits set category = 'mind'
where category = 'other' and name ~* '\m(read|reading|book|study|learn|practice|practise|course|language|write|writing|code|coding)\M';

-- Anything still unmatched stays 'other', which is correct.

-- ── index for the contribution grid ───────────────────────────────
-- The grid reads a year of logs at a time; without this it is a scan.
create index if not exists habit_logs_day_idx
  on public.habit_logs (user_id, day desc);

create index if not exists tasks_completed_idx
  on public.tasks (user_id, completed_at)
  where done = true;
