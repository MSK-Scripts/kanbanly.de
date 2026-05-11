import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { refreshToken } from '@/lib/discord';

export type StoredConnection = {
  user_id: string;
  discord_user_id: string;
  discord_username: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
};

export async function getConnection(userId: string): Promise<StoredConnection | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bot_user_connections')
    .select('user_id, discord_user_id, discord_username, access_token, refresh_token, expires_at, scope')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as StoredConnection | null) ?? null;
}

// Refresht den Access-Token, falls er in <60s abläuft oder bereits abgelaufen ist.
export async function getFreshAccessToken(userId: string): Promise<string | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;
  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return conn.access_token;

  try {
    const next = await refreshToken(conn.refresh_token);
    const admin = createAdminClient();
    await admin
      .from('bot_user_connections')
      .update({
        access_token: next.access_token,
        refresh_token: next.refresh_token,
        expires_at: new Date(Date.now() + next.expires_in * 1000).toISOString(),
        scope: next.scope,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    return next.access_token;
  } catch (err) {
    console.error('[discord] Token-Refresh fehlgeschlagen:', err);
    return null;
  }
}
