-- Rename the currency: points become shells.
--
-- The reef's currency is shells everywhere the player can see it, and the
-- column was the last place still calling them points.
--
-- BREAKING for any client still reading `profiles.points`. The web app
-- does (src/lib/cloud.ts), so it stops loading a profile the moment this
-- runs. That is accepted — the web build is set aside — but it is a
-- rename, not an addition: there is no period where both names work.
--
-- To undo:  alter table public.profiles rename column shells to points;

alter table public.profiles rename column points to shells;
