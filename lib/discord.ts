import 'server-only';

const DISCORD_API = 'https://discord.com/api/v10';

export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? '1503486800146993203';
export const DISCORD_SCOPES = 'identify guilds';

// Default-Permissions für den Bot-Invite-Link.
// Manage Roles | Add Reactions | Read Messages | Send Messages | Embed Links | Read History | Use External Emojis
export const DISCORD_BOT_PERMISSIONS = '268520512';

export function getOAuthRedirectUri(origin: string): string {
  return `${origin}/api/discord/callback`;
}

export function buildAuthorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: getOAuthRedirectUri(origin),
    response_type: 'code',
    scope: DISCORD_SCOPES,
    state,
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function buildBotInviteUrl(guildId?: string): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    scope: 'bot applications.commands',
    permissions: DISCORD_BOT_PERMISSIONS,
  });
  if (guildId) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

function requireSecret(): string {
  const s = process.env.DISCORD_CLIENT_SECRET;
  if (!s) throw new Error('DISCORD_CLIENT_SECRET fehlt in .env.local');
  return s;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: requireSecret(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord token exchange fehlgeschlagen: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshToken(refresh: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: requireSecret(),
    grant_type: 'refresh_token',
    refresh_token: refresh,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord token refresh fehlgeschlagen: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

export async function fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Discord /users/@me: ${res.status}`);
  return (await res.json()) as DiscordUser;
}

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

const MANAGE_GUILD = BigInt(0x20);
const ADMINISTRATOR = BigInt(0x8);

export function canManageGuild(perms: string): boolean {
  try {
    const p = BigInt(perms);
    return (p & ADMINISTRATOR) === ADMINISTRATOR || (p & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

// In-memory Cache pro User+Endpunkt — verhindert Discord-Rate-Limits bei Page-Reloads.
// User-Guilds ändern sich selten — 5min Cache ist OK.
const userGuildsCache = new Map<
  string,
  { value: DiscordGuild[]; expires: number }
>();
const USER_GUILDS_TTL_MS = 5 * 60_000;

export async function fetchCurrentUserGuilds(
  accessToken: string,
): Promise<DiscordGuild[]> {
  const key = accessToken;
  const now = Date.now();
  const cached = userGuildsCache.get(key);
  if (cached && cached.expires > now) return cached.value;
  const value = await discordGet<DiscordGuild[]>(
    '/users/@me/guilds',
    accessToken,
    'Bearer',
  );
  userGuildsCache.set(key, { value, expires: now + USER_GUILDS_TTL_MS });
  return value;
}

export type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
};

// Discord Channel Types
export const CHANNEL_TYPE_TEXT = 0;
export const CHANNEL_TYPE_ANNOUNCEMENT = 5;

export class DiscordRateLimitError extends Error {
  constructor(public readonly retryAfterSec: number, public readonly endpoint: string) {
    super(`Discord rate-limited (${endpoint}). Retry after ${retryAfterSec}s.`);
    this.name = 'DiscordRateLimitError';
  }
}

async function discordGet<T>(path: string, token: string, tokenKind: 'Bot' | 'Bearer' = 'Bot'): Promise<T> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `${tokenKind} ${token}` },
    cache: 'no-store',
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') ?? '5');
    throw new DiscordRateLimitError(Number.isFinite(retryAfter) ? retryAfter : 5, path);
  }
  if (!res.ok) throw new Error(`Discord ${path}: ${res.status}`);
  return (await res.json()) as T;
}

// Channel/Role-Lookups: 60s Cache — kurz genug dass neue Channels/Rollen schnell auftauchen,
// lang genug um Rate-Limits zu vermeiden bei Tab-Wechseln.
const guildChannelsCache = new Map<
  string,
  { value: DiscordChannel[]; expires: number }
>();
const guildRolesCache = new Map<
  string,
  { value: DiscordRole[]; expires: number }
>();
const GUILD_DATA_TTL_MS = 60_000;

export function invalidateGuildCache(guildId: string): void {
  guildChannelsCache.delete(guildId);
  guildRolesCache.delete(guildId);
}

export async function fetchGuildChannels(
  guildId: string,
): Promise<DiscordChannel[]> {
  const now = Date.now();
  const cached = guildChannelsCache.get(guildId);
  if (cached && cached.expires > now) return cached.value;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN fehlt in .env.local');
  const value = await discordGet<DiscordChannel[]>(
    `/guilds/${guildId}/channels`,
    token,
  );
  guildChannelsCache.set(guildId, { value, expires: now + GUILD_DATA_TTL_MS });
  return value;
}

export type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  permissions: string;
};

export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
  const now = Date.now();
  const cached = guildRolesCache.get(guildId);
  if (cached && cached.expires > now) return cached.value;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN fehlt in .env.local');
  const roles = await discordGet<DiscordRole[]>(`/guilds/${guildId}/roles`, token);
  // @everyone-Rolle hat dieselbe ID wie die Guild — die wollen wir nicht zur Auswahl.
  const filtered = roles.filter((r) => r.id !== guildId && !r.managed);
  guildRolesCache.set(guildId, { value: filtered, expires: now + GUILD_DATA_TTL_MS });
  return filtered;
}

export function guildIconUrl(guild: { id: string; icon: string | null }): string | null {
  if (!guild.icon) return null;
  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=64`;
}
