'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFreshAccessToken } from '@/lib/discordConnection';
import { canManageGuild, fetchCurrentUserGuilds } from '@/lib/discord';
import {
  addReaction,
  deleteMessage,
  editMessage,
  postMessage,
  removeOwnReaction,
} from '@/lib/discordBot';
import {
  buildReactionRoleEmbed,
  buildRrComponents,
  parseEmoji,
  type RrMode,
} from '@/lib/reactionRoles';

// Cache pro User+Guild: 60s. Verhindert dass jeder Toggle-Click eine Discord-API-Roundtrip braucht.
const manageCheckCache = new Map<string, { ok: boolean; expires: number }>();
const MANAGE_CACHE_TTL_MS = 60_000;

async function assertCanManage(guildId: string): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht eingeloggt.');

  const cacheKey = `${user.id}:${guildId}`;
  const now = Date.now();
  const cached = manageCheckCache.get(cacheKey);
  if (cached && cached.expires > now) {
    if (!cached.ok) throw new Error('Keine Berechtigung.');
    return { userId: user.id };
  }

  const token = await getFreshAccessToken(user.id);
  if (!token) throw new Error('Discord-Verbindung abgelaufen.');

  const guilds = await fetchCurrentUserGuilds(token);
  const g = guilds.find((x) => x.id === guildId);
  if (!g) {
    manageCheckCache.set(cacheKey, { ok: false, expires: now + MANAGE_CACHE_TTL_MS });
    throw new Error('Server nicht gefunden.');
  }
  if (!g.owner && !canManageGuild(g.permissions)) {
    manageCheckCache.set(cacheKey, { ok: false, expires: now + MANAGE_CACHE_TTL_MS });
    throw new Error('Keine Berechtigung.');
  }
  manageCheckCache.set(cacheKey, { ok: true, expires: now + MANAGE_CACHE_TTL_MS });
  return { userId: user.id };
}

export async function updateAutoModConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const blockLinks = formData.get('block_links') === 'on';
    const linkAllowlistRaw = String(formData.get('link_allowlist') ?? '');
    const linkAllowlist = linkAllowlistRaw
      .split('\n')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && s.length <= 100)
      .slice(0, 50);

    const capsRaw = String(formData.get('max_caps_pct') ?? '').trim();
    const maxCapsPct =
      capsRaw === ''
        ? null
        : Math.min(100, Math.max(50, parseInt(capsRaw, 10) || 70));

    const mentionsRaw = String(formData.get('max_mentions') ?? '').trim();
    const maxMentions =
      mentionsRaw === ''
        ? null
        : Math.min(50, Math.max(1, parseInt(mentionsRaw, 10) || 5));

    const bannedRaw = String(formData.get('banned_words') ?? '');
    const bannedWords = bannedRaw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 50)
      .slice(0, 100);

    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        automod_enabled: enabled,
        automod_block_links: blockLinks,
        automod_link_allowlist: linkAllowlist,
        automod_max_caps_pct: maxCapsPct,
        automod_max_mentions: maxMentions,
        automod_banned_words: bannedWords,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Unbekannter Fehler.',
    };
  }
}

export async function updateLevelConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const announce = formData.get('announce') === 'on';
    const channelId = (formData.get('channel_id') as string | null)?.trim() || null;
    const useEmbed = formData.get('use_embed') === 'on';
    const embedColorRaw = (formData.get('embed_color') as string | null)?.trim() || null;
    const embedColor = embedColorRaw && /^#?[0-9a-f]{6}$/i.test(embedColorRaw)
      ? parseInt(embedColorRaw.replace('#', ''), 16)
      : null;

    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        level_enabled: enabled,
        level_announce: announce,
        level_up_channel_id: channelId,
        level_use_embed: useEmbed,
        level_embed_color: embedColor,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function addLevelReward(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const level = parseInt(String(formData.get('level') ?? '0'), 10);
    const roleId = String(formData.get('role_id') ?? '').trim();
    if (!Number.isFinite(level) || level <= 0) {
      return { ok: false, error: 'Level muss > 0 sein.' };
    }
    if (!roleId) return { ok: false, error: 'Rolle fehlt.' };

    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_level_rewards')
      .upsert(
        { guild_id: guildId, level, role_id: roleId },
        { onConflict: 'guild_id,level' },
      );
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function removeLevelReward(
  guildId: string,
  level: number,
): Promise<void> {
  await assertCanManage(guildId);
  const admin = createAdminClient();
  await admin
    .from('bot_level_rewards')
    .delete()
    .eq('guild_id', guildId)
    .eq('level', level);
  revalidatePath(`/integrations/discord/${guildId}`);
}

export async function updateLogConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const channelId = (formData.get('channel_id') as string | null)?.trim() || null;
    const joins = formData.get('log_joins') === 'on';
    const leaves = formData.get('log_leaves') === 'on';
    const messageEdits = formData.get('log_message_edits') === 'on';
    const messageDeletes = formData.get('log_message_deletes') === 'on';
    const roleChanges = formData.get('log_role_changes') === 'on';

    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        log_channel_id: channelId,
        log_joins: joins,
        log_leaves: leaves,
        log_message_edits: messageEdits,
        log_message_deletes: messageDeletes,
        log_role_changes: roleChanges,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updateAutoRolesConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);

    const enabled = formData.get('enabled') === 'on';
    const roleIdsRaw = formData.getAll('role_ids');
    const roleIds = roleIdsRaw
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .slice(0, 10);

    if (enabled && roleIds.length === 0) {
      return { ok: false, error: 'Wähl mindestens eine Rolle wenn Auto-Roles aktiv ist.' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        auto_roles_enabled: enabled,
        auto_role_ids: roleIds,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updateWelcomeConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);

    const enabled = formData.get('enabled') === 'on';
    const channelId = (formData.get('channel_id') as string | null)?.trim() || null;
    const message = (formData.get('message') as string | null)?.trim() || null;
    const useEmbed = formData.get('use_embed') === 'on';
    const embedColorRaw = (formData.get('embed_color') as string | null)?.trim() || null;
    const embedColor = embedColorRaw && /^#?[0-9a-f]{6}$/i.test(embedColorRaw)
      ? parseInt(embedColorRaw.replace('#', ''), 16)
      : null;
    const dmEnabled = formData.get('dm_enabled') === 'on';
    const dmMessage = (formData.get('dm_message') as string | null)?.trim() || null;
    const dmUseEmbed = formData.get('dm_use_embed') === 'on';

    if (enabled && (!channelId || !message)) {
      return { ok: false, error: 'Channel und Nachricht sind nötig, wenn Welcome aktiv ist.' };
    }
    if (dmEnabled && !dmMessage) {
      return { ok: false, error: 'DM-Nachricht fehlt.' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        welcome_enabled: enabled,
        welcome_channel_id: channelId,
        welcome_message: message,
        welcome_use_embed: useEmbed,
        welcome_embed_color: embedColor,
        welcome_dm_enabled: dmEnabled,
        welcome_dm_message: dmMessage,
        welcome_dm_use_embed: dmUseEmbed,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updateBoosterConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const channelId = (formData.get('channel_id') as string | null)?.trim() || null;
    const message = (formData.get('message') as string | null)?.trim() || null;
    const useEmbed = formData.get('use_embed') === 'on';
    const embedColorRaw = (formData.get('embed_color') as string | null)?.trim() || null;
    const embedColor = embedColorRaw && /^#?[0-9a-f]{6}$/i.test(embedColorRaw)
      ? parseInt(embedColorRaw.replace('#', ''), 16)
      : null;
    if (enabled && (!channelId || !message)) {
      return { ok: false, error: 'Channel und Nachricht sind nötig, wenn Booster-Message aktiv ist.' };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        booster_enabled: enabled,
        booster_channel_id: channelId,
        booster_message: message,
        booster_use_embed: useEmbed,
        booster_embed_color: embedColor,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function upsertStickyMessage(
  guildId: string,
  channelId: string,
  content: string,
  useEmbed: boolean = false,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 1500) {
      return { ok: false, error: 'Inhalt fehlt oder ist länger als 1500 Zeichen.' };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_sticky_messages')
      .upsert(
        {
          guild_id: guildId,
          channel_id: channelId,
          content: trimmed,
          use_embed: useEmbed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'guild_id,channel_id' },
      );
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deleteStickyMessage(
  guildId: string,
  channelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_sticky_messages')
      .delete()
      .eq('guild_id', guildId)
      .eq('channel_id', channelId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function upsertChannelMode(
  guildId: string,
  channelId: string,
  mode: 'images_only' | 'text_only',
  allowVideos: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    if (mode !== 'images_only' && mode !== 'text_only') {
      return { ok: false, error: 'Ungültiger Modus.' };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_channel_modes')
      .upsert(
        {
          guild_id: guildId,
          channel_id: channelId,
          mode,
          allow_videos: allowVideos,
        },
        { onConflict: 'guild_id,channel_id' },
      );
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deleteChannelMode(
  guildId: string,
  channelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_channel_modes')
      .delete()
      .eq('guild_id', guildId)
      .eq('channel_id', channelId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function sendBotEmbed(
  guildId: string,
  channelId: string,
  embed: {
    title?: string;
    description?: string;
    color?: number;
    footer?: string;
    image?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      return { ok: false, error: 'DISCORD_BOT_TOKEN ist nicht gesetzt.' };
    }
    const payload = {
      embeds: [
        {
          title: embed.title?.slice(0, 256) || undefined,
          description: embed.description?.slice(0, 4000) || undefined,
          color: embed.color,
          footer: embed.footer ? { text: embed.footer.slice(0, 2048) } : undefined,
          image: embed.image ? { url: embed.image } : undefined,
        },
      ],
    };
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `Discord ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Verifizierung ==============

export async function updateVerifyConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const channelId = (formData.get('channel_id') as string | null)?.trim() || null;
    const roleId = (formData.get('role_id') as string | null)?.trim() || null;
    const message =
      (formData.get('message') as string | null)?.trim() ||
      'Willkommen! Klick auf den Button unten, um dich zu verifizieren und Zugriff auf den Server zu bekommen.';

    if (enabled && (!channelId || !roleId)) {
      return {
        ok: false,
        error: 'Channel und Rolle sind nötig, wenn Verifizierung aktiv ist.',
      };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        verify_enabled: enabled,
        verify_channel_id: channelId,
        verify_role_id: roleId,
        verify_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function postVerifyPanel(
  guildId: string,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('bot_guilds')
      .select('verify_channel_id, verify_message, verify_panel_message_id')
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!row?.verify_channel_id) {
      return { ok: false, error: 'Kein Channel konfiguriert.' };
    }
    const channelId = row.verify_channel_id as string;
    const message =
      (row.verify_message as string | null) ??
      'Klick auf **Verifizieren**, um Zugriff zu bekommen.';

    // Alte Panel-Nachricht löschen, falls vorhanden.
    if (row.verify_panel_message_id) {
      await deleteMessage(channelId, row.verify_panel_message_id as string).catch(
        () => {},
      );
    }

    const payload = {
      embeds: [
        {
          title: '🛡️  Verifizierung',
          description: message,
          color: 0x5865f2,
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              custom_id: 'verify:btn',
              label: 'Verifizieren',
              emoji: { name: '✓' },
            },
          ],
        },
      ],
    };
    const posted = await postMessage(channelId, payload);
    await admin
      .from('bot_guilds')
      .update({ verify_panel_message_id: posted.id })
      .eq('guild_id', guildId);
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, messageId: posted.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Anti-Raid ==============

export async function updateAntiRaidConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const threshold = Math.max(
      2,
      Math.min(50, parseInt(String(formData.get('threshold') ?? '5'), 10) || 5),
    );
    const windowSec = Math.max(
      5,
      Math.min(
        300,
        parseInt(String(formData.get('window_sec') ?? '10'), 10) || 10,
      ),
    );
    const action = String(formData.get('action') ?? 'alert');
    if (!['alert', 'kick', 'lockdown'].includes(action)) {
      return { ok: false, error: 'Ungültige Aktion.' };
    }
    const alertChannelId =
      (formData.get('alert_channel_id') as string | null)?.trim() || null;

    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        antiraid_enabled: enabled,
        antiraid_join_threshold: threshold,
        antiraid_join_window_sec: windowSec,
        antiraid_action: action,
        antiraid_alert_channel_id: alertChannelId,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Giveaways ==============

export type GiveawayRow = {
  id: string;
  channelId: string;
  messageId: string | null;
  prize: string;
  winnersCount: number;
  endsAt: string;
  ended: boolean;
  winnerUserIds: string[] | null;
  entriesCount: number;
};

export async function listGuildGiveaways(
  guildId: string,
): Promise<{ ok: boolean; error?: string; giveaways?: GiveawayRow[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from('bot_giveaways')
      .select('id, channel_id, message_id, prize, winners_count, ends_at, ended, winner_user_ids')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    const ids = (rows ?? []).map((r) => r.id as string);
    const countMap = new Map<string, number>();
    if (ids.length) {
      const { data: entries } = await admin
        .from('bot_giveaway_entries')
        .select('giveaway_id')
        .in('giveaway_id', ids);
      for (const e of entries ?? []) {
        const id = e.giveaway_id as string;
        countMap.set(id, (countMap.get(id) ?? 0) + 1);
      }
    }
    return {
      ok: true,
      giveaways: (rows ?? []).map((r) => ({
        id: r.id as string,
        channelId: r.channel_id as string,
        messageId: (r.message_id as string | null) ?? null,
        prize: r.prize as string,
        winnersCount: r.winners_count as number,
        endsAt: r.ends_at as string,
        ended: Boolean(r.ended),
        winnerUserIds: Array.isArray(r.winner_user_ids)
          ? (r.winner_user_ids as unknown[]).filter(
              (v): v is string => typeof v === 'string',
            )
          : null,
        entriesCount: countMap.get(r.id as string) ?? 0,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function createGiveawayFromWeb(
  guildId: string,
  input: {
    channelId: string;
    prize: string;
    winnersCount: number;
    durationMs: number;
  },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { userId } = await assertCanManage(guildId);
    if (!input.prize.trim() || input.prize.length > 200) {
      return { ok: false, error: 'Preis fehlt oder ist zu lang.' };
    }
    if (input.winnersCount < 1 || input.winnersCount > 20) {
      return { ok: false, error: 'Gewinner-Anzahl muss zwischen 1 und 20 sein.' };
    }
    if (input.durationMs < 30_000 || input.durationMs > 30 * 86400 * 1000) {
      return { ok: false, error: 'Dauer muss zwischen 30s und 30 Tagen liegen.' };
    }
    const endsAt = new Date(Date.now() + input.durationMs);
    const admin = createAdminClient();
    const { data: gw, error: insErr } = await admin
      .from('bot_giveaways')
      .insert({
        guild_id: guildId,
        channel_id: input.channelId,
        prize: input.prize.trim(),
        winners_count: input.winnersCount,
        ends_at: endsAt.toISOString(),
        created_by_user_id: userId,
      })
      .select('id')
      .single();
    if (insErr || !gw) throw insErr ?? new Error('Insert fehlgeschlagen.');

    const endsAtUnix = Math.floor(endsAt.getTime() / 1000);
    const payload = {
      embeds: [
        {
          title: `🎉  ${input.prize.trim()}`,
          description: [
            `Endet: <t:${endsAtUnix}:R>`,
            `Gewinner: **${input.winnersCount}**`,
            `Teilnehmer: **0**`,
            '',
            'Klick auf **Teilnehmen**, um mitzumachen.',
          ].join('\n'),
          color: 0xa855f7,
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              custom_id: `gw:join:${gw.id}`,
              label: 'Teilnehmen',
              emoji: { name: '🎉' },
            },
          ],
        },
      ],
    };

    try {
      const posted = await postMessage(input.channelId, payload);
      await admin
        .from('bot_giveaways')
        .update({ message_id: posted.id })
        .eq('id', gw.id);
    } catch (err) {
      // Cleanup: das Giveaway-Row ohne Message ist nutzlos.
      await admin.from('bot_giveaways').delete().eq('id', gw.id);
      return {
        ok: false,
        error: `Discord-Post fehlgeschlagen: ${
          err instanceof Error ? err.message : 'unbekannt'
        }`,
      };
    }

    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: gw.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function endGiveawayFromWeb(
  guildId: string,
  giveawayId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    // Setze ends_at auf jetzt — der Scheduler endet es innerhalb 30s.
    const { error } = await admin
      .from('bot_giveaways')
      .update({ ends_at: new Date().toISOString() })
      .eq('id', giveawayId)
      .eq('guild_id', guildId)
      .eq('ended', false);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function rerollGiveawayFromWeb(
  guildId: string,
  giveawayId: string,
): Promise<{ ok: boolean; error?: string; winners?: string[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: gw } = await admin
      .from('bot_giveaways')
      .select('id, channel_id, message_id, prize, winners_count, ends_at, ended')
      .eq('id', giveawayId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!gw) return { ok: false, error: 'Giveaway nicht gefunden.' };
    if (!gw.ended) return { ok: false, error: 'Giveaway läuft noch — erst beenden.' };

    const { data: entries } = await admin
      .from('bot_giveaway_entries')
      .select('user_id')
      .eq('giveaway_id', giveawayId);
    const pool = (entries ?? []).map((r) => r.user_id as string);
    const count = (gw.winners_count as number) ?? 1;
    const winners: string[] = [];
    const remaining = [...pool];
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const idx = Math.floor(Math.random() * remaining.length);
      winners.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    await admin
      .from('bot_giveaways')
      .update({ winner_user_ids: winners })
      .eq('id', giveawayId);

    // Posting im Channel.
    if (gw.channel_id) {
      const winnersTxt = winners.length
        ? winners.map((u) => `<@${u}>`).join(' · ')
        : '_Keine Teilnehmer_';
      try {
        await postMessage(gw.channel_id as string, {
          content: `🎲 **Reroll**: ${winnersTxt} hat **${gw.prize}** gewonnen!`,
        });
      } catch (err) {
        console.error('[giveaway/reroll post]', err);
      }
    }
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, winners };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Modul-Toggle (Übersicht) ==============

type ModuleKey =
  | 'welcome'
  | 'autoroles'
  | 'logging'
  | 'levels'
  | 'automod'
  | 'reactionroles'
  | 'booster'
  | 'sticky'
  | 'channelmodes'
  | 'embed'
  | 'verify'
  | 'antiraid'
  | 'giveaways';

export async function toggleBotModule(
  guildId: string,
  key: ModuleKey,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    switch (key) {
      case 'welcome':
        patch.welcome_enabled = enabled;
        break;
      case 'autoroles':
        patch.auto_roles_enabled = enabled;
        break;
      case 'levels':
        patch.level_enabled = enabled;
        break;
      case 'automod':
        patch.automod_enabled = enabled;
        break;
      case 'booster':
        patch.booster_enabled = enabled;
        break;
      case 'verify':
        patch.verify_enabled = enabled;
        break;
      case 'antiraid':
        patch.antiraid_enabled = enabled;
        break;
      default:
        return {
          ok: false,
          error: 'Dieses Modul hat keinen einfachen An/Aus-Schalter — bitte im Tab konfigurieren.',
        };
    }

    const { error } = await admin
      .from('bot_guilds')
      .update(patch)
      .eq('guild_id', guildId);
    if (error) throw error;

    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Embed-Templates ==============

export type EmbedTemplate = {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  color: number | null;
  footer: string | null;
  imageUrl: string | null;
};

export async function listEmbedTemplates(
  guildId: string,
): Promise<{ ok: boolean; error?: string; templates?: EmbedTemplate[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_embed_templates')
      .select('id, name, title, description, color, footer, image_url')
      .eq('guild_id', guildId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return {
      ok: true,
      templates: (data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        title: (r.title as string | null) ?? null,
        description: (r.description as string | null) ?? null,
        color: (r.color as number | null) ?? null,
        footer: (r.footer as string | null) ?? null,
        imageUrl: (r.image_url as string | null) ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function saveEmbedTemplate(
  guildId: string,
  template: {
    id?: string;
    name: string;
    title?: string | null;
    description?: string | null;
    color?: number | null;
    footer?: string | null;
    imageUrl?: string | null;
  },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    await assertCanManage(guildId);
    if (!template.name.trim() || template.name.length > 80) {
      return { ok: false, error: 'Name fehlt oder ist zu lang (max 80).' };
    }
    const admin = createAdminClient();
    const payload = {
      guild_id: guildId,
      name: template.name.trim(),
      title: template.title?.trim() || null,
      description: template.description?.trim() || null,
      color: template.color ?? null,
      footer: template.footer?.trim() || null,
      image_url: template.imageUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (template.id) {
      const { error } = await admin
        .from('bot_embed_templates')
        .update(payload)
        .eq('id', template.id)
        .eq('guild_id', guildId);
      if (error) throw error;
      revalidatePath(`/integrations/discord/${guildId}`);
      return { ok: true, id: template.id };
    }
    const { data, error } = await admin
      .from('bot_embed_templates')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deleteEmbedTemplate(
  guildId: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_embed_templates')
      .delete()
      .eq('id', id)
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Reaction-Roles ==============

async function refreshRrEmbed(
  messageId: string,
  roleNameById?: Map<string, string>,
): Promise<void> {
  const admin = createAdminClient();
  const { data: msg } = await admin
    .from('bot_reaction_role_messages')
    .select('channel_id, title, description, mode')
    .eq('message_id', messageId)
    .maybeSingle();
  if (!msg) return;
  const { data: rolesData } = await admin
    .from('bot_reaction_roles')
    .select('emoji_key, emoji_display, role_id, label')
    .eq('message_id', messageId);
  const rows = (rolesData ?? []).map((r) => ({
    emojiKey: r.emoji_key as string,
    emojiDisplay: r.emoji_display as string,
    roleId: r.role_id as string,
    label: (r.label as string | null) ?? null,
  }));
  const embed = buildReactionRoleEmbed(
    (msg.title as string | null) ?? null,
    (msg.description as string | null) ?? null,
    rows,
  );
  const mode = ((msg.mode as RrMode | null) ?? 'reactions') as RrMode;
  const components = buildRrComponents(
    mode,
    messageId,
    rows,
    roleNameById ?? new Map(),
  );
  await editMessage(msg.channel_id as string, messageId, {
    embeds: [embed],
    components,
  }).catch((err) => console.error('[rr] editMessage:', err));
}

export async function createReactionRoleMessage(
  guildId: string,
  channelId: string,
  title: string,
  description: string | null,
  mode: RrMode = 'reactions',
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  try {
    await assertCanManage(guildId);
    if (!title.trim()) return { ok: false, error: 'Titel fehlt.' };
    if (!['reactions', 'buttons', 'select_menu'].includes(mode)) {
      return { ok: false, error: 'Ungültiger Modus.' };
    }
    const embed = buildReactionRoleEmbed(title.trim(), description?.trim() || null, []);
    const posted = await postMessage(channelId, { embeds: [embed] });
    const admin = createAdminClient();
    const { error } = await admin.from('bot_reaction_role_messages').insert({
      message_id: posted.id,
      guild_id: guildId,
      channel_id: channelId,
      title: title.trim(),
      description: description?.trim() || null,
      mode,
    });
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, messageId: posted.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updateReactionRoleMode(
  guildId: string,
  messageId: string,
  mode: RrMode,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    if (!['reactions', 'buttons', 'select_menu'].includes(mode)) {
      return { ok: false, error: 'Ungültiger Modus.' };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_reaction_role_messages')
      .update({ mode })
      .eq('message_id', messageId)
      .eq('guild_id', guildId);
    if (error) throw error;
    await refreshRrEmbed(messageId);
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deleteReactionRoleMessage(
  guildId: string,
  messageId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: msg } = await admin
      .from('bot_reaction_role_messages')
      .select('channel_id')
      .eq('message_id', messageId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (msg) {
      await deleteMessage(msg.channel_id as string, messageId).catch((err) =>
        console.error('[rr] deleteMessage:', err),
      );
    }
    const { error } = await admin
      .from('bot_reaction_role_messages')
      .delete()
      .eq('message_id', messageId)
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function addReactionRoleMapping(
  guildId: string,
  messageId: string,
  emojiInput: string,
  roleId: string,
  label: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const parsed = parseEmoji(emojiInput);
    if (!parsed) return { ok: false, error: 'Emoji konnte nicht geparst werden.' };

    const admin = createAdminClient();
    const { data: msg } = await admin
      .from('bot_reaction_role_messages')
      .select('channel_id, mode')
      .eq('message_id', messageId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!msg) return { ok: false, error: 'RR-Nachricht nicht gefunden.' };

    const mode = ((msg.mode as RrMode | null) ?? 'reactions') as RrMode;
    if (mode === 'reactions') {
      try {
        await addReaction(msg.channel_id as string, messageId, parsed.urlForm);
      } catch (err) {
        return {
          ok: false,
          error: `Reaction konnte nicht hinzugefügt werden — ungültiges Emoji oder kein Zugriff. (${
            err instanceof Error ? err.message : 'unbekannt'
          })`,
        };
      }
    }

    const { error } = await admin.from('bot_reaction_roles').upsert(
      {
        message_id: messageId,
        emoji_key: parsed.key,
        emoji_display: parsed.display,
        role_id: roleId,
        label: label?.trim() || null,
      },
      { onConflict: 'message_id,emoji_key' },
    );
    if (error) throw error;

    await refreshRrEmbed(messageId);
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function removeReactionRoleMapping(
  guildId: string,
  messageId: string,
  emojiKey: string,
  emojiDisplay: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: msg } = await admin
      .from('bot_reaction_role_messages')
      .select('channel_id, mode')
      .eq('message_id', messageId)
      .eq('guild_id', guildId)
      .maybeSingle();

    const { error } = await admin
      .from('bot_reaction_roles')
      .delete()
      .eq('message_id', messageId)
      .eq('emoji_key', emojiKey);
    if (error) throw error;

    if (msg) {
      const mode = ((msg.mode as RrMode | null) ?? 'reactions') as RrMode;
      if (mode === 'reactions') {
        const parsed = parseEmoji(emojiDisplay);
        if (parsed) {
          await removeOwnReaction(
            msg.channel_id as string,
            messageId,
            parsed.urlForm,
          ).catch((err) => console.error('[rr] removeOwnReaction:', err));
        }
      }
      await refreshRrEmbed(messageId);
    }

    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}
