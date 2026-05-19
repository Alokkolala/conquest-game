-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────
create table if not exists profiles (
  id            uuid references auth.users primary key,
  username      text unique not null,
  display_color text not null default '#4a90d9',
  territory_count int not null default 0,
  created_at    timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_select_all" on profiles
  for select using (true);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- ─────────────────────────────────────────
-- territories
-- ─────────────────────────────────────────
create table if not exists territories (
  id         serial primary key,
  name       text not null,
  hex_q      int not null,
  hex_r      int not null,
  owner_id   uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(hex_q, hex_r)
);

alter table territories enable row level security;

create policy "territories_select_all" on territories
  for select using (true);

-- Service role bypasses RLS for server-side writes
create policy "territories_update_all" on territories
  for update using (true);

-- ─────────────────────────────────────────
-- challenges (stub — needed for FK later)
-- ─────────────────────────────────────────
create table if not exists challenges (
  id            uuid primary key default gen_random_uuid(),
  territory_id  int references territories(id),
  challenger_id uuid references profiles(id),
  defender_id   uuid references profiles(id),
  current_fen   text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn           text not null default '',
  status        text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'forfeited')),
  winner_id     uuid references profiles(id),
  ai_analysis   text,
  created_at    timestamptz default now()
);

alter table challenges enable row level security;

create policy "challenges_select_all" on challenges
  for select using (true);

create policy "challenges_insert_challenger" on challenges
  for insert with check (auth.uid() = challenger_id);

create policy "challenges_update_participants" on challenges
  for update using (
    auth.uid() = challenger_id or auth.uid() = defender_id
  );

-- ─────────────────────────────────────────
-- Auto-sync territory_count on ownership change
-- ─────────────────────────────────────────
create or replace function sync_territory_counts()
returns trigger language plpgsql security definer as $$
begin
  if OLD.owner_id is not null then
    update profiles set territory_count = territory_count - 1 where id = OLD.owner_id;
  end if;
  if NEW.owner_id is not null then
    update profiles set territory_count = territory_count + 1 where id = NEW.owner_id;
  end if;
  return NEW;
end;
$$;

create trigger on_territory_owner_change
  after update of owner_id on territories
  for each row
  when (OLD.owner_id is distinct from NEW.owner_id)
  execute function sync_territory_counts();
