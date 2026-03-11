-- Migration 002: multi-sprite projects
-- Adds a `sprites` child table; migrates existing project rows so each
-- user's existing projects become sprites nested under a single "Migrated"
-- container project.

-- New projects table (container only — no body/anim_count/frame_count/thumbnail)
create table if not exists public.projects_v2 (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null default 'Untitled Project',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects_v2 enable row level security;

create policy "select own projects_v2"  on public.projects_v2 for select  using (auth.uid() = user_id);
create policy "insert own projects_v2"  on public.projects_v2 for insert  with check (auth.uid() = user_id);
create policy "update own projects_v2"  on public.projects_v2 for update  using (auth.uid() = user_id);
create policy "delete own projects_v2"  on public.projects_v2 for delete  using (auth.uid() = user_id);

create index if not exists projects_v2_user_updated
  on public.projects_v2 (user_id, updated_at desc);

-- Sprites table (one row per sprite asset, child of a project)
create table if not exists public.sprites (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects_v2(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null default 'Untitled Sprite',
  body        jsonb       not null default '{}'::jsonb,   -- full jellySprite serialised state
  thumbnail   text,                                        -- base64 PNG dataURL (frame 1)
  frame_count integer     not null default 0,
  anim_count  integer     not null default 0,
  canvas_w    integer     not null default 32,
  canvas_h    integer     not null default 32,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.sprites enable row level security;

create policy "select own sprites"  on public.sprites for select  using (auth.uid() = user_id);
create policy "insert own sprites"  on public.sprites for insert  with check (auth.uid() = user_id);
create policy "update own sprites"  on public.sprites for update  using (auth.uid() = user_id);
create policy "delete own sprites"  on public.sprites for delete  using (auth.uid() = user_id);

create index if not exists sprites_project_updated
  on public.sprites (project_id, updated_at desc);
create index if not exists sprites_user_updated
  on public.sprites (user_id, updated_at desc);

-- Migrate existing rows from public.projects into the new schema.
-- For each distinct user_id in the old table, create one "Migrated" container
-- project, then insert each old project row as a sprite under it.

do $$
declare
  r         record;
  proj_id   uuid;
begin
  for r in
    select distinct user_id from public.projects
  loop
    -- Create or find the migration container for this user
    insert into public.projects_v2 (user_id, name, created_at, updated_at)
    values (r.user_id, 'Migrated', now(), now())
    on conflict do nothing
    returning id into proj_id;

    -- If the insert was a no-op (conflict), fetch the existing id
    if proj_id is null then
      select id into proj_id
      from public.projects_v2
      where user_id = r.user_id and name = 'Migrated'
      limit 1;
    end if;

    -- Copy each old project as a sprite
    insert into public.sprites
      (id, project_id, user_id, name, body, thumbnail, frame_count, anim_count, created_at, updated_at)
    select
      p.id,
      proj_id,
      p.user_id,
      p.name,
      p.body,
      p.thumbnail,
      p.frame_count,
      p.anim_count,
      p.created_at,
      p.saved_at
    from public.projects p
    where p.user_id = r.user_id;

  end loop;
end;
$$;
