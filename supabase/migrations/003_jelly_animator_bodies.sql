-- Migration 003: separate jelly_body and animator_body columns
-- Splits the single `body` JSONB blob into two focused columns so each
-- feature can save/load independently without touching the other's data.

-- Add the two new columns (nullable — filled on first save from each feature)
alter table public.sprites
  add column if not exists jelly_body   jsonb,
  add column if not exists animator_body jsonb;

-- Migrate existing body data into jelly_body for any sprites already saved.
-- body was the old unified store; jellySpriteState was nested inside it.
update public.sprites
set jelly_body = case
  -- If the body already has a 'frames' key it IS the jelly state directly
  when body ? 'frames' then body
  -- If it has a nested jellySpriteState, hoist it up
  when body ? 'jellySpriteState' and body->>'jellySpriteState' is not null
    then body->'jellySpriteState'
  else null
end
where jelly_body is null and body is not null and body != '{}'::jsonb;

-- body column is kept for now as a safety net during transition.
-- It will be dropped in a future migration once all clients are updated.
