import 'server-only';

const DISCORD_API = 'https://discord.com/api/v10';

function botToken(): string {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error('DISCORD_BOT_TOKEN fehlt');
  return t;
}

export type WebhookCreateResult = {
  id: string;
  token: string;
  channelId: string;
  name: string;
};

export async function createChannelWebhook(
  channelId: string,
  name: string,
): Promise<WebhookCreateResult> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: name.slice(0, 80) }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Webhook-Create ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    id: string;
    token: string;
    channel_id: string;
    name: string;
  };
  return {
    id: data.id,
    token: data.token,
    channelId: data.channel_id,
    name: data.name,
  };
}

export async function deleteWebhookViaBot(webhookId: string): Promise<void> {
  const res = await fetch(`${DISCORD_API}/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${botToken()}` },
  });
  if (!res.ok && res.status !== 404) {
    const txt = await res.text();
    throw new Error(`Webhook-Delete ${res.status}: ${txt.slice(0, 200)}`);
  }
}

export async function getWebhookInfo(
  webhookId: string,
  webhookToken: string,
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(
    `${DISCORD_API}/webhooks/${webhookId}/${webhookToken}`,
    { cache: 'no-store' },
  );
  return { ok: res.ok, status: res.status };
}

export type WebhookSendPayload = {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  username?: string;
  avatar_url?: string;
  allowed_mentions?: unknown;
};

export async function sendViaWebhook(
  webhookId: string,
  webhookToken: string,
  payload: WebhookSendPayload,
  files: File[] = [],
): Promise<{ ok: boolean; error?: string }> {
  const url = `${DISCORD_API}/webhooks/${webhookId}/${webhookToken}?wait=true`;
  try {
    if (files.length === 0) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `Discord ${res.status}: ${txt.slice(0, 300)}` };
      }
      return { ok: true };
    }
    // Multipart mit Attachments
    const fd = new FormData();
    const attachments = files.map((f, i) => ({
      id: i,
      filename: f.name,
    }));
    fd.append(
      'payload_json',
      JSON.stringify({ ...payload, attachments }),
    );
    files.forEach((f, i) => {
      fd.append(`files[${i}]`, f, f.name);
    });
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `Discord ${res.status}: ${txt.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Netzwerk-Fehler.' };
  }
}

export async function sendBotMessageWithFiles(
  channelId: string,
  payload: {
    content?: string;
    embeds?: unknown[];
    components?: unknown[];
    allowed_mentions?: unknown;
  },
  files: File[] = [],
): Promise<{ ok: boolean; error?: string }> {
  const url = `${DISCORD_API}/channels/${channelId}/messages`;
  try {
    if (files.length === 0) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `Discord ${res.status}: ${txt.slice(0, 300)}` };
      }
      return { ok: true };
    }
    const fd = new FormData();
    const attachments = files.map((f, i) => ({
      id: i,
      filename: f.name,
    }));
    fd.append('payload_json', JSON.stringify({ ...payload, attachments }));
    files.forEach((f, i) => {
      fd.append(`files[${i}]`, f, f.name);
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bot ${botToken()}` },
      body: fd,
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `Discord ${res.status}: ${txt.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Netzwerk-Fehler.' };
  }
}
