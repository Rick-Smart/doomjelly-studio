import { supabase } from "./supabase.js";

export async function sbListProjects() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("projects_v2")
    .select("id, name, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function sbCreateProject(name) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("projects_v2")
    .insert({ user_id: user.id, name })
    .select("id, name, created_at, updated_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function sbRenameProject(id, name) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("projects_v2")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function sbDeleteProject(id) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("projects_v2")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function sbListSprites(projectId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("sprites")
    .select(
      "id, project_id, name, thumbnail, frame_count, anim_count, canvas_w, canvas_h, created_at, updated_at",
    )
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(sbSpriteRow);
}

export async function sbSaveSprite(sprite) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  // Use raw values — undefined means "don't touch this column" (partial update).
  const jellyBodyRaw = sprite.jellyBody;
  const animatorBodyRaw = sprite.animatorBody;
  // For dimension/count calculations, fall back to null safely.
  const jellyBodyMeta = jellyBodyRaw ?? null;
  const frameCount = sprite.frameCount ?? jellyBodyMeta?.frames?.length ?? 0;
  const animCount = sprite.animCount ?? 0;
  const canvasW = sprite.canvasW ?? jellyBodyMeta?.canvasW ?? 32;
  const canvasH = sprite.canvasH ?? jellyBodyMeta?.canvasH ?? 32;
  const row = {
    id: sprite.id,
    project_id: sprite.projectId,
    user_id: user.id,
    name: sprite.name,
    body: sprite.body ?? {},
    ...(jellyBodyRaw !== undefined && { jelly_body: jellyBodyRaw }),
    ...(animatorBodyRaw !== undefined && { animator_body: animatorBodyRaw }),
    thumbnail: sprite.thumbnail ?? null,
    frame_count: frameCount,
    anim_count: animCount,
    canvas_w: canvasW,
    canvas_h: canvasH,
    updated_at: now,
  };
  const { error } = await supabase.from("sprites").upsert(row);
  if (error) throw error;
  await supabase
    .from("projects_v2")
    .update({ updated_at: now })
    .eq("id", sprite.projectId);
  return sbSpriteRow(row);
}

export async function sbLoadSprite(id) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("sprites")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error) throw error;
  const meta = sbSpriteRow(data);
  // Normalise — legacy rows may have stored data in body before migration 003.
  const jellyBody =
    data.jelly_body ??
    (data.body?.frames ? data.body : (data.body?.jellySpriteState ?? null));
  return {
    ...meta,
    jellyBody,
    animatorBody: data.animator_body ?? null,
  };
}

export async function sbDeleteSprite(id) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("sprites")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

export function sbSpriteRow(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    thumbnail: r.thumbnail ?? null,
    frameCount: r.frame_count ?? 0,
    animCount: r.anim_count ?? 0,
    canvasW: r.canvas_w ?? 32,
    canvasH: r.canvas_h ?? 32,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
