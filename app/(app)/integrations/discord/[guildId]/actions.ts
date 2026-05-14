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

async function assertCanManage(guildId: string): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht eingeloggt.');

  const token = await getFreshAccessToken(user.id);
  if (!token) throw new Error('Discord-Verbindung abgelaufen.');

  const guilds = await fetchCurrentUserGuilds(token);
  const g = guilds.find((x) => x.id === guildId);
  if (!g) throw new Error('Server nicht gefunden.');
  if (!g.owner && !canManageGuild(g.permissions)) {
    throw new Error('Keine Berechtigung.');
  }
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
