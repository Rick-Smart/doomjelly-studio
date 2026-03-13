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
  const jellyBody = sprite.jellyBody ?? null;
  const animatorBody = sprite.animatorBody ?? null;
  const frameCount = sprite.frameCount ?? jellyBody?.frames?.length ?? 0;
  const animCount = sprite.animCount ?? 0;
  const canvasW = sprite.canvasW ?? jellyBody?.canvasW ?? 32;
  const canvasH = sprite.canvasH ?? jellyBody?.canvasH ?? 32;
  const row = {
    id: sprite.id,
    project_id: sprite.projectId,
    user_id: user.id,
    name: sprite.name,
    body: sprite.body ?? {},
    jelly_body: jellyBody,
    animator_body: animatorBody,
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
  const jellyBody =
    data.jelly_body ??
    (data.body?.frames ? data.body : (data.body?.jellySpriteState ?? null));
  return {
    ...meta,
    jellySpriteState: jellyBody,
    animatorState: data.animator_body ?? null,
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
