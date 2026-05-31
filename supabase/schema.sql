create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  goal text,
  tone text,
  focus text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_footprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  footprint_date date not null,
  mood text not null default 'unknown' check (mood in ('calm', 'tired', 'anxious', 'sad', 'happy', 'mixed', 'unknown')),
  sleep text not null default 'unknown' check (sleep in ('unknown', 'poor', 'okay', 'good')),
  activity text not null default 'unknown' check (activity in ('unknown', 'low', 'okay', 'good')),
  nabi_note text not null,
  user_note text,
  routine text check (routine in ('breathing', 'walk', 'water', 'stretch', 'journal', 'rest')),
  routine_done boolean not null default false,
  bond_delta integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, footprint_date)
);

alter table public.profiles enable row level security;
alter table public.daily_footprints enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "daily_footprints_select_own" on public.daily_footprints;
drop policy if exists "daily_footprints_insert_own" on public.daily_footprints;
drop policy if exists "daily_footprints_update_own" on public.daily_footprints;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "daily_footprints_select_own"
on public.daily_footprints for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "daily_footprints_insert_own"
on public.daily_footprints for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "daily_footprints_update_own"
on public.daily_footprints for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
