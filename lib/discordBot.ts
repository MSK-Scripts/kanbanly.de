import 'server-only';

const DISCORD_API = 'https://discord.com/api/v10';

function botToken(): string {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error('DISCORD_BOT_TOKEN fehlt in .env.local');
  return t;
}

async function call(
  path: string,
  init: { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<Response> {
  return fetch(`${DISCORD_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bot ${botToken()}`,
      'Content-Type': 'application/json',
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export type EmbedPayload = {
  title?: string;
  description?: string;
  color?: number;
  footer?: { text: string };
  image?: { url: string };
};

// Discord-Component-Strukturen (REST-API-Form)
export type DiscordComponent = Record<string, unknown>;

export type MessagePayload = {
  content?: string;
  embeds?: EmbedPayload[];
  components?: DiscordComponent[];
};

export async function postMessage(
  channelId: string,
  payload: MessagePayload,
): Promise<{ id: string }> {
  const res = await call(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw new Error(`Discord POST: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

export async function editMessage(
  channelId: string,
  messageId: string,
  payload: MessagePayload,
): Promise<void> {
  const res = await call(`/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw new Error(`Discord PATCH: ${res.status} ${await res.text()}`);
}

// Kompatibilitäts-Wrapper für bestehenden Code
export async function postEmbed(
  channelId: string,
  embed: EmbedPayload,
): Promise<{ id: string }> {
  return postMessage(channelId, { embeds: [embed] });
}

export async function editEmbed(
  channelId: string,
  messageId: string,
  embed: EmbedPayload,
): Promise<void> {
  return editMessage(channelId, messageId, { embeds: [embed] });
}

export type GuildMember = {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  bot: boolean;
};

// Paginated members fetch (Bot-Token, max 1000 per request).
// Erfordert Server-Members-Intent im Developer-Portal.
export async function fetchGuildMembers(guildId: string): Promise<GuildMember[]> {
  const out: GuildMember[] = [];
  let after = '0';
  for (let i = 0; i < 100; i++) {
    const res = await call(`/guilds/${guildId}/members?limit=1000&after=${after}`, {
      method: 'GET',
    });
    if (!res.ok) {
      throw new Error(`Discord members: ${res.status} ${await res.text()}`);
    }
    const batch = (await res.json()) as Array<{
      user: { id: string; username: string; global_name?: string | null; bot?: boolean };
      nick?: string | null;
      roles?: string[];
    }>;
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const m of batch) {
      out.push({
        id: m.user.id,
        username: m.user.username,
        displayName: m.nick ?? m.user.global_name ?? m.user.username,
        roles: m.roles ?? [],
        bot: Boolean(m.user.bot),
      });
    }
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].user.id;
  }
  return out;
}

export async function deleteMessage(
  channelId: string,
  messageId: string,
): Promise<void> {
  const res = await call(`/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Discord DELETE: ${res.status} ${await res.text()}`);
  }
}

// Für Reactions ist das Emoji URL-encoded:
// - Unicode-Emoji: einfach das Zeichen URL-encoded
// - Custom-Emoji: "name:id"
export async function addReaction(
  channelId: string,
  messageId: string,
  emojiForUrl: string,
): Promise<void> {
  const res = await call(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emojiForUrl)}/@me`,
    { method: 'PUT' },
  );
  if (!res.ok) throw new Error(`Discord reaction: ${res.status} ${await res.text()}`);
}

export async function removeOwnReaction(
  channelId: string,
  messageId: string,
  emojiForUrl: string,
): Promise<void> {
  const res = await call(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emojiForUrl)}/@me`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Discord reaction-del: ${res.status} ${await res.text()}`);
  }
}
