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

-- 세션 시간 기록 테이블 (화면 오픈 시간 보너스용)
-- Notion 설계: 패널티 없는 보너스 방식 (5분↑+상호작용4↑→+1, 10분↑+상호작용6↑→+2)
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  duration_seconds integer not null default 0,
  interaction_score integer not null default 0,
  bond_bonus integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.daily_footprints enable row level security;
alter table public.user_sessions enable row level security;

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

drop policy if exists "user_sessions_select_own" on public.user_sessions;
drop policy if exists "user_sessions_insert_own" on public.user_sessions;

create policy "user_sessions_select_own"
on public.user_sessions for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_sessions_insert_own"
on public.user_sessions for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- 가입 시 profiles 행 자동 생성 (닉네임은 앱에서 upsert로 갱신)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      ''
    )), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
