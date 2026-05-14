import {
  ChannelType,
  Events,
  PermissionFlagsBits,
  type Client,
  type VoiceBasedChannel,
  type VoiceState,
} from 'discord.js';
import { getDb } from '../db.js';

type Cfg = {
  enabled: boolean;
  creatorChannelId: string | null;
  categoryId: string | null;
  nameTemplate: string | null;
  defaultLimit: number;
};

const cfgCache = new Map<string, { value: Cfg; expires: number }>();
const CFG_TTL_MS = 60_000;

async function getCfg(guildId: string): Promise<Cfg> {
  const now = Date.now();
  const cached = cfgCache.get(guildId);
  if (cached && cached.expires > now) return cached.value;
  const db = getDb();
  const { data } = await db
    .from('bot_guilds')
    .select(
      'tempvoice_enabled, tempvoice_creator_channel_id, tempvoice_category_id, tempvoice_name_template, tempvoice_default_limit',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  const value: Cfg = {
    enabled: Boolean(data?.tempvoice_enabled),
    creatorChannelId: (data?.tempvoice_creator_channel_id as string | null) ?? null,
    categoryId: (data?.tempvoice_category_id as string | null) ?? null,
    nameTemplate: (data?.tempvoice_name_template as string | null) ?? null,
    defaultLimit: (data?.tempvoice_default_limit as number | null) ?? 0,
  };
  cfgCache.set(guildId, { value, expires: now + CFG_TTL_MS });
  return value;
}

function renderName(template: string | null, username: string): string {
  const tpl = template ?? "🔊 {user}'s Channel";
  return tpl.replaceAll('{user}', username).slice(0, 100);
}

async function isTempChannel(channelId: string): Promise<{ ownerId: string } | null> {
  const db = getDb();
  const { data } = await db
    .from('bot_temp_voice')
    .select('owner_user_id')
    .eq('channel_id', channelId)
    .maybeSingle();
  return data ? { ownerId: data.owner_user_id as string } : null;
}

async function createTempChannel(
  newState: VoiceState,
  cfg: Cfg,
): Promise<void> {
  if (!newState.member || !newState.guild) return;
  const username = newState.member.user.username;
  const channelName = renderName(cfg.nameTemplate, username);

  // Permissions: User darf rein, Manage und Move, alle anderen normal
  const overwrites = [
    {
      id: newState.member.id,
      allow: [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
      ],
    },
  ];

  let createdChannel: VoiceBasedChannel | null = null;
  try {
    const created = await newState.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: cfg.categoryId ?? undefined,
      userLimit: cfg.defaultLimit > 0 ? cfg.defaultLimit : undefined,
      permissionOverwrites: overwrites,
      reason: `Temp-Voice für ${username}`,
    });
    createdChannel = created;
  } catch (err) {
    console.error('[tempvoice] create:', err);
    return;
  }

  // DB-Eintrag
  const db = getDb();
  await db
    .from('bot_temp_voice')
    .insert({
      channel_id: createdChannel.id,
      guild_id: newState.guild.id,
      owner_user_id: newState.member.id,
    })
    .then(undefined, (err: unknown) => console.error('[tempvoice] insert:', err));

  // User in den neuen Channel verschieben
  try {
    await newState.member.voice.setChannel(
      createdChannel.id,
      'Temp-Voice-Auto-Move',
    );
  } catch (err) {
    console.error('[tempvoice] move:', err);
    // Cleanup wenn move fehlschlägt
    await createdChannel.delete('Move fehlgeschlagen').catch(() => {});
    await db.from('bot_temp_voice').delete().eq('channel_id', createdChannel.id);
  }
}

async function maybeDeleteIfEmpty(
  oldState: VoiceState,
): Promise<void> {
  if (!oldState.channel || !oldState.channelId) return;
  if (oldState.channel.members.size > 0) return;
  const meta = await isTempChannel(oldState.channelId);
  if (!meta) return;

  try {
    await oldState.channel.delete('Temp-Voice leer');
    const db = getDb();
    await db.from('bot_temp_voice').delete().eq('channel_id', oldState.channelId);
  } catch (err) {
    console.error('[tempvoice] delete:', err);
  }
}

export function registerTempVoice(client: Client): void {
  client.on(
    Events.VoiceStateUpdate,
    async (oldState: VoiceState, newState: VoiceState) => {
      try {
        if (!newState.guild) return;
        const cfg = await getCfg(newState.guild.id);
        if (!cfg.enabled || !cfg.creatorChannelId) return;

        // 1) User joint den Creator-Channel → neuen Temp anlegen
        if (
          newState.channelId === cfg.creatorChannelId &&
          oldState.channelId !== cfg.creatorChannelId
        ) {
          await createTempChannel(newState, cfg);
        }

        // 2) User hat einen Temp-Channel verlassen → ggf. löschen
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
          await maybeDeleteIfEmpty(oldState);
        }
      } catch (err) {
        console.error('[tempvoice] handler:', err);
      }
    },
  );
}

export function invalidateTempVoiceCache(guildId: string): void {
  cfgCache.delete(guildId);
}
