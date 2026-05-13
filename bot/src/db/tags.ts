import { getDb } from '../db.js';

export type Tag = {
  guildId: string;
  name: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  uses: number;
};

type TagRow = {
  guild_id: string;
  name: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  uses: number;
};

function map(r: TagRow): Tag {
  return {
    guildId: r.guild_id,
    name: r.name,
    content: r.content,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    uses: r.uses,
  };
}

export const TAG_NAME_RE = /^[a-z0-9_-]{1,32}$/;

export async function getTag(guildId: string, name: string): Promise<Tag | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tags')
    .select('guild_id, name, content, created_by, created_at, updated_at, uses')
    .eq('guild_id', guildId)
    .eq('name', name)
    .maybeSingle();
  if (error) throw error;
  return data ? map(data as TagRow) : null;
}

export async function listTags(guildId: string): Promise<Tag[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tags')
    .select('guild_id, name, content, created_by, created_at, updated_at, uses')
    .eq('guild_id', guildId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((r) => map(r as TagRow));
}

export async function createTag(args: {
  guildId: string;
  name: string;
  content: string;
  createdBy: string;
}): Promise<Tag> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tags')
    .insert({
      guild_id: args.guildId,
      name: args.name,
      content: args.content,
      created_by: args.createdBy,
    })
    .select('guild_id, name, content, created_by, created_at, updated_at, uses')
    .single();
  if (error || !data) throw error ?? new Error('Tag-Insert lieferte keine Daten.');
  return map(data as TagRow);
}

export async function updateTag(
  guildId: string,
  name: string,
  content: string,
): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tags')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('guild_id', guildId)
    .eq('name', name)
    .select('name');
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function deleteTag(guildId: string, name: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tags')
    .delete()
    .eq('guild_id', guildId)
    .eq('name', name)
    .select('name');
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function incrementTagUses(guildId: string, name: string): Promise<void> {
  const db = getDb();
  // Race-safe via select + update: pragmatisch nur best-effort.
  const { data } = await db
    .from('bot_tags')
    .select('uses')
    .eq('guild_id', guildId)
    .eq('name', name)
    .maybeSingle();
  if (!data) return;
  await db
    .from('bot_tags')
    .update({ uses: (data.uses as number) + 1 })
    .eq('guild_id', guildId)
    .eq('name', name);
}
