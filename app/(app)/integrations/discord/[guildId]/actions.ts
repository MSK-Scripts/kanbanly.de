'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFreshAccessToken } from '@/lib/discordConnection';
import { canManageGuild, fetchCurrentUserGuilds } from '@/lib/discord';

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

    if (enabled && (!channelId || !message)) {
      return { ok: false, error: 'Channel und Nachricht sind nötig, wenn Welcome aktiv ist.' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        welcome_enabled: enabled,
        welcome_channel_id: channelId,
        welcome_message: message,
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
