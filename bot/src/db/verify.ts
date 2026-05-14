import { getDb } from '../db.js';

export type VerifyConfig = {
  enabled: boolean;
  channelId: string | null;
  roleId: string | null;
  message: string | null;
  panelMessageId: string | null;
};

export async function getVerifyConfig(
  guildId: string,
): Promise<VerifyConfig | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_guilds')
    .select(
      'verify_enabled, verify_channel_id, verify_role_id, verify_message, verify_panel_message_id',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    enabled: Boolean(data.verify_enabled),
    channelId: data.verify_channel_id ?? null,
    roleId: data.verify_role_id ?? null,
    message: data.verify_message ?? null,
    panelMessageId: data.verify_panel_message_id ?? null,
  };
}

export async function setVerifyPanelMessageId(
  guildId: string,
  messageId: string | null,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_guilds')
    .update({
      verify_panel_message_id: messageId,
      updated_at: new Date().toISOString(),
    })
    .eq('guild_id', guildId);
  if (error) throw error;
}
