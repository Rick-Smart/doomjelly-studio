-- DoomJelly Studio — initial schema
-- Run this once against your Supabase project (SQL editor or supabase db push).

-- ── Projects table ────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid        primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  saved_at    timestamptz not null,
  anim_count  integer     not null default 0,
  frame_count integer     not null default 0,
  thumbnail   text,                         -- small base64 PNG dataURL
  body        jsonb       not null,         -- full serialised project JSON
  created_at  timestamptz not null default now()
);

-- ── Row-level security ────────────────────────────────────────────────────────
alter table public.projects enable row level security;

create policy "select own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists projects_user_saved
  on public.projects (user_id, saved_at desc);
