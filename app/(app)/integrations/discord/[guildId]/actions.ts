'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFreshAccessToken } from '@/lib/discordConnection';
import { canManageGuild, fetchCurrentUser, fetchCurrentUserGuilds } from '@/lib/discord';
import {
  addReaction,
  deleteMessage,
  editMessage,
  fetchGuildMembers,
  postMessage,
  removeOwnReaction,
  type EmbedPayload,
} from '@/lib/discordBot';
import {
  fetchGuildRoles,
  invalidateGuildCache,
  fetchUserBasic,
  userAvatarUrl,
} from '@/lib/discord';
import {
  createChannelWebhook,
  deleteWebhookViaBot,
  getWebhookInfo,
  sendBotMessageWithFiles,
  sendViaWebhook,
} from '@/lib/discordWebhook';
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

// ============== Embed-Creator v2: Multi-Embed-Payload ==============

export type EmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type EmbedAuthor = {
  name: string;
  url?: string;
  icon_url?: string;
};

export type EmbedFooter = {
  text: string;
  icon_url?: string;
};

export type EmbedV2 = {
  author?: EmbedAuthor;
  title?: string;
  title_url?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  image?: string;
  thumbnail?: string;
  footer?: EmbedFooter;
  timestamp?: boolean;
};

export type MessagePayloadV2 = {
  content?: string;
  embeds?: EmbedV2[];
};

function buildDiscordEmbed(e: EmbedV2): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (e.author?.name) {
    out.author = {
      name: e.author.name.slice(0, 256),
      ...(e.author.url ? { url: e.author.url } : {}),
      ...(e.author.icon_url ? { icon_url: e.author.icon_url } : {}),
    };
  }
  if (e.title) out.title = e.title.slice(0, 256);
  if (e.title_url) out.url = e.title_url;
  if (e.description) out.description = e.description.slice(0, 4000);
  if (typeof e.color === 'number') out.color = e.color;
  if (e.image) out.image = { url: e.image };
  if (e.thumbnail) out.thumbnail = { url: e.thumbnail };
  if (e.footer?.text) {
    out.footer = {
      text: e.footer.text.slice(0, 2048),
      ...(e.footer.icon_url ? { icon_url: e.footer.icon_url } : {}),
    };
  }
  if (e.timestamp) out.timestamp = new Date().toISOString();
  if (e.fields && e.fields.length > 0) {
    out.fields = e.fields
      .slice(0, 25)
      .filter((f) => f.name?.trim() && f.value?.trim())
      .map((f) => ({
        name: f.name.slice(0, 256),
        value: f.value.slice(0, 1024),
        inline: Boolean(f.inline),
      }));
  }
  return out;
}

export async function sendBotMessage(
  guildId: string,
  channelId: string,
  payload: MessagePayloadV2,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const content = payload.content?.trim();
    const embeds = (payload.embeds ?? [])
      .slice(0, 10)
      .map(buildDiscordEmbed)
      .filter((e) => Object.keys(e).length > 0);
    if (!content && embeds.length === 0) {
      return { ok: false, error: 'Content oder mindestens ein Embed nötig.' };
    }
    const body: Record<string, unknown> = {};
    if (content) body.content = content.slice(0, 2000);
    if (embeds.length > 0) body.embeds = embeds;
    try {
      await postMessage(channelId, body);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Discord-Fehler.',
      };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Components (Link- + Action-Buttons) ==============

export type LinkButton = {
  kind?: 'link' | 'role';
  label: string;
  url?: string;
  roleId?: string;
  emoji?: string;
  style?: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
};

export type ComponentRow = {
  buttons: LinkButton[];
};

const BUTTON_STYLE_MAP: Record<NonNullable<LinkButton['style']>, number> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
  link: 5,
};

function parseLinkButtonEmoji(
  raw: string | undefined,
): { id?: string; name?: string; animated?: boolean } | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const customMatch = trimmed.match(/^<(a?):([\w~]+):(\d+)>$/);
  if (customMatch) {
    const [, animated, name, id] = customMatch;
    return { id, name, animated: animated === 'a' };
  }
  return { name: trimmed };
}

function buildComponentsPayload(rows: ComponentRow[]): unknown[] {
  return rows
    .slice(0, 5)
    .map((row) => ({
      type: 1,
      components: row.buttons
        .slice(0, 5)
        .map((b) => {
          const kind = b.kind ?? 'link';
          const btn: Record<string, unknown> = {
            type: 2,
            label: (b.label || ' ').slice(0, 80),
          };
          if (kind === 'role') {
            if (!b.roleId) return null;
            btn.custom_id = `ec:role:${b.roleId}`;
            btn.style =
              BUTTON_STYLE_MAP[(b.style ?? 'secondary') as NonNullable<LinkButton['style']>] ??
              2;
            // Link-Style geht nicht für custom_id-Buttons → fallback secondary
            if (btn.style === 5) btn.style = 2;
          } else {
            // Link-Button
            if (!b.url) return null;
            btn.style = 5;
            btn.url = b.url;
          }
          const emoji = parseLinkButtonEmoji(b.emoji);
          if (emoji) btn.emoji = emoji;
          return btn;
        })
        .filter((b): b is Record<string, unknown> => b !== null),
    }))
    .filter((row) => Array.isArray(row.components) && row.components.length > 0);
}

// ============== Webhook-Management ==============

async function getOrCreateChannelWebhook(
  guildId: string,
  channelId: string,
  name = 'Kanbanly Webhook',
): Promise<{ id: string; token: string }> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('bot_webhooks')
    .select('webhook_id, webhook_token')
    .eq('guild_id', guildId)
    .eq('channel_id', channelId)
    .maybeSingle();
  if (existing) {
    const id = existing.webhook_id as string;
    const token = existing.webhook_token as string;
    const info = await getWebhookInfo(id, token);
    if (info.ok) return { id, token };
    // Token nicht mehr gültig → neu erstellen
    await admin
      .from('bot_webhooks')
      .delete()
      .eq('guild_id', guildId)
      .eq('channel_id', channelId);
  }
  const wh = await createChannelWebhook(channelId, name);
  await admin
    .from('bot_webhooks')
    .insert({
      guild_id: guildId,
      channel_id: channelId,
      webhook_id: wh.id,
      webhook_token: wh.token,
      name: wh.name,
    })
    .then(undefined, (err) => {
      console.error('[webhook] insert:', err);
    });
  return { id: wh.id, token: wh.token };
}

// ============== Voll-Send: Bot oder Webhook, mit Files + Components ==============

export async function sendBotEmbedComposed(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const guildId = String(formData.get('guildId') ?? '');
    const channelId = String(formData.get('channelId') ?? '');
    if (!guildId || !channelId) {
      return { ok: false, error: 'Channel oder Guild fehlt.' };
    }
    await assertCanManage(guildId);

    const payloadRaw = String(formData.get('payload') ?? '{}');
    const parsed = JSON.parse(payloadRaw) as {
      content?: string;
      embeds?: EmbedV2[];
      components?: ComponentRow[];
      webhookMode?: boolean;
      username?: string;
      avatarUrl?: string;
    };

    const content = parsed.content?.trim();
    const embedsOut = (parsed.embeds ?? [])
      .slice(0, 10)
      .map(buildDiscordEmbed)
      .filter((e) => Object.keys(e).length > 0);
    const componentsOut = parsed.components
      ? buildComponentsPayload(parsed.components)
      : [];

    const files = formData.getAll('files').filter((v): v is File => v instanceof File);
    if (files.length > 10) {
      return { ok: false, error: 'Max 10 Attachments pro Nachricht.' };
    }
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) {
        return { ok: false, error: `Datei „${f.name}" ist größer als 25 MB.` };
      }
    }

    if (!content && embedsOut.length === 0 && componentsOut.length === 0 && files.length === 0) {
      return { ok: false, error: 'Nachricht ist leer.' };
    }

    const basePayload: Record<string, unknown> = {};
    if (content) basePayload.content = content.slice(0, 2000);
    if (embedsOut.length > 0) basePayload.embeds = embedsOut;
    if (componentsOut.length > 0) basePayload.components = componentsOut;

    if (parsed.webhookMode) {
      const wh = await getOrCreateChannelWebhook(guildId, channelId);
      const whPayload: Record<string, unknown> = { ...basePayload };
      const u = parsed.username?.trim();
      const a = parsed.avatarUrl?.trim();
      if (u) whPayload.username = u.slice(0, 80);
      if (a) whPayload.avatar_url = a;
      return await sendViaWebhook(wh.id, wh.token, whPayload, files);
    }

    return await sendBotMessageWithFiles(channelId, basePayload, files);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// Webhook-Verwaltung exportiert für UI
export async function deleteChannelWebhook(
  guildId: string,
  channelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('bot_webhooks')
      .select('webhook_id')
      .eq('guild_id', guildId)
      .eq('channel_id', channelId)
      .maybeSingle();
    if (row?.webhook_id) {
      await deleteWebhookViaBot(row.webhook_id as string).catch(() => {});
    }
    await admin
      .from('bot_webhooks')
      .delete()
      .eq('guild_id', guildId)
      .eq('channel_id', channelId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// Legacy single-embed-send (für Backwards-Compat behalten — wird vom EmbedCreator nicht mehr genutzt)
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
  return sendBotMessage(guildId, channelId, {
    embeds: [
      {
        title: embed.title,
        description: embed.description,
        color: embed.color,
        footer: embed.footer ? { text: embed.footer } : undefined,
        image: embed.image,
      },
    ],
  });
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
    const panelTitle = (formData.get('panel_title') as string | null)?.trim() || null;
    const panelColorRaw = (formData.get('panel_color') as string | null)?.trim() || null;
    const panelColor =
      panelColorRaw && /^#?[0-9a-f]{6}$/i.test(panelColorRaw)
        ? parseInt(panelColorRaw.replace('#', ''), 16)
        : null;
    const buttonLabel =
      (formData.get('button_label') as string | null)?.trim() || null;
    const buttonEmoji =
      (formData.get('button_emoji') as string | null)?.trim() || null;
    const buttonStyleRaw =
      (formData.get('button_style') as string | null)?.trim() || 'primary';
    const buttonStyle = ['primary', 'secondary', 'success', 'danger'].includes(
      buttonStyleRaw,
    )
      ? buttonStyleRaw
      : 'primary';
    const replySuccess =
      (formData.get('reply_success') as string | null)?.trim() || null;
    const replyAlready =
      (formData.get('reply_already') as string | null)?.trim() || null;

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
        verify_panel_title: panelTitle,
        verify_panel_color: panelColor,
        verify_button_label: buttonLabel,
        verify_button_emoji: buttonEmoji,
        verify_button_style: buttonStyle,
        verify_reply_success: replySuccess,
        verify_reply_already: replyAlready,
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

const STYLE_TO_NUM: Record<string, number> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
};

function parseButtonEmoji(
  raw: string | null,
): { id?: string; name?: string; animated?: boolean } | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Custom-Emoji-Format: <:name:id> oder <a:name:id>
  const customMatch = trimmed.match(/^<(a?):([\w~]+):(\d+)>$/);
  if (customMatch) {
    const [, animated, name, id] = customMatch;
    return { id, name, animated: animated === 'a' };
  }
  // Unicode-Emoji — Discord akzeptiert nur „echte" Emojis,
  // keine Unicode-Symbole wie ✓. Wir geben den String direkt durch.
  return { name: trimmed };
}

export async function postVerifyPanel(
  guildId: string,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('bot_guilds')
      .select(
        'verify_channel_id, verify_message, verify_panel_message_id, verify_panel_title, verify_panel_color, verify_button_label, verify_button_emoji, verify_button_style',
      )
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!row?.verify_channel_id) {
      return { ok: false, error: 'Kein Channel konfiguriert.' };
    }
    const channelId = row.verify_channel_id as string;
    const message =
      (row.verify_message as string | null) ??
      'Klick auf **Verifizieren**, um Zugriff zu bekommen.';
    const title =
      (row.verify_panel_title as string | null) ?? '🛡️ Verifizierung';
    const color = (row.verify_panel_color as number | null) ?? 0x5865f2;
    const buttonLabel =
      (row.verify_button_label as string | null) ?? 'Verifizieren';
    const buttonEmojiRaw = (row.verify_button_emoji as string | null) ?? null;
    const buttonStyleStr =
      (row.verify_button_style as string | null) ?? 'primary';
    const buttonStyle = STYLE_TO_NUM[buttonStyleStr] ?? 1;

    // Alte Panel-Nachricht löschen, falls vorhanden.
    if (row.verify_panel_message_id) {
      await deleteMessage(channelId, row.verify_panel_message_id as string).catch(
        () => {},
      );
    }

    const buttonComponent: Record<string, unknown> = {
      type: 2,
      style: buttonStyle,
      custom_id: 'verify:btn',
      label: buttonLabel,
    };
    const emoji = parseButtonEmoji(buttonEmojiRaw);
    if (emoji) buttonComponent.emoji = emoji;

    const payload = {
      embeds: [
        {
          title,
          description: message,
          color,
        },
      ],
      components: [
        {
          type: 1,
          components: [buttonComponent],
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

type GiveawayButtonStyleAct = 'primary' | 'secondary' | 'success' | 'danger';
const GW_STYLE_MAP: Record<GiveawayButtonStyleAct, number> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
};

function applyGwTemplate(
  template: string,
  ctx: { prize: string; endsAtUnix: number; winners: number; entries: number },
): string {
  return template
    .replaceAll('{prize}', ctx.prize)
    .replaceAll('{winners}', String(ctx.winners))
    .replaceAll('{entries}', String(ctx.entries))
    .replaceAll('{ends}', `<t:${ctx.endsAtUnix}:R>`)
    .replaceAll('{ends_long}', `<t:${ctx.endsAtUnix}:F>`);
}

function parseGwEmoji(
  raw: string | null,
): { id?: string; name?: string; animated?: boolean } | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const customMatch = trimmed.match(/^<(a?):([\w~]+):(\d+)>$/);
  if (customMatch) {
    const [, animated, name, id] = customMatch;
    return { id, name, animated: animated === 'a' };
  }
  return { name: trimmed };
}

export async function createGiveawayFromWeb(
  guildId: string,
  input: {
    channelId: string;
    prize: string;
    winnersCount: number;
    durationMs: number;
    embedColor?: number | null;
    embedTitle?: string | null;
    embedDescription?: string | null;
    buttonLabel?: string | null;
    buttonEmoji?: string | null;
    buttonStyle?: GiveawayButtonStyleAct | null;
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
        embed_color: input.embedColor ?? null,
        embed_title: input.embedTitle ?? null,
        embed_description: input.embedDescription ?? null,
        button_label: input.buttonLabel ?? null,
        button_emoji: input.buttonEmoji ?? null,
        button_style: input.buttonStyle ?? null,
      })
      .select('id')
      .single();
    if (insErr || !gw) throw insErr ?? new Error('Insert fehlgeschlagen.');

    const endsAtUnix = Math.floor(endsAt.getTime() / 1000);
    const ctx = {
      prize: input.prize.trim(),
      endsAtUnix,
      winners: input.winnersCount,
      entries: 0,
    };
    const titleTemplate = input.embedTitle?.trim() || '🎉  {prize}';
    const descTemplate =
      input.embedDescription?.trim() ||
      [
        'Endet: {ends}',
        'Gewinner: **{winners}**',
        'Teilnehmer: **{entries}**',
        '',
        'Klick auf den Button, um mitzumachen.',
      ].join('\n');
    const buttonStyle = GW_STYLE_MAP[input.buttonStyle ?? 'primary'] ?? 1;
    const buttonComponent: Record<string, unknown> = {
      type: 2,
      style: buttonStyle,
      custom_id: `gw:join:${gw.id}`,
      label: (input.buttonLabel?.trim() || 'Teilnehmen').slice(0, 80),
    };
    const emoji = parseGwEmoji(input.buttonEmoji?.trim() || '🎉');
    if (emoji) buttonComponent.emoji = emoji;

    const payload = {
      embeds: [
        {
          title: applyGwTemplate(titleTemplate, ctx).slice(0, 256),
          description: applyGwTemplate(descTemplate, ctx).slice(0, 4000),
          color: input.embedColor ?? 0xa855f7,
        },
      ],
      components: [
        {
          type: 1,
          components: [buttonComponent],
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

export type GiveawayEntry = {
  userId: string;
  username: string | null;
  globalName: string | null;
  avatarUrl: string | null;
  joinedAt: string;
};

export async function listGiveawayParticipants(
  guildId: string,
  giveawayId: string,
): Promise<{ ok: boolean; error?: string; entries?: GiveawayEntry[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    // Sicherstellen dass das Giveaway zum Guild gehört (RLS umgangen → manuell prüfen).
    const { data: gw } = await admin
      .from('bot_giveaways')
      .select('id')
      .eq('id', giveawayId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!gw) return { ok: false, error: 'Giveaway nicht gefunden.' };

    const { data: rows, error } = await admin
      .from('bot_giveaway_entries')
      .select('user_id, joined_at')
      .eq('giveaway_id', giveawayId)
      .order('joined_at', { ascending: true })
      .limit(500);
    if (error) throw error;

    // User-Infos parallel laden (gecacht, max 500 Calls beim ersten Aufruf).
    const entries: GiveawayEntry[] = await Promise.all(
      (rows ?? []).map(async (r) => {
        const userId = r.user_id as string;
        const user = await fetchUserBasic(userId);
        return {
          userId,
          username: user?.username ?? null,
          globalName: user?.global_name ?? null,
          avatarUrl: user
            ? userAvatarUrl({ id: user.id, avatar: user.avatar })
            : null,
          joinedAt: r.joined_at as string,
        };
      }),
    );
    return { ok: true, entries };
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

export async function refreshGuildCache(
  guildId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    invalidateGuildCache(guildId);
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Geburtstage ==============

export async function updateBirthdayConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const channelId = (formData.get('channel_id') as string | null)?.trim() || null;
    const message = (formData.get('message') as string | null)?.trim() || null;
    if (enabled && !channelId) {
      return { ok: false, error: 'Channel ist nötig wenn Geburtstage aktiv.' };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        birthday_enabled: enabled,
        birthday_channel_id: channelId,
        birthday_message: message,
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

// ============== Rollen-Badge ==============

export async function updateRoleBadgesEnabled(
  guildId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        role_badges_enabled: enabled,
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

export async function addRoleBadge(
  guildId: string,
  roleId: string,
  daysRequired: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    if (!roleId || daysRequired < 1 || daysRequired > 9999) {
      return { ok: false, error: 'Ungültige Eingabe.' };
    }
    const admin = createAdminClient();
    const { error } = await admin.from('bot_role_badges').upsert(
      {
        guild_id: guildId,
        role_id: roleId,
        days_required: daysRequired,
      },
      { onConflict: 'guild_id,role_id' },
    );
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function removeRoleBadge(
  guildId: string,
  roleId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_role_badges')
      .delete()
      .eq('guild_id', guildId)
      .eq('role_id', roleId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== AFK-Room ==============

export async function updateAfkConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const channelId = (formData.get('channel_id') as string | null)?.trim() || null;
    const timeoutMinutes = Math.max(
      1,
      Math.min(
        240,
        parseInt(String(formData.get('timeout_minutes') ?? '10'), 10) || 10,
      ),
    );
    if (enabled && !channelId) {
      return { ok: false, error: 'AFK-Channel nötig.' };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        afk_enabled: enabled,
        afk_channel_id: channelId,
        afk_timeout_minutes: timeoutMinutes,
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

// ============== Vorschlags-System ==============

const SUGGESTION_FIELD_KEYS = ['id', 'status', 'upvotes', 'downvotes', 'banner'] as const;
type SuggestionFieldKey = (typeof SUGGESTION_FIELD_KEYS)[number];

function parseHexColor(raw: string | null): number | null {
  if (!raw) return null;
  const t = raw.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(t)) return null;
  return parseInt(t, 16);
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseFieldOrder(raw: string | null): SuggestionFieldKey[] {
  const out: SuggestionFieldKey[] = [];
  const seen = new Set<SuggestionFieldKey>();
  for (const tok of parseStringArray(raw)) {
    if ((SUGGESTION_FIELD_KEYS as readonly string[]).includes(tok) && !seen.has(tok as SuggestionFieldKey)) {
      out.push(tok as SuggestionFieldKey);
      seen.add(tok as SuggestionFieldKey);
    }
  }
  for (const k of SUGGESTION_FIELD_KEYS) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}

export async function updateSuggestionsConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const channelId = (formData.get('channel_id') as string | null)?.trim() || null;
    const modRoleId = (formData.get('mod_role_id') as string | null)?.trim() || null;
    if (enabled && !channelId) {
      return { ok: false, error: 'Vorschlags-Channel nötig.' };
    }
    const embedTitle =
      ((formData.get('embed_title') as string | null) ?? '').trim().slice(0, 256) ||
      'Neuer Vorschlag';
    const embedMessage =
      ((formData.get('embed_message') as string | null) ?? '').slice(0, 3500) ||
      '{user} hat einen neuen Vorschlag gepostet\n\n{suggestion}';
    const embedColor = parseHexColor(formData.get('embed_color') as string | null) ?? 0x5865f2;
    const footerText =
      ((formData.get('footer_text') as string | null) ?? '').trim().slice(0, 1024) || null;
    const bannerUrl =
      ((formData.get('banner_url') as string | null) ?? '').trim().slice(0, 1024) || null;
    const thumbnailUrl =
      ((formData.get('thumbnail_url') as string | null) ?? '').trim().slice(0, 1024) || null;
    const upvoteEmoji =
      ((formData.get('upvote_emoji') as string | null) ?? '').trim().slice(0, 120) || null;
    const downvoteEmoji =
      ((formData.get('downvote_emoji') as string | null) ?? '').trim().slice(0, 120) || null;
    const statusOpenEmoji =
      ((formData.get('status_open_emoji') as string | null) ?? '').trim().slice(0, 120) || null;
    const statusEndedEmoji =
      ((formData.get('status_ended_emoji') as string | null) ?? '').trim().slice(0, 120) || null;
    const endMessage =
      ((formData.get('end_message') as string | null) ?? '').trim().slice(0, 1024) ||
      'Dieser Vorschlag wurde beendet.';
    const allowedRoleIds = parseStringArray(
      formData.get('allowed_role_ids') as string | null,
    ).slice(0, 50);
    const fieldOrder = parseFieldOrder(formData.get('field_order') as string | null);

    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        suggestions_enabled: enabled,
        suggestions_channel_id: channelId,
        suggestions_mod_role_id: modRoleId,
        suggestions_embed_title: embedTitle,
        suggestions_embed_message: embedMessage,
        suggestions_embed_color: embedColor,
        suggestions_footer_text: footerText,
        suggestions_banner_url: bannerUrl,
        suggestions_thumbnail_url: thumbnailUrl,
        suggestions_upvote_emoji: upvoteEmoji,
        suggestions_downvote_emoji: downvoteEmoji,
        suggestions_status_open_emoji: statusOpenEmoji,
        suggestions_status_ended_emoji: statusEndedEmoji,
        suggestions_allowed_role_ids: allowedRoleIds,
        suggestions_end_message: endMessage,
        suggestions_field_order: fieldOrder,
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

// ============== Invite-Tracker ==============

export type InviteLeaderRow = {
  inviterUserId: string;
  username: string | null;
  globalName: string | null;
  avatarUrl: string | null;
  count: number;
};

export async function listInviteLeaderboard(
  guildId: string,
): Promise<{ ok: boolean; error?: string; rows?: InviteLeaderRow[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_invite_attributions')
      .select('inviter_user_id')
      .eq('guild_id', guildId)
      .not('inviter_user_id', 'is', null);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const r of data ?? []) {
      const id = r.inviter_user_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 25);
    const rows = await Promise.all(
      top.map(async ([id, count]) => {
        const u = await fetchUserBasic(id);
        return {
          inviterUserId: id,
          username: u?.username ?? null,
          globalName: u?.global_name ?? null,
          avatarUrl: u ? userAvatarUrl({ id: u.id, avatar: u.avatar }) : null,
          count,
        };
      }),
    );
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updateInviteTrackerEnabled(
  guildId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        invite_tracker_enabled: enabled,
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

// ============== Helpdesk ==============

export type HelpdeskItemInput = {
  id?: string;
  label: string;
  emoji: string | null;
  style: 'primary' | 'secondary' | 'success' | 'danger';
  answer: string;
  answerColor: number | null;
};

const HD_STYLE_MAP: Record<HelpdeskItemInput['style'], number> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
};

function parseHdEmoji(
  raw: string | null,
): { id?: string; name?: string; animated?: boolean } | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const customMatch = trimmed.match(/^<(a?):([\w~]+):(\d+)>$/);
  if (customMatch) {
    const [, animated, name, id] = customMatch;
    return { id, name, animated: animated === 'a' };
  }
  return { name: trimmed };
}

async function buildHelpdeskPayload(
  panelId: string,
): Promise<{ payload: Record<string, unknown>; channelId: string } | null> {
  const admin = createAdminClient();
  const { data: panel } = await admin
    .from('bot_helpdesk_panels')
    .select('channel_id, title, description, color')
    .eq('id', panelId)
    .maybeSingle();
  if (!panel) return null;
  const { data: itemsRaw } = await admin
    .from('bot_helpdesk_items')
    .select('id, label, emoji, style')
    .eq('panel_id', panelId)
    .order('position');

  const items = itemsRaw ?? [];
  // Max 25 Buttons (5 Rows × 5 Buttons)
  const sliced = items.slice(0, 25);
  const rows: Array<{ type: number; components: Array<Record<string, unknown>> }> = [];
  for (let i = 0; i < sliced.length; i += 5) {
    const chunk = sliced.slice(i, i + 5);
    rows.push({
      type: 1,
      components: chunk.map((it) => {
        const btn: Record<string, unknown> = {
          type: 2,
          style:
            HD_STYLE_MAP[(it.style as HelpdeskItemInput['style']) ?? 'secondary'] ?? 2,
          custom_id: `hd:btn:${it.id}`,
          label: (it.label as string).slice(0, 80),
        };
        const emoji = parseHdEmoji((it.emoji as string | null) ?? null);
        if (emoji) btn.emoji = emoji;
        return btn;
      }),
    });
  }
  return {
    channelId: panel.channel_id as string,
    payload: {
      embeds: [
        {
          title: (panel.title as string | null) ?? 'Helpdesk',
          description: (panel.description as string | null) ?? undefined,
          color: (panel.color as number | null) ?? 0x5865f2,
        },
      ],
      components: rows,
    },
  };
}

export async function createHelpdeskPanel(
  guildId: string,
  input: {
    channelId: string;
    title: string;
    description: string | null;
    color: number | null;
  },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    await assertCanManage(guildId);
    if (!input.title.trim()) return { ok: false, error: 'Titel fehlt.' };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_helpdesk_panels')
      .insert({
        guild_id: guildId,
        channel_id: input.channelId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        color: input.color ?? null,
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Insert fehlgeschlagen.');
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updateHelpdeskPanel(
  guildId: string,
  panelId: string,
  input: {
    title: string;
    description: string | null;
    color: number | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_helpdesk_panels')
      .update({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        color: input.color ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', panelId)
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deleteHelpdeskPanel(
  guildId: string,
  panelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: panel } = await admin
      .from('bot_helpdesk_panels')
      .select('channel_id, message_id')
      .eq('id', panelId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (panel?.message_id) {
      await deleteMessage(
        panel.channel_id as string,
        panel.message_id as string,
      ).catch(() => {});
    }
    const { error } = await admin
      .from('bot_helpdesk_panels')
      .delete()
      .eq('id', panelId)
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function upsertHelpdeskItem(
  guildId: string,
  panelId: string,
  item: HelpdeskItemInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    await assertCanManage(guildId);
    if (!item.label.trim() || !item.answer.trim()) {
      return { ok: false, error: 'Label und Antwort sind nötig.' };
    }
    const admin = createAdminClient();
    // Position = max+1 wenn neu
    let position = 0;
    if (!item.id) {
      const { data: maxRows } = await admin
        .from('bot_helpdesk_items')
        .select('position')
        .eq('panel_id', panelId)
        .order('position', { ascending: false })
        .limit(1);
      position = ((maxRows?.[0]?.position as number | null) ?? -1) + 1;
    }
    const payload = {
      panel_id: panelId,
      label: item.label.trim().slice(0, 80),
      emoji: item.emoji?.trim() || null,
      style: item.style,
      answer: item.answer.trim().slice(0, 4000),
      answer_color: item.answerColor ?? null,
    };
    if (item.id) {
      const { error } = await admin
        .from('bot_helpdesk_items')
        .update(payload)
        .eq('id', item.id);
      if (error) throw error;
      revalidatePath(`/integrations/discord/${guildId}`);
      return { ok: true, id: item.id };
    }
    const { data, error } = await admin
      .from('bot_helpdesk_items')
      .insert({ ...payload, position })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Insert fehlgeschlagen.');
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deleteHelpdeskItem(
  guildId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin.from('bot_helpdesk_items').delete().eq('id', itemId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function publishHelpdeskPanel(
  guildId: string,
  panelId: string,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  try {
    await assertCanManage(guildId);
    const built = await buildHelpdeskPayload(panelId);
    if (!built) return { ok: false, error: 'Panel nicht gefunden.' };

    const admin = createAdminClient();
    const { data: panel } = await admin
      .from('bot_helpdesk_panels')
      .select('message_id')
      .eq('id', panelId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (panel?.message_id) {
      await deleteMessage(
        built.channelId,
        panel.message_id as string,
      ).catch(() => {});
    }

    const posted = await postMessage(built.channelId, built.payload);
    await admin
      .from('bot_helpdesk_panels')
      .update({ message_id: posted.id })
      .eq('id', panelId);
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, messageId: posted.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Temp-Voice ==============

export async function updateTempVoiceConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const creatorChannelId =
      (formData.get('creator_channel_id') as string | null)?.trim() || null;
    const categoryId =
      (formData.get('category_id') as string | null)?.trim() || null;
    const nameTemplate =
      (formData.get('name_template') as string | null)?.trim() || null;
    const defaultLimit = Math.max(
      0,
      Math.min(
        99,
        parseInt(String(formData.get('default_limit') ?? '0'), 10) || 0,
      ),
    );
    if (enabled && !creatorChannelId) {
      return { ok: false, error: 'Creator-Channel-ID nötig.' };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        tempvoice_enabled: enabled,
        tempvoice_creator_channel_id: creatorChannelId,
        tempvoice_category_id: categoryId,
        tempvoice_name_template: nameTemplate,
        tempvoice_default_limit: defaultLimit,
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

// ============== Bild des Tages ==============

export async function updateDailyImageConfig(
  guildId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const enabled = formData.get('enabled') === 'on';
    const channelId = (formData.get('channel_id') as string | null)?.trim() || null;
    const hour = Math.max(
      0,
      Math.min(23, parseInt(String(formData.get('hour') ?? '9'), 10) || 9),
    );
    const urlsRaw = String(formData.get('urls') ?? '');
    const urls = urlsRaw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s))
      .slice(0, 365);
    if (enabled && (!channelId || urls.length === 0)) {
      return { ok: false, error: 'Channel und mindestens eine URL nötig.' };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        daily_image_enabled: enabled,
        daily_image_channel_id: channelId,
        daily_image_hour: hour,
        daily_image_urls: urls,
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

// ============== Teamlisten ==============

export type TeamlistRow = {
  id: string;
  channelId: string;
  messageId: string | null;
  title: string;
  roleIds: string[];
  color: number | null;
};

export async function createTeamlist(
  guildId: string,
  input: {
    channelId: string;
    title: string;
    roleIds: string[];
    color: number | null;
  },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    await assertCanManage(guildId);
    if (!input.channelId || !input.title.trim() || input.roleIds.length === 0) {
      return { ok: false, error: 'Channel, Titel, mindestens eine Rolle nötig.' };
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_teamlists')
      .insert({
        guild_id: guildId,
        channel_id: input.channelId,
        title: input.title.trim().slice(0, 100),
        role_ids: input.roleIds,
        color: input.color ?? null,
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Insert fehlgeschlagen.');
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updateTeamlist(
  guildId: string,
  id: string,
  input: {
    title: string;
    roleIds: string[];
    color: number | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_teamlists')
      .update({
        title: input.title.trim().slice(0, 100),
        role_ids: input.roleIds,
        color: input.color ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function refreshTeamlistNow(
  guildId: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from('bot_teamlists')
      .select('id, channel_id, message_id, title, role_ids, color')
      .eq('id', id)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { ok: false, error: 'Teamliste nicht gefunden.' };

    const roleIds = Array.isArray(row.role_ids)
      ? (row.role_ids as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];

    const [roles, members] = await Promise.all([
      fetchGuildRoles(guildId),
      fetchGuildMembers(guildId),
    ]);
    const rolesById = new Map(roles.map((r) => [r.id, r]));
    const sortedRoles = roleIds
      .map((rid) => rolesById.get(rid))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .sort((a, b) => b.position - a.position);

    const lines: string[] = [];
    for (const role of sortedRoles) {
      const inRole = members
        .filter((m) => !m.bot && m.roles.includes(role.id))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      lines.push(`**${role.name}** · ${inRole.length}`);
      if (inRole.length === 0) {
        lines.push('_— niemand —_');
      } else {
        for (const m of inRole) lines.push(`• <@${m.id}>`);
      }
      lines.push('');
    }
    const description = lines.join('\n').slice(0, 4000) || '_Keine Rollen konfiguriert._';

    const embed: EmbedPayload = {
      title: (row.title as string | null) ?? 'Team',
      description,
    };
    const color = row.color as number | null;
    if (typeof color === 'number') embed.color = color;

    const channelId = row.channel_id as string;
    const messageId = row.message_id as string | null;

    let newMessageId = messageId;
    if (messageId) {
      try {
        await editMessage(channelId, messageId, { embeds: [embed] });
      } catch {
        // Message wurde wahrscheinlich gelöscht — neu posten.
        const posted = await postMessage(channelId, { embeds: [embed] });
        newMessageId = posted.id;
      }
    } else {
      const posted = await postMessage(channelId, { embeds: [embed] });
      newMessageId = posted.id;
    }

    await admin
      .from('bot_teamlists')
      .update({
        message_id: newMessageId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deleteTeamlist(
  guildId: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('bot_teamlists')
      .select('channel_id, message_id')
      .eq('id', id)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (row?.message_id) {
      await deleteMessage(
        row.channel_id as string,
        row.message_id as string,
      ).catch(() => {});
    }
    const { error } = await admin
      .from('bot_teamlists')
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

// ============== Tickets v3 ==============

type TicketButtonStyleAct = 'primary' | 'secondary' | 'success' | 'danger';
const TICKET_STYLE_MAP: Record<TicketButtonStyleAct, number> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
};

export type FeedbackModeAct = 'dm' | 'channel' | 'both';

export type PanelTicketButtonAct = {
  id: string;
  kind: 'ticket';
  label: string;
  emoji?: string | null;
  style: TicketButtonStyleAct;
  categoryId?: string | null;
  staffRoleIds?: string[];
  welcomeMessage?: string | null;
  namePattern?: string | null;
};
export type PanelLinkButtonAct = {
  id: string;
  kind: 'link';
  label: string;
  emoji?: string | null;
  url: string;
};
export type PanelButtonAct = PanelTicketButtonAct | PanelLinkButtonAct;

export type PanelSelectMenuAct = {
  enabled: boolean;
  placeholder: string;
  options: Array<{
    label: string;
    description?: string | null;
    emoji?: string | null;
    buttonId: string;
  }>;
};

export type PanelEmbedFieldAct = {
  name: string;
  value: string;
  inline?: boolean;
};

export type PanelEmbedPayloadAct = {
  title?: string | null;
  description?: string | null;
  color?: number | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  footer?: string | null;
  author?: string | null;
  fields?: PanelEmbedFieldAct[];
};

export type TicketPanelRow = {
  id: string;
  channelId: string;
  messageId: string;
  staffRoleId: string;
  staffRoleIds: string[];
  categoryId: string | null;
  title: string;
  description: string;
  buttonLabel: string;
  buttonEmoji: string | null;
  buttonStyle: TicketButtonStyleAct;
  color: number | null;
  welcomeMessage: string | null;
  buttons: PanelButtonAct[];
  selectMenu: PanelSelectMenuAct | null;
  embedPayload: PanelEmbedPayloadAct | null;
  feedbackEnabled: boolean;
  feedbackMode: FeedbackModeAct;
  feedbackQuestion: string;
  inactivityHours: number | null;
  autoCloseHours: number | null;
  staffSlaMinutes: number | null;
  namePattern: string;
};

export type TicketFeedbackRow = {
  id: string;
  ticketId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type TicketSummary = {
  id: string;
  channelId: string;
  ownerUserId: string;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  panelId: string | null;
  createdAt: string;
  closedAt: string | null;
  closedBy: string | null;
  hasTranscript: boolean;
};

export type TranscriptMessageAct = {
  id: string;
  author: { id: string; username: string; avatarUrl: string | null };
  content: string;
  timestamp: string;
  attachments: Array<{ url: string; name: string }>;
  embedsCount: number;
};

function parseTicketEmoji(
  raw: string | null,
): { id?: string; name?: string; animated?: boolean } | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const customMatch = trimmed.match(/^<(a?):([\w~]+):(\d+)>$/);
  if (customMatch) {
    const [, animated, name, id] = customMatch;
    return { id, name, animated: animated === 'a' };
  }
  return { name: trimmed };
}

function buildEmbedFromPayload(
  panel: Pick<TicketPanelRow, 'title' | 'description' | 'color' | 'embedPayload'>,
): Record<string, unknown> {
  const p = panel.embedPayload;
  if (p && (p.title || p.description || p.imageUrl || (p.fields && p.fields.length > 0))) {
    const embed: Record<string, unknown> = {
      color: p.color ?? panel.color ?? 0x380d52,
    };
    if (p.title) embed.title = String(p.title).slice(0, 256);
    if (p.description) embed.description = String(p.description).slice(0, 4000);
    if (p.author) embed.author = { name: String(p.author).slice(0, 256) };
    if (p.footer) embed.footer = { text: String(p.footer).slice(0, 2048) };
    if (p.imageUrl) embed.image = { url: p.imageUrl };
    if (p.thumbnailUrl) embed.thumbnail = { url: p.thumbnailUrl };
    if (p.fields && p.fields.length > 0) {
      embed.fields = p.fields.slice(0, 25).map((f) => ({
        name: (f.name || '​').slice(0, 256),
        value: (f.value || '​').slice(0, 1024),
        inline: Boolean(f.inline),
      }));
    }
    return embed;
  }
  return {
    title: panel.title.slice(0, 256),
    description: panel.description.slice(0, 4000),
    color: panel.color ?? 0x380d52,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function buildTicketPanelPayload(panel: TicketPanelRow): Promise<Record<string, unknown>> {
  const embed = buildEmbedFromPayload(panel);

  const buttons: PanelButtonAct[] =
    panel.buttons && panel.buttons.length > 0
      ? panel.buttons
      : [
          {
            id: 'default',
            kind: 'ticket',
            label: panel.buttonLabel || 'Ticket öffnen',
            emoji: panel.buttonEmoji,
            style: panel.buttonStyle,
          },
        ];

  const components: Array<Record<string, unknown>> = [];

  if (panel.selectMenu?.enabled && panel.selectMenu.options.length > 0) {
    const opts = panel.selectMenu.options.slice(0, 25).map((o) => {
      const obj: Record<string, unknown> = {
        label: o.label.slice(0, 100),
        value: o.buttonId,
      };
      if (o.description) obj.description = String(o.description).slice(0, 100);
      const emoji = parseTicketEmoji(o.emoji ?? null);
      if (emoji) obj.emoji = emoji;
      return obj;
    });
    components.push({
      type: 1,
      components: [
        {
          type: 3,
          custom_id: `ticket-select:${panel.id}`,
          placeholder: (panel.selectMenu.placeholder || 'Kategorie wählen…').slice(0, 100),
          options: opts,
          min_values: 1,
          max_values: 1,
        },
      ],
    });
  } else {
    for (const row of chunkArray(buttons.slice(0, 25), 5)) {
      components.push({
        type: 1,
        components: row.map((b) => {
          const obj: Record<string, unknown> = {
            type: 2,
            label: (b.label || 'Button').slice(0, 80),
          };
          const emoji = parseTicketEmoji(b.emoji ?? null);
          if (emoji) obj.emoji = emoji;
          if (b.kind === 'link') {
            obj.style = 5;
            obj.url = b.url;
          } else {
            obj.style = TICKET_STYLE_MAP[b.style] ?? 1;
            obj.custom_id = `ticket-open:${panel.id}:${b.id}`;
          }
          return obj;
        }),
      });
    }
  }

  return { embeds: [embed], components };
}

const PANEL_COLUMNS =
  'id, channel_id, message_id, staff_role_id, staff_role_ids, category_id, title, description, button_label, button_emoji, button_style, color, welcome_message, buttons, select_menu, embed_payload, feedback_enabled, feedback_mode, feedback_question, inactivity_hours, auto_close_hours, staff_sla_minutes, name_pattern';

function mapPanelRow(r: Record<string, unknown>): TicketPanelRow {
  const staffArr = Array.isArray(r.staff_role_ids) ? (r.staff_role_ids as string[]) : [];
  const staffSingle = (r.staff_role_id as string | null) ?? '';
  return {
    id: r.id as string,
    channelId: r.channel_id as string,
    messageId: r.message_id as string,
    staffRoleId: staffSingle,
    staffRoleIds: staffArr.length > 0 ? staffArr : staffSingle ? [staffSingle] : [],
    categoryId: (r.category_id as string | null) ?? null,
    title: (r.title as string) ?? '🎫 Support öffnen',
    description: (r.description as string) ?? '',
    buttonLabel: (r.button_label as string) ?? 'Ticket öffnen',
    buttonEmoji: (r.button_emoji as string | null) ?? null,
    buttonStyle: ((r.button_style as TicketButtonStyleAct | null) ?? 'primary'),
    color: (r.color as number | null) ?? null,
    welcomeMessage: (r.welcome_message as string | null) ?? null,
    buttons: Array.isArray(r.buttons) ? (r.buttons as PanelButtonAct[]) : [],
    selectMenu:
      r.select_menu && typeof r.select_menu === 'object'
        ? (r.select_menu as PanelSelectMenuAct)
        : null,
    embedPayload:
      r.embed_payload && typeof r.embed_payload === 'object'
        ? (r.embed_payload as PanelEmbedPayloadAct)
        : null,
    feedbackEnabled: Boolean(r.feedback_enabled),
    feedbackMode: ((r.feedback_mode as FeedbackModeAct | null) ?? 'dm'),
    feedbackQuestion:
      (r.feedback_question as string | null) ?? 'Wie zufrieden warst du mit dem Support?',
    inactivityHours: (r.inactivity_hours as number | null) ?? null,
    autoCloseHours: (r.auto_close_hours as number | null) ?? null,
    staffSlaMinutes: (r.staff_sla_minutes as number | null) ?? null,
    namePattern: (r.name_pattern as string | null) ?? 'ticket-{user}',
  };
}

export async function listTicketPanels(
  guildId: string,
): Promise<{ ok: boolean; error?: string; panels?: TicketPanelRow[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_ticket_panels')
      .select(PANEL_COLUMNS)
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return {
      ok: true,
      panels: (data ?? []).map((r) => mapPanelRow(r as Record<string, unknown>)),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export type TicketPanelInput = {
  channelId: string;
  staffRoleIds: string[];
  categoryId: string | null;
  title: string;
  description: string;
  buttonLabel: string;
  buttonEmoji: string | null;
  buttonStyle: TicketButtonStyleAct;
  color: number | null;
  welcomeMessage: string | null;
  buttons: PanelButtonAct[];
  selectMenu: PanelSelectMenuAct | null;
  embedPayload: PanelEmbedPayloadAct | null;
  feedbackEnabled: boolean;
  feedbackMode: FeedbackModeAct;
  feedbackQuestion: string;
  inactivityHours: number | null;
  autoCloseHours: number | null;
  staffSlaMinutes: number | null;
  namePattern: string;
};

function sanitizePanelInput(input: TicketPanelInput) {
  const staffArr = Array.from(new Set(input.staffRoleIds.filter(Boolean)));
  return {
    channel_id: input.channelId,
    staff_role_id: staffArr[0] ?? '',
    staff_role_ids: staffArr,
    category_id: input.categoryId,
    title: input.title.trim().slice(0, 256) || '🎫 Support öffnen',
    description: input.description.trim().slice(0, 4000),
    button_label: input.buttonLabel.trim().slice(0, 80) || 'Ticket öffnen',
    button_emoji: input.buttonEmoji?.trim() || null,
    button_style: input.buttonStyle,
    color: input.color ?? null,
    welcome_message: input.welcomeMessage?.trim() || null,
    buttons: input.buttons ?? [],
    select_menu: input.selectMenu,
    embed_payload: input.embedPayload,
    feedback_enabled: input.feedbackEnabled,
    feedback_mode: input.feedbackMode,
    feedback_question:
      input.feedbackQuestion.trim().slice(0, 200) ||
      'Wie zufrieden warst du mit dem Support?',
    inactivity_hours: input.inactivityHours,
    auto_close_hours: input.autoCloseHours,
    staff_sla_minutes: input.staffSlaMinutes,
    name_pattern: input.namePattern.trim().slice(0, 50) || 'ticket-{user}',
  };
}

export async function createTicketPanelWeb(
  guildId: string,
  input: TicketPanelInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { userId } = await assertCanManage(guildId);
    if (!input.channelId || input.staffRoleIds.length === 0 || !input.title.trim()) {
      return { ok: false, error: 'Channel, mindestens eine Staff-Rolle und Titel sind nötig.' };
    }
    const admin = createAdminClient();

    const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = sanitizePanelInput(input);
    const { data: panel, error: insertError } = await admin
      .from('bot_ticket_panels')
      .insert({
        guild_id: guildId,
        message_id: tempMessageId,
        created_by: userId,
        ...payload,
      })
      .select(PANEL_COLUMNS)
      .single();
    if (insertError || !panel) throw insertError ?? new Error('Insert fehlgeschlagen.');

    const panelRow = mapPanelRow(panel as Record<string, unknown>);
    const discordPayload = await buildTicketPanelPayload(panelRow);

    try {
      const posted = await postMessage(input.channelId, discordPayload);
      await admin
        .from('bot_ticket_panels')
        .update({ message_id: posted.id })
        .eq('id', panel.id);
    } catch (err) {
      await admin.from('bot_ticket_panels').delete().eq('id', panel.id);
      return {
        ok: false,
        error: `Discord-Post fehlgeschlagen: ${
          err instanceof Error ? err.message : 'unbekannt'
        }`,
      };
    }

    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: panel.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updateTicketPanelWeb(
  guildId: string,
  panelId: string,
  input: TicketPanelInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    if (input.staffRoleIds.length === 0) {
      return { ok: false, error: 'Mindestens eine Staff-Rolle nötig.' };
    }
    const admin = createAdminClient();
    const patch = sanitizePanelInput(input);

    const { data: updated, error } = await admin
      .from('bot_ticket_panels')
      .update(patch)
      .eq('id', panelId)
      .eq('guild_id', guildId)
      .select(PANEL_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!updated) return { ok: false, error: 'Panel nicht gefunden.' };

    const panelRow = mapPanelRow(updated as Record<string, unknown>);
    if (panelRow.messageId && panelRow.channelId && !panelRow.messageId.startsWith('temp-')) {
      const discordPayload = await buildTicketPanelPayload(panelRow);
      await editMessage(panelRow.channelId, panelRow.messageId, discordPayload).catch((err) =>
        console.error('[ticket-panel] editMessage:', err),
      );
    }

    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function listTicketFeedbackForGuild(
  guildId: string,
): Promise<{ ok: boolean; error?: string; feedback?: TicketFeedbackRow[]; avgRating?: number }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_ticket_feedback')
      .select('id, ticket_id, user_id, rating, comment, created_at')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows: TicketFeedbackRow[] = (data ?? []).map((r) => ({
      id: r.id as string,
      ticketId: r.ticket_id as string,
      userId: r.user_id as string,
      rating: r.rating as number,
      comment: (r.comment as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
    const avg = rows.length > 0 ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
    return { ok: true, feedback: rows, avgRating: avg };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deleteTicketPanelWeb(
  guildId: string,
  panelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('bot_ticket_panels')
      .select('channel_id, message_id')
      .eq('id', panelId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (row?.message_id) {
      await deleteMessage(row.channel_id as string, row.message_id as string).catch(
        () => {},
      );
    }
    const { error } = await admin
      .from('bot_ticket_panels')
      .delete()
      .eq('id', panelId)
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function listTicketsForGuild(
  guildId: string,
  status: 'open' | 'closed' | 'all' = 'all',
): Promise<{ ok: boolean; error?: string; tickets?: TicketSummary[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    let query = admin
      .from('bot_tickets')
      .select(
        'id, channel_id, owner_user_id, panel_id, created_at, closed_at, closed_by, transcript_saved_at',
      )
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (status === 'open') query = query.is('closed_at', null);
    if (status === 'closed') query = query.not('closed_at', 'is', null);
    const { data, error } = await query;
    if (error) throw error;

    // User-Infos parallel laden
    const userIds = Array.from(
      new Set((data ?? []).map((r) => r.owner_user_id as string)),
    );
    const userMap = new Map<
      string,
      { username: string | null; avatarUrl: string | null }
    >();
    await Promise.all(
      userIds.map(async (id) => {
        const u = await fetchUserBasic(id);
        userMap.set(id, {
          username: u?.global_name ?? u?.username ?? null,
          avatarUrl: u ? userAvatarUrl({ id: u.id, avatar: u.avatar }) : null,
        });
      }),
    );

    return {
      ok: true,
      tickets: (data ?? []).map((r) => {
        const info = userMap.get(r.owner_user_id as string);
        return {
          id: r.id as string,
          channelId: r.channel_id as string,
          ownerUserId: r.owner_user_id as string,
          ownerName: info?.username ?? null,
          ownerAvatarUrl: info?.avatarUrl ?? null,
          panelId: (r.panel_id as string | null) ?? null,
          createdAt: r.created_at as string,
          closedAt: (r.closed_at as string | null) ?? null,
          closedBy: (r.closed_by as string | null) ?? null,
          hasTranscript: Boolean(r.transcript_saved_at),
        };
      }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function getTicketTranscript(
  guildId: string,
  ticketId: string,
): Promise<{
  ok: boolean;
  error?: string;
  ticket?: TicketSummary;
  messages?: TranscriptMessageAct[];
}> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_tickets')
      .select(
        'id, channel_id, owner_user_id, panel_id, created_at, closed_at, closed_by, transcript, transcript_saved_at',
      )
      .eq('id', ticketId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: 'Ticket nicht gefunden.' };

    const owner = await fetchUserBasic(data.owner_user_id as string);
    const transcript = Array.isArray(data.transcript)
      ? (data.transcript as TranscriptMessageAct[])
      : [];

    return {
      ok: true,
      ticket: {
        id: data.id as string,
        channelId: data.channel_id as string,
        ownerUserId: data.owner_user_id as string,
        ownerName: owner?.global_name ?? owner?.username ?? null,
        ownerAvatarUrl: owner
          ? userAvatarUrl({ id: owner.id, avatar: owner.avatar })
          : null,
        panelId: (data.panel_id as string | null) ?? null,
        createdAt: data.created_at as string,
        closedAt: (data.closed_at as string | null) ?? null,
        closedBy: (data.closed_by as string | null) ?? null,
        hasTranscript: Boolean(data.transcript_saved_at),
      },
      messages: transcript,
    };
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
  | 'giveaways'
  | 'birthday'
  | 'rolebadges'
  | 'afk'
  | 'suggestions'
  | 'invitetracker'
  | 'helpdesk'
  | 'tempvoice'
  | 'dailyimage'
  | 'teamlist'
  | 'tickets'
  | 'pricelist'
  | 'shop';

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
      case 'birthday':
        patch.birthday_enabled = enabled;
        break;
      case 'rolebadges':
        patch.role_badges_enabled = enabled;
        break;
      case 'afk':
        patch.afk_enabled = enabled;
        break;
      case 'suggestions':
        patch.suggestions_enabled = enabled;
        break;
      case 'invitetracker':
        patch.invite_tracker_enabled = enabled;
        break;
      case 'tempvoice':
        patch.tempvoice_enabled = enabled;
        break;
      case 'dailyimage':
        patch.daily_image_enabled = enabled;
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
  // V2-Payload (Multi-Embed). Wenn null/leer, fallback auf v1 (title/desc/color etc.)
  payload: MessagePayloadV2 | null;
  // Legacy v1-Felder — bleiben für alte Templates lesbar
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
      .select('id, name, payload, title, description, color, footer, image_url')
      .eq('guild_id', guildId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return {
      ok: true,
      templates: (data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        payload: (r.payload as MessagePayloadV2 | null) ?? null,
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
    payload: MessagePayloadV2;
  },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    await assertCanManage(guildId);
    if (!template.name.trim() || template.name.length > 80) {
      return { ok: false, error: 'Name fehlt oder ist zu lang (max 80).' };
    }
    const admin = createAdminClient();
    const row = {
      guild_id: guildId,
      name: template.name.trim(),
      payload: template.payload as unknown,
      // Legacy-Felder mit Defaults aus payload[0] befüllen (für alte Reader)
      title: template.payload.embeds?.[0]?.title ?? null,
      description: template.payload.embeds?.[0]?.description ?? null,
      color: template.payload.embeds?.[0]?.color ?? null,
      footer: template.payload.embeds?.[0]?.footer?.text ?? null,
      image_url: template.payload.embeds?.[0]?.image ?? null,
      updated_at: new Date().toISOString(),
    };

    if (template.id) {
      const { error } = await admin
        .from('bot_embed_templates')
        .update(row)
        .eq('id', template.id)
        .eq('guild_id', guildId);
      if (error) throw error;
      revalidatePath(`/integrations/discord/${guildId}`);
      return { ok: true, id: template.id };
    }
    const { data, error } = await admin
      .from('bot_embed_templates')
      .insert(row)
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

// ============== Test-Embed senden ==============

type TestCtx = {
  username: string;
  mention: string;
  serverName: string;
  memberCount: number;
};

async function getTestContext(guildId: string): Promise<TestCtx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht eingeloggt.');
  const token = await getFreshAccessToken(user.id);
  let username = 'TestUser';
  let mention = '<@0>';
  if (token) {
    try {
      const u = await fetchCurrentUser(token);
      username = u.global_name ?? u.username;
      mention = `<@${u.id}>`;
    } catch {
      // fallback bleibt
    }
  }
  const admin = createAdminClient();
  const { data: g } = await admin
    .from('bot_guilds')
    .select('name')
    .eq('guild_id', guildId)
    .maybeSingle();
  return {
    username,
    mention,
    serverName: (g?.name as string | null) ?? 'Server',
    memberCount: 100,
  };
}

function renderTestTemplate(text: string, ctx: TestCtx): string {
  return text
    .replaceAll('{user}', ctx.username)
    .replaceAll('{mention}', ctx.mention)
    .replaceAll('{server}', ctx.serverName)
    .replaceAll('{members}', String(ctx.memberCount));
}

const TEST_FOOTER = '⋅ Test-Vorschau (kanbanly Dashboard)';

function buildTestPayload(args: {
  text: string;
  useEmbed: boolean;
  color: number | null;
  title?: string;
}): { content?: string; embeds?: EmbedPayload[] } {
  if (args.useEmbed) {
    const embed: EmbedPayload = {
      description: args.text,
      footer: { text: TEST_FOOTER },
    };
    if (args.title) embed.title = args.title;
    if (typeof args.color === 'number') embed.color = args.color;
    return { embeds: [embed] };
  }
  return { content: `${args.text}\n\n_${TEST_FOOTER}_` };
}

export async function sendTestWelcome(
  guildId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: cfg } = await admin
      .from('bot_guilds')
      .select(
        'welcome_channel_id, welcome_message, welcome_use_embed, welcome_embed_color',
      )
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!cfg || !cfg.welcome_channel_id || !cfg.welcome_message) {
      return { ok: false, error: 'Welcome-Channel und Nachricht konfigurieren + speichern.' };
    }
    const ctx = await getTestContext(guildId);
    const text = renderTestTemplate(cfg.welcome_message as string, ctx);
    const payload = buildTestPayload({
      text,
      useEmbed: Boolean(cfg.welcome_use_embed),
      color: (cfg.welcome_embed_color as number | null) ?? null,
    });
    await postMessage(cfg.welcome_channel_id as string, payload);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function sendTestBooster(
  guildId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: cfg } = await admin
      .from('bot_guilds')
      .select(
        'booster_channel_id, booster_message, booster_use_embed, booster_embed_color',
      )
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!cfg || !cfg.booster_channel_id || !cfg.booster_message) {
      return { ok: false, error: 'Booster-Channel und Nachricht konfigurieren + speichern.' };
    }
    const ctx = await getTestContext(guildId);
    const text = renderTestTemplate(cfg.booster_message as string, ctx);
    const payload = buildTestPayload({
      text,
      useEmbed: Boolean(cfg.booster_use_embed),
      color: (cfg.booster_embed_color as number | null) ?? null,
    });
    await postMessage(cfg.booster_channel_id as string, payload);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function sendTestLevelUp(
  guildId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: cfg } = await admin
      .from('bot_guilds')
      .select('level_up_channel_id, level_use_embed, level_embed_color')
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!cfg || !cfg.level_up_channel_id) {
      return { ok: false, error: 'Level-Up Channel konfigurieren + speichern.' };
    }
    const ctx = await getTestContext(guildId);
    const text = `🎉 ${ctx.mention} ist auf **Level 5** aufgestiegen!`;
    const payload = buildTestPayload({
      text,
      useEmbed: Boolean(cfg.level_use_embed),
      color: (cfg.level_embed_color as number | null) ?? null,
      title: 'Level-Up',
    });
    await postMessage(cfg.level_up_channel_id as string, payload);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function sendTestBirthday(
  guildId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: cfg } = await admin
      .from('bot_guilds')
      .select('birthday_channel_id, birthday_message')
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!cfg || !cfg.birthday_channel_id || !cfg.birthday_message) {
      return { ok: false, error: 'Birthday-Channel und Nachricht konfigurieren + speichern.' };
    }
    const ctx = await getTestContext(guildId);
    const text = renderTestTemplate(cfg.birthday_message as string, ctx);
    const payload = buildTestPayload({ text, useEmbed: false, color: null });
    await postMessage(cfg.birthday_channel_id as string, payload);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function sendTestHelpdeskPanel(
  guildId: string,
  panelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const built = await buildHelpdeskPayload(panelId);
    if (!built) return { ok: false, error: 'Panel nicht gefunden.' };
    const embeds = (built.payload.embeds as Array<Record<string, unknown>> | undefined) ?? [];
    if (embeds[0]) embeds[0].footer = { text: TEST_FOOTER };
    const components =
      (built.payload.components as Record<string, unknown>[] | undefined) ?? [];
    await postMessage(built.channelId, {
      embeds: embeds as unknown as EmbedPayload[],
      components,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function sendTestReactionRoles(
  guildId: string,
  messageId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: msg } = await admin
      .from('bot_reaction_role_messages')
      .select('channel_id, title, description, mode')
      .eq('message_id', messageId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!msg) return { ok: false, error: 'RR-Panel nicht gefunden.' };
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
    const embedObj = embed as unknown as Record<string, unknown>;
    embedObj.footer = { text: TEST_FOOTER };
    const mode = ((msg.mode as RrMode | null) ?? 'reactions') as RrMode;
    // Test-IDs damit Klicks keinen echten Toggle auslösen.
    const components =
      mode === 'reactions'
        ? []
        : buildRrComponents(mode, `test-${messageId}`, rows, new Map());
    await postMessage(msg.channel_id as string, {
      embeds: [embedObj as unknown as EmbedPayload],
      components: components as Record<string, unknown>[],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Suggestion-Panels ==============

export type SuggestionPanelRow = {
  id: string;
  channelId: string;
  messageId: string | null;
  title: string;
  description: string;
  buttonLabel: string;
  buttonEmoji: string | null;
  buttonStyle: TicketButtonStyleAct;
  color: number | null;
};

function parseSugEmoji(
  raw: string | null,
): { id?: string; name?: string; animated?: boolean } | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  const m = t.match(/^<(a?):([\w~]+):(\d+)>$/);
  if (m) {
    const [, animated, name, id] = m;
    return { id, name, animated: animated === 'a' };
  }
  return { name: t };
}

function buildSugPanelPayload(panel: {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonEmoji: string | null;
  buttonStyle: TicketButtonStyleAct;
  color: number | null;
}): Record<string, unknown> {
  const button: Record<string, unknown> = {
    type: 2,
    style: TICKET_STYLE_MAP[panel.buttonStyle] ?? 1,
    custom_id: `sug-open:${panel.id}`,
    label: panel.buttonLabel.slice(0, 80),
  };
  const emoji = parseSugEmoji(panel.buttonEmoji);
  if (emoji) button.emoji = emoji;
  return {
    embeds: [
      {
        title: panel.title.slice(0, 256),
        description: panel.description.slice(0, 4000),
        color: panel.color ?? 0x5865f2,
      },
    ],
    components: [{ type: 1, components: [button] }],
  };
}

export async function listSuggestionPanels(
  guildId: string,
): Promise<{ ok: boolean; error?: string; panels?: SuggestionPanelRow[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_suggestion_panels')
      .select(
        'id, channel_id, message_id, title, description, button_label, button_emoji, button_style, color',
      )
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return {
      ok: true,
      panels: (data ?? []).map((r) => ({
        id: r.id as string,
        channelId: r.channel_id as string,
        messageId: (r.message_id as string | null) ?? null,
        title: (r.title as string) ?? 'Vorschlag einreichen',
        description: (r.description as string) ?? '',
        buttonLabel: (r.button_label as string) ?? 'Vorschlag einreichen',
        buttonEmoji: (r.button_emoji as string | null) ?? null,
        buttonStyle: ((r.button_style as TicketButtonStyleAct | null) ?? 'primary'),
        color: (r.color as number | null) ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export type SuggestionPanelInput = {
  channelId: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonEmoji: string | null;
  buttonStyle: TicketButtonStyleAct;
  color: number | null;
};

function sanitizeSugPanelInput(input: SuggestionPanelInput) {
  return {
    channel_id: input.channelId,
    title: input.title.trim().slice(0, 256) || 'Vorschlag einreichen',
    description: input.description.trim().slice(0, 4000),
    button_label: input.buttonLabel.trim().slice(0, 80) || 'Vorschlag einreichen',
    button_emoji: input.buttonEmoji?.trim() || null,
    button_style: input.buttonStyle,
    color: input.color ?? null,
  };
}

export async function createSuggestionPanelWeb(
  guildId: string,
  input: SuggestionPanelInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { userId } = await assertCanManage(guildId);
    if (!input.channelId || !input.title.trim()) {
      return { ok: false, error: 'Channel und Titel sind nötig.' };
    }
    const admin = createAdminClient();
    const patch = sanitizeSugPanelInput(input);
    const { data: panel, error: insErr } = await admin
      .from('bot_suggestion_panels')
      .insert({ guild_id: guildId, created_by: userId, ...patch })
      .select('id')
      .single();
    if (insErr) {
      console.error('[sug-panel] insert failed:', insErr);
      return {
        ok: false,
        error: `DB-Insert fehlgeschlagen: ${insErr.message ?? insErr.code ?? 'unknown'}`,
      };
    }
    if (!panel) {
      return { ok: false, error: 'Insert lieferte keine Daten.' };
    }

    const payload = buildSugPanelPayload({
      id: panel.id as string,
      title: patch.title,
      description: patch.description,
      buttonLabel: patch.button_label,
      buttonEmoji: patch.button_emoji,
      buttonStyle: patch.button_style as TicketButtonStyleAct,
      color: patch.color,
    });
    try {
      const posted = await postMessage(input.channelId, payload);
      await admin
        .from('bot_suggestion_panels')
        .update({ message_id: posted.id })
        .eq('id', panel.id);
    } catch (err) {
      await admin.from('bot_suggestion_panels').delete().eq('id', panel.id);
      return {
        ok: false,
        error: `Discord-Post fehlgeschlagen: ${err instanceof Error ? err.message : 'unbekannt'}`,
      };
    }
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: panel.id as string };
  } catch (e) {
    console.error('[createSuggestionPanelWeb]', e);
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : JSON.stringify(e);
    return { ok: false, error: `Unerwarteter Fehler: ${msg}` };
  }
}

export async function updateSuggestionPanelWeb(
  guildId: string,
  panelId: string,
  input: SuggestionPanelInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const patch = sanitizeSugPanelInput(input);
    const { data: updated, error } = await admin
      .from('bot_suggestion_panels')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', panelId)
      .eq('guild_id', guildId)
      .select('id, channel_id, message_id, button_style')
      .maybeSingle();
    if (error) {
      console.error('[sug-panel] update failed:', error);
      return {
        ok: false,
        error: `DB-Update fehlgeschlagen: ${error.message ?? error.code ?? 'unknown'}`,
      };
    }
    if (!updated) return { ok: false, error: 'Panel nicht gefunden.' };

    if (updated.message_id) {
      const payload = buildSugPanelPayload({
        id: panelId,
        title: patch.title,
        description: patch.description,
        buttonLabel: patch.button_label,
        buttonEmoji: patch.button_emoji,
        buttonStyle: patch.button_style as TicketButtonStyleAct,
        color: patch.color,
      });
      await editMessage(
        updated.channel_id as string,
        updated.message_id as string,
        payload,
      ).catch((err) => console.error('[sug-panel] editMessage:', err));
    }
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    console.error('[updateSuggestionPanelWeb]', e);
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : JSON.stringify(e);
    return { ok: false, error: `Unerwarteter Fehler: ${msg}` };
  }
}

export async function deleteSuggestionPanelWeb(
  guildId: string,
  panelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('bot_suggestion_panels')
      .select('channel_id, message_id')
      .eq('id', panelId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (row?.message_id) {
      await deleteMessage(
        row.channel_id as string,
        row.message_id as string,
      ).catch(() => {});
    }
    const { error } = await admin
      .from('bot_suggestion_panels')
      .delete()
      .eq('id', panelId)
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function sendTestSuggestionPanel(
  guildId: string,
  panelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: p } = await admin
      .from('bot_suggestion_panels')
      .select(
        'channel_id, title, description, button_label, button_emoji, button_style, color',
      )
      .eq('id', panelId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!p) return { ok: false, error: 'Panel nicht gefunden.' };
    const payload = buildSugPanelPayload({
      id: panelId,
      title: (p.title as string) ?? 'Vorschlag einreichen',
      description: (p.description as string) ?? '',
      buttonLabel: (p.button_label as string) ?? 'Vorschlag einreichen',
      buttonEmoji: (p.button_emoji as string | null) ?? null,
      buttonStyle: ((p.button_style as TicketButtonStyleAct | null) ?? 'primary'),
      color: (p.color as number | null) ?? null,
    });
    const embeds = payload.embeds as Array<Record<string, unknown>>;
    if (embeds[0]) embeds[0].footer = { text: TEST_FOOTER };
    await postMessage(p.channel_id as string, {
      embeds: embeds as unknown as EmbedPayload[],
      components: payload.components as Record<string, unknown>[],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Shop / Bestellsystem ==============

export type ShopStripeStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  accountId: string | null;
};

export type ShopSettings = {
  orderCategoryId: string | null;
  staffRoleId: string | null;
  currency: string;
  platformFeeBps: number;
};

export type ProductRow = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  active: boolean;
  stock: number | null;
  position: number;
};

export type OrderRow = {
  id: string;
  userId: string;
  productId: string | null;
  productName: string;
  amountCents: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded' | 'fulfilled' | 'failed';
  ticketChannelId: string | null;
  customerEmail: string | null;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
};

export async function getShopStatus(
  guildId: string,
): Promise<{
  ok: boolean;
  error?: string;
  stripe?: ShopStripeStatus;
  settings?: ShopSettings;
}> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_guilds')
      .select(
        'stripe_account_id, stripe_charges_enabled, stripe_details_submitted, shop_order_category_id, shop_staff_role_id, shop_currency, shop_platform_fee_bps',
      )
      .eq('guild_id', guildId)
      .maybeSingle();
    if (error) throw error;
    return {
      ok: true,
      stripe: {
        connected: Boolean(data?.stripe_account_id),
        chargesEnabled: Boolean(data?.stripe_charges_enabled),
        detailsSubmitted: Boolean(data?.stripe_details_submitted),
        accountId: (data?.stripe_account_id as string | null) ?? null,
      },
      settings: {
        orderCategoryId: (data?.shop_order_category_id as string | null) ?? null,
        staffRoleId: (data?.shop_staff_role_id as string | null) ?? null,
        currency: (data?.shop_currency as string) ?? 'eur',
        platformFeeBps: (data?.shop_platform_fee_bps as number) ?? 0,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updateShopSettings(
  guildId: string,
  input: {
    orderCategoryId: string | null;
    staffRoleId: string | null;
    currency: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        shop_order_category_id: input.orderCategoryId,
        shop_staff_role_id: input.staffRoleId,
        shop_currency: input.currency.toLowerCase().slice(0, 3) || 'eur',
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

export async function disconnectStripe(
  guildId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        stripe_account_id: null,
        stripe_charges_enabled: false,
        stripe_details_submitted: false,
        stripe_onboarded_at: null,
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

export async function listProducts(
  guildId: string,
): Promise<{ ok: boolean; error?: string; products?: ProductRow[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_products')
      .select(
        'id, name, description, price_cents, currency, image_url, active, stock, position',
      )
      .eq('guild_id', guildId)
      .order('position');
    if (error) throw error;
    return {
      ok: true,
      products: (data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description as string | null) ?? '',
        priceCents: (r.price_cents as number) ?? 0,
        currency: (r.currency as string) ?? 'eur',
        imageUrl: (r.image_url as string | null) ?? null,
        active: Boolean(r.active),
        stock: (r.stock as number | null) ?? null,
        position: (r.position as number) ?? 0,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export type ProductInput = {
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  active: boolean;
  stock: number | null;
};

export async function upsertProduct(
  guildId: string,
  id: string | null,
  input: ProductInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { userId } = await assertCanManage(guildId);
    if (!input.name.trim() || input.priceCents < 0) {
      return { ok: false, error: 'Name und gültiger Preis nötig.' };
    }
    const admin = createAdminClient();
    if (id) {
      const { error } = await admin
        .from('bot_products')
        .update({
          name: input.name.trim().slice(0, 200),
          description: input.description.trim().slice(0, 4000),
          price_cents: Math.floor(input.priceCents),
          currency: input.currency.toLowerCase().slice(0, 3),
          image_url: input.imageUrl?.trim() || null,
          active: input.active,
          stock: input.stock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('guild_id', guildId);
      if (error) throw error;
      revalidatePath(`/integrations/discord/${guildId}`);
      return { ok: true, id };
    }
    const { count } = await admin
      .from('bot_products')
      .select('id', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    const position = count ?? 0;
    const { data, error } = await admin
      .from('bot_products')
      .insert({
        guild_id: guildId,
        name: input.name.trim().slice(0, 200),
        description: input.description.trim().slice(0, 4000),
        price_cents: Math.floor(input.priceCents),
        currency: input.currency.toLowerCase().slice(0, 3),
        image_url: input.imageUrl?.trim() || null,
        active: input.active,
        stock: input.stock,
        position,
        created_by: userId,
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Insert fehlgeschlagen.');
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deleteProduct(
  guildId: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_products')
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

export async function listOrders(
  guildId: string,
): Promise<{ ok: boolean; error?: string; orders?: OrderRow[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bot_orders')
      .select(
        'id, user_id, product_id, product_name, amount_cents, currency, status, ticket_channel_id, customer_email, created_at, paid_at, fulfilled_at',
      )
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return {
      ok: true,
      orders: (data ?? []).map((r) => ({
        id: r.id as string,
        userId: r.user_id as string,
        productId: (r.product_id as string | null) ?? null,
        productName: r.product_name as string,
        amountCents: (r.amount_cents as number) ?? 0,
        currency: (r.currency as string) ?? 'eur',
        status:
          (r.status as OrderRow['status']) ?? 'pending',
        ticketChannelId: (r.ticket_channel_id as string | null) ?? null,
        customerEmail: (r.customer_email as string | null) ?? null,
        createdAt: r.created_at as string,
        paidAt: (r.paid_at as string | null) ?? null,
        fulfilledAt: (r.fulfilled_at as string | null) ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function markOrderFulfilled(
  guildId: string,
  orderId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId } = await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_orders')
      .update({
        status: 'fulfilled',
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: userId,
      })
      .eq('id', orderId)
      .eq('guild_id', guildId)
      .eq('status', 'paid');
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Preisliste ==============

export type PricelistItemRow = {
  id: string;
  label: string;
  emoji: string | null;
  style: TicketButtonStyleAct;
  detailTitle: string;
  detailDescription: string;
  detailPrice: string | null;
  detailColor: number | null;
  detailImageUrl: string | null;
  position: number;
};

export type PricelistPanelRow = {
  id: string;
  channelId: string;
  messageId: string | null;
  title: string;
  description: string;
  color: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  footer: string | null;
  items: PricelistItemRow[];
};

function buildPricelistPayload(panel: PricelistPanelRow): Record<string, unknown> {
  const embed: Record<string, unknown> = {
    title: panel.title.slice(0, 256),
    color: panel.color ?? 0x380d52,
  };
  if (panel.description) embed.description = panel.description.slice(0, 4000);
  if (panel.imageUrl) embed.image = { url: panel.imageUrl };
  if (panel.thumbnailUrl) embed.thumbnail = { url: panel.thumbnailUrl };
  if (panel.footer) embed.footer = { text: panel.footer.slice(0, 2048) };

  const items = panel.items.slice(0, 25);
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < items.length; i += 5) {
    const chunk = items.slice(i, i + 5);
    rows.push({
      type: 1,
      components: chunk.map((it) => {
        const btn: Record<string, unknown> = {
          type: 2,
          style: TICKET_STYLE_MAP[it.style] ?? 2,
          custom_id: `pl:item:${it.id}`,
          label: it.label.slice(0, 80),
        };
        const emoji = parseSugEmoji(it.emoji);
        if (emoji) btn.emoji = emoji;
        return btn;
      }),
    });
  }
  return { embeds: [embed], components: rows };
}

async function loadPricelistPanel(
  guildId: string,
  panelId: string,
): Promise<PricelistPanelRow | null> {
  const admin = createAdminClient();
  const { data: panel } = await admin
    .from('bot_pricelist_panels')
    .select(
      'id, channel_id, message_id, title, description, color, image_url, thumbnail_url, footer',
    )
    .eq('id', panelId)
    .eq('guild_id', guildId)
    .maybeSingle();
  if (!panel) return null;
  const { data: items } = await admin
    .from('bot_pricelist_items')
    .select(
      'id, label, emoji, style, detail_title, detail_description, detail_price, detail_color, detail_image_url, position',
    )
    .eq('panel_id', panelId)
    .order('position');
  return {
    id: panel.id as string,
    channelId: panel.channel_id as string,
    messageId: (panel.message_id as string | null) ?? null,
    title: (panel.title as string) ?? 'Preisliste',
    description: (panel.description as string) ?? '',
    color: (panel.color as number | null) ?? null,
    imageUrl: (panel.image_url as string | null) ?? null,
    thumbnailUrl: (panel.thumbnail_url as string | null) ?? null,
    footer: (panel.footer as string | null) ?? null,
    items: (items ?? []).map((r) => ({
      id: r.id as string,
      label: r.label as string,
      emoji: (r.emoji as string | null) ?? null,
      style: ((r.style as TicketButtonStyleAct | null) ?? 'secondary'),
      detailTitle: (r.detail_title as string) ?? '',
      detailDescription: (r.detail_description as string | null) ?? '',
      detailPrice: (r.detail_price as string | null) ?? null,
      detailColor: (r.detail_color as number | null) ?? null,
      detailImageUrl: (r.detail_image_url as string | null) ?? null,
      position: (r.position as number) ?? 0,
    })),
  };
}

export async function listPricelistPanels(
  guildId: string,
): Promise<{ ok: boolean; error?: string; panels?: PricelistPanelRow[] }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: panels, error } = await admin
      .from('bot_pricelist_panels')
      .select(
        'id, channel_id, message_id, title, description, color, image_url, thumbnail_url, footer',
      )
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const ids = (panels ?? []).map((p) => p.id as string);
    const { data: items } = ids.length
      ? await admin
          .from('bot_pricelist_items')
          .select(
            'id, panel_id, label, emoji, style, detail_title, detail_description, detail_price, detail_color, detail_image_url, position',
          )
          .in('panel_id', ids)
          .order('position')
      : { data: [] as Array<Record<string, unknown>> };
    const byPanel = new Map<string, PricelistItemRow[]>();
    for (const r of items ?? []) {
      const pid = r.panel_id as string;
      const list = byPanel.get(pid) ?? [];
      list.push({
        id: r.id as string,
        label: r.label as string,
        emoji: (r.emoji as string | null) ?? null,
        style: ((r.style as TicketButtonStyleAct | null) ?? 'secondary'),
        detailTitle: (r.detail_title as string) ?? '',
        detailDescription: (r.detail_description as string | null) ?? '',
        detailPrice: (r.detail_price as string | null) ?? null,
        detailColor: (r.detail_color as number | null) ?? null,
        detailImageUrl: (r.detail_image_url as string | null) ?? null,
        position: (r.position as number) ?? 0,
      });
      byPanel.set(pid, list);
    }
    return {
      ok: true,
      panels: (panels ?? []).map((p) => ({
        id: p.id as string,
        channelId: p.channel_id as string,
        messageId: (p.message_id as string | null) ?? null,
        title: (p.title as string) ?? 'Preisliste',
        description: (p.description as string) ?? '',
        color: (p.color as number | null) ?? null,
        imageUrl: (p.image_url as string | null) ?? null,
        thumbnailUrl: (p.thumbnail_url as string | null) ?? null,
        footer: (p.footer as string | null) ?? null,
        items: byPanel.get(p.id as string) ?? [],
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export type PricelistPanelInput = {
  channelId: string;
  title: string;
  description: string;
  color: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  footer: string | null;
};

export type PricelistItemInput = {
  label: string;
  emoji: string | null;
  style: TicketButtonStyleAct;
  detailTitle: string;
  detailDescription: string;
  detailPrice: string | null;
  detailColor: number | null;
  detailImageUrl: string | null;
};

export async function createPricelistPanelWeb(
  guildId: string,
  input: PricelistPanelInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { userId } = await assertCanManage(guildId);
    if (!input.channelId || !input.title.trim()) {
      return { ok: false, error: 'Channel und Titel sind nötig.' };
    }
    const admin = createAdminClient();
    const { data: panel, error } = await admin
      .from('bot_pricelist_panels')
      .insert({
        guild_id: guildId,
        channel_id: input.channelId,
        title: input.title.trim().slice(0, 256),
        description: input.description.trim().slice(0, 4000),
        color: input.color,
        image_url: input.imageUrl?.trim() || null,
        thumbnail_url: input.thumbnailUrl?.trim() || null,
        footer: input.footer?.trim() || null,
        created_by: userId,
      })
      .select('id')
      .single();
    if (error || !panel) throw error ?? new Error('Insert fehlgeschlagen.');
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: panel.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function updatePricelistPanelWeb(
  guildId: string,
  panelId: string,
  input: PricelistPanelInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_pricelist_panels')
      .update({
        channel_id: input.channelId,
        title: input.title.trim().slice(0, 256),
        description: input.description.trim().slice(0, 4000),
        color: input.color,
        image_url: input.imageUrl?.trim() || null,
        thumbnail_url: input.thumbnailUrl?.trim() || null,
        footer: input.footer?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', panelId)
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deletePricelistPanelWeb(
  guildId: string,
  panelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('bot_pricelist_panels')
      .select('channel_id, message_id')
      .eq('id', panelId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (row?.message_id) {
      await deleteMessage(
        row.channel_id as string,
        row.message_id as string,
      ).catch(() => {});
    }
    const { error } = await admin
      .from('bot_pricelist_panels')
      .delete()
      .eq('id', panelId)
      .eq('guild_id', guildId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function upsertPricelistItem(
  guildId: string,
  panelId: string,
  itemId: string | null,
  input: PricelistItemInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    await assertCanManage(guildId);
    if (!input.label.trim() || !input.detailTitle.trim()) {
      return { ok: false, error: 'Label und Detail-Titel sind nötig.' };
    }
    const admin = createAdminClient();
    if (itemId) {
      const { error } = await admin
        .from('bot_pricelist_items')
        .update({
          label: input.label.trim().slice(0, 80),
          emoji: input.emoji?.trim() || null,
          style: input.style,
          detail_title: input.detailTitle.trim().slice(0, 256),
          detail_description: input.detailDescription.trim().slice(0, 4000),
          detail_price: input.detailPrice?.trim() || null,
          detail_color: input.detailColor,
          detail_image_url: input.detailImageUrl?.trim() || null,
        })
        .eq('id', itemId);
      if (error) throw error;
      revalidatePath(`/integrations/discord/${guildId}`);
      return { ok: true, id: itemId };
    }
    const { count } = await admin
      .from('bot_pricelist_items')
      .select('id', { count: 'exact', head: true })
      .eq('panel_id', panelId);
    const position = count ?? 0;
    const { data, error } = await admin
      .from('bot_pricelist_items')
      .insert({
        panel_id: panelId,
        label: input.label.trim().slice(0, 80),
        emoji: input.emoji?.trim() || null,
        style: input.style,
        detail_title: input.detailTitle.trim().slice(0, 256),
        detail_description: input.detailDescription.trim().slice(0, 4000),
        detail_price: input.detailPrice?.trim() || null,
        detail_color: input.detailColor,
        detail_image_url: input.detailImageUrl?.trim() || null,
        position,
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Insert fehlgeschlagen.');
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function deletePricelistItem(
  guildId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const admin = createAdminClient();
    const { error } = await admin.from('bot_pricelist_items').delete().eq('id', itemId);
    if (error) throw error;
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function publishPricelistPanel(
  guildId: string,
  panelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const panel = await loadPricelistPanel(guildId, panelId);
    if (!panel) return { ok: false, error: 'Panel nicht gefunden.' };
    if (panel.items.length === 0) {
      return { ok: false, error: 'Mindestens einen Eintrag anlegen.' };
    }
    const payload = buildPricelistPayload(panel);
    const admin = createAdminClient();
    if (panel.messageId) {
      try {
        await editMessage(
          panel.channelId,
          panel.messageId,
          payload as { embeds: EmbedPayload[]; components: Record<string, unknown>[] },
        );
        revalidatePath(`/integrations/discord/${guildId}`);
        return { ok: true };
      } catch {
        // Message weg → neu posten.
      }
    }
    const posted = await postMessage(
      panel.channelId,
      payload as { embeds: EmbedPayload[]; components: Record<string, unknown>[] },
    );
    await admin
      .from('bot_pricelist_panels')
      .update({ message_id: posted.id })
      .eq('id', panelId);
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

// ============== Premium / Subscription ==============

export type PremiumStatusView = {
  status: 'none' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
  plan: 'monthly' | 'quarterly' | 'biannual' | null;
  trialUsed: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
};

export async function getPremiumStatus(
  guildId: string,
): Promise<{ ok: boolean; error?: string; status?: PremiumStatusView }> {
  try {
    await assertCanManage(guildId);
    const { getGuildSubscription } = await import('@/lib/premium');
    const sub = await getGuildSubscription(guildId);
    return {
      ok: true,
      status: {
        status: sub.status,
        plan: sub.plan,
        trialUsed: Boolean(sub.trialUsedAt),
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        hasStripeCustomer: Boolean(sub.stripeCustomerId),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function startGuildTrial(
  guildId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManage(guildId);
    const { getGuildSubscription, invalidatePremiumCache } = await import('@/lib/premium');
    const sub = await getGuildSubscription(guildId);
    if (sub.trialUsedAt) {
      return { ok: false, error: 'Trial wurde für diese Guild bereits genutzt.' };
    }
    if (sub.status === 'active' || sub.status === 'trial' || sub.status === 'past_due') {
      return { ok: false, error: 'Premium ist bereits aktiv.' };
    }
    const admin = createAdminClient();
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 3600_000);
    const { error } = await admin.from('bot_subscriptions').upsert(
      {
        guild_id: guildId,
        status: 'trial',
        trial_started_at: now.toISOString(),
        trial_used_at: now.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: false,
        updated_at: now.toISOString(),
      },
      { onConflict: 'guild_id' },
    );
    if (error) throw error;
    invalidatePremiumCache(guildId);
    revalidatePath(`/integrations/discord/${guildId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function createPremiumCheckout(
  guildId: string,
  plan: 'monthly' | 'quarterly' | 'biannual',
): Promise<{ ok: boolean; error?: string; url?: string }> {
  try {
    await assertCanManage(guildId);
    const { getStripePriceId, getGuildSubscription } = await import('@/lib/premium');
    const { createSubscriptionCheckoutSession, stripeEnabled } = await import(
      '@/lib/stripe'
    );
    if (!stripeEnabled()) {
      return { ok: false, error: 'Stripe-Integration ist nicht aktiviert.' };
    }
    const priceId = getStripePriceId(plan);
    if (!priceId) {
      return {
        ok: false,
        error: `Kein Stripe-Preis für Plan "${plan}" konfiguriert.`,
      };
    }
    const sub = await getGuildSubscription(guildId);
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://kanbanly.de';
    const session = await createSubscriptionCheckoutSession({
      guildId,
      priceId,
      customerId: sub.stripeCustomerId ?? undefined,
      successUrl: `${origin}/integrations/discord/${guildId}?premium=success`,
      cancelUrl: `${origin}/integrations/discord/${guildId}?premium=cancelled`,
    });
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}

export async function createPremiumPortal(
  guildId: string,
): Promise<{ ok: boolean; error?: string; url?: string }> {
  try {
    await assertCanManage(guildId);
    const { getGuildSubscription } = await import('@/lib/premium');
    const { createCustomerPortalSession, stripeEnabled } = await import('@/lib/stripe');
    if (!stripeEnabled()) {
      return { ok: false, error: 'Stripe-Integration ist nicht aktiviert.' };
    }
    const sub = await getGuildSubscription(guildId);
    if (!sub.stripeCustomerId) {
      return { ok: false, error: 'Noch kein Stripe-Kunde — bitte erst ein Abo kaufen.' };
    }
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://kanbanly.de';
    const session = await createCustomerPortalSession({
      customerId: sub.stripeCustomerId,
      returnUrl: `${origin}/integrations/discord/${guildId}`,
    });
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}
