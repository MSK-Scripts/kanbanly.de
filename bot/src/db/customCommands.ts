import { getDb } from '../db.js';

export type CustomCommand = {
  guildId: string;
  trigger: string;
  response: string;
  createdBy: string;
  uses: number;
};

type Row = {
  guild_id: string;
  trigger: string;
  response: string;
  created_by: string;
  uses: number;
};

function map(r: Row): CustomCommand {
  return {
    guildId: r.guild_id,
    trigger: r.trigger,
    response: r.response,
    createdBy: r.created_by,
    uses: r.uses,
  };
}

export const TRIGGER_RE = /^[a-z0-9_-]{1,32}$/;

export async function getCustomCommand(
  guildId: string,
  trigger: string,
): Promise<CustomCommand | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_custom_commands')
    .select('guild_id, trigger, response, created_by, uses')
    .eq('guild_id', guildId)
    .eq('trigger', trigger)
    .maybeSingle();
  if (error) throw error;
  return data ? map(data as Row) : null;
}

export async function listCustomCommands(
  guildId: string,
): Promise<CustomCommand[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_custom_commands')
    .select('guild_id, trigger, response, created_by, uses')
    .eq('guild_id', guildId)
    .order('trigger');
  if (error) throw error;
  return (data ?? []).map((r) => map(r as Row));
}

export async function upsertCustomCommand(args: {
  guildId: string;
  trigger: string;
  response: string;
  createdBy: string;
}): Promise<void> {
  const db = getDb();
  const { error } = await db.from('bot_custom_commands').upsert(
    {
      guild_id: args.guildId,
      trigger: args.trigger,
      response: args.response,
      created_by: args.createdBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'guild_id,trigger' },
  );
  if (error) throw error;
}

export async function deleteCustomCommand(
  guildId: string,
  trigger: string,
): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_custom_commands')
    .delete()
    .eq('guild_id', guildId)
    .eq('trigger', trigger)
    .select('trigger');
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function incrementCustomCommandUses(
  guildId: string,
  trigger: string,
): Promise<void> {
  const db = getDb();
  const { data } = await db
    .from('bot_custom_commands')
    .select('uses')
    .eq('guild_id', guildId)
    .eq('trigger', trigger)
    .maybeSingle();
  if (!data) return;
  await db
    .from('bot_custom_commands')
    .update({ uses: (data.uses as number) + 1 })
    .eq('guild_id', guildId)
    .eq('trigger', trigger);
}

export async function getCommandPrefix(guildId: string): Promise<string> {
  const db = getDb();
  const { data } = await db
    .from('bot_guilds')
    .select('command_prefix')
    .eq('guild_id', guildId)
    .maybeSingle();
  return (data?.command_prefix as string | undefined) ?? '!';
}
