-- DoomJelly Studio — canonical schema (Sprint 15)
-- Run this once against a fresh Supabase project via the SQL editor.
-- Replaces the three incremental migrations from the old prototype phase.

-- ── projects_v2 ───────────────────────────────────────────────────────────────
create table public.projects_v2 (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null default 'Untitled Project',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects_v2 enable row level security;

create policy "select own projects_v2" on public.projects_v2 for select  using (auth.uid() = user_id);
create policy "insert own projects_v2" on public.projects_v2 for insert  with check (auth.uid() = user_id);
create policy "update own projects_v2" on public.projects_v2 for update  using (auth.uid() = user_id);
create policy "delete own projects_v2" on public.projects_v2 for delete  using (auth.uid() = user_id);

create index projects_v2_user_updated on public.projects_v2 (user_id, updated_at desc);


-- ── sprites ───────────────────────────────────────────────────────────────────
create table public.sprites (
  id            uuid        primary key default gen_random_uuid(),
  project_id    uuid        not null references public.projects_v2(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null default 'Untitled Sprite',
  thumbnail     text,                           -- base64 PNG dataURL (frame 1)
  frame_count   integer     not null default 0,
  anim_count    integer     not null default 0,
  canvas_w      integer     not null default 32,
  canvas_h      integer     not null default 32,
  jelly_body    jsonb,                          -- pixel workspace (JellySprite)
  animator_body jsonb,                          -- animator workspace (sheets/animations)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.sprites enable row level security;

create policy "select own sprites" on public.sprites for select  using (auth.uid() = user_id);
create policy "insert own sprites" on public.sprites for insert  with check (auth.uid() = user_id);
create policy "update own sprites" on public.sprites for update  using (auth.uid() = user_id);
create policy "delete own sprites" on public.sprites for delete  using (auth.uid() = user_id);

create index sprites_project_updated on public.sprites (project_id, updated_at desc);
create index sprites_user_updated    on public.sprites (user_id, updated_at desc);
