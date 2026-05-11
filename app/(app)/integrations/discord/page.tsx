import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getConnection, getFreshAccessToken } from '@/lib/discordConnection';
import {
  buildBotInviteUrl,
  canManageGuild,
  fetchCurrentUserGuilds,
  guildIconUrl,
  type DiscordGuild,
} from '@/lib/discord';

export const metadata = {
  title: 'Discord-Bot · kanbanly',
};

export const dynamic = 'force-dynamic';

type GuildRow = DiscordGuild & { botPresent: boolean };

async function loadDashboard(userId: string): Promise<
  | { status: 'disconnected' }
  | {
      status: 'connected';
      discordUsername: string;
      manageable: GuildRow[];
      apiError: string | null;
    }
> {
  const conn = await getConnection(userId);
  if (!conn) return { status: 'disconnected' };

  const token = await getFreshAccessToken(userId);
  if (!token) {
    return {
      status: 'connected',
      discordUsername: conn.discord_username ?? conn.discord_user_id,
      manageable: [],
      apiError: 'Discord-Token abgelaufen — bitte neu verbinden.',
    };
  }

  let guilds: DiscordGuild[] = [];
  let apiError: string | null = null;
  try {
    guilds = await fetchCurrentUserGuilds(token);
  } catch (err) {
    console.error('[discord-dashboard] guilds-fetch:', err);
    apiError = 'Konnte deine Discord-Server gerade nicht laden.';
  }

  const manageable = guilds.filter((g) => g.owner || canManageGuild(g.permissions));

  // Cross-Check: in welchen Guilds ist der Bot drin? -> bot_guilds-Tabelle
  let botGuildIds = new Set<string>();
  if (manageable.length) {
    const admin = createAdminClient();
    const { data } = await admin
      .from('bot_guilds')
      .select('guild_id')
      .in('guild_id', manageable.map((g) => g.id));
    botGuildIds = new Set((data ?? []).map((r: { guild_id: string }) => r.guild_id));

    // Verknüpfung des Users an seine Guilds aktualisieren (für die RLS-Reads).
    if (botGuildIds.size) {
      await admin
        .from('bot_guilds')
        .update({ linked_user_id: userId })
        .in('guild_id', Array.from(botGuildIds));
    }
  }

  const rows: GuildRow[] = manageable.map((g) => ({ ...g, botPresent: botGuildIds.has(g.id) }));
  rows.sort((a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name));

  return {
    status: 'connected',
    discordUsername: conn.discord_username ?? conn.discord_user_id,
    manageable: rows,
    apiError,
  };
}

export default async function DiscordIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/integrations/discord');

  const { error: errorParam } = await searchParams;
  const data = await loadDashboard(user.id);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-fg">Discord-Bot</h1>
          <p className="text-sm text-muted mt-1">
            Verbinde deinen Discord-Account, um den kanbanly-Bot auf deinen Servern zu verwalten.
          </p>
        </div>

        {errorParam && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            Verbindung fehlgeschlagen: {errorParam}
          </div>
        )}

        {data.status === 'disconnected' ? (
          <div className="rounded-md bg-surface border border-line p-6">
            <h2 className="text-base font-semibold text-fg mb-2">Mit Discord verbinden</h2>
            <p className="text-sm text-muted mb-4">
              Wir holen nur deinen Benutzernamen und die Liste deiner Server (Scopes:
              <code className="mx-1 px-1 rounded bg-elev text-fg-soft">identify</code>
              <code className="px-1 rounded bg-elev text-fg-soft">guilds</code>).
            </p>
            <Link
              href="/api/discord/connect"
              className="inline-flex items-center gap-2 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm px-4 py-2 transition-colors"
            >
              Mit Discord verbinden
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-md bg-surface border border-line p-5 mb-6 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted">Verbunden als</div>
                <div className="text-sm text-fg font-medium">{data.discordUsername}</div>
              </div>
              <form action="/api/discord/disconnect" method="post">
                <button
                  type="submit"
                  className="text-xs rounded-md border border-line-strong hover:border-fg-soft bg-elev hover:bg-elev text-fg-soft hover:text-fg px-3 py-1.5 transition-colors"
                >
                  Verbindung trennen
                </button>
              </form>
            </div>

            {data.apiError && (
              <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                {data.apiError}
              </div>
            )}

            <h2 className="text-sm font-semibold text-fg mb-2">
              Deine Server ({data.manageable.length})
            </h2>
            {data.manageable.length === 0 ? (
              <p className="text-sm text-muted">
                Keine Server gefunden, auf denen du „Server verwalten“ darfst.
              </p>
            ) : (
              <div className="space-y-2">
                {data.manageable.map((g) => {
                  const icon = guildIconUrl(g);
                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-md bg-surface border border-line p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-md bg-elev flex items-center justify-center overflow-hidden shrink-0">
                          {icon ? (
                            <Image
                              src={icon}
                              alt=""
                              width={40}
                              height={40}
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="text-xs text-muted">
                              {g.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-fg truncate">{g.name}</div>
                          <div className="text-[11px] text-muted">
                            {g.owner ? 'Owner' : 'Manage Server'}
                            {g.botPresent ? ' · Bot aktiv' : ' · Bot nicht eingeladen'}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {g.botPresent ? (
                          <Link
                            href={`/integrations/discord/${g.id}`}
                            className="text-xs rounded-md bg-accent hover:bg-accent-hover text-white px-3 py-1.5 transition-colors"
                          >
                            Verwalten
                          </Link>
                        ) : (
                          <a
                            href={buildBotInviteUrl(g.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs rounded-md border border-line-strong hover:border-fg-soft bg-elev hover:bg-elev text-fg-soft hover:text-fg px-3 py-1.5 transition-colors"
                          >
                            Bot einladen
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
