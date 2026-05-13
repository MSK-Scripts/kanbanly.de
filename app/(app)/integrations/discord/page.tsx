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

  const activeCount =
    data.status === 'connected' ? data.manageable.filter((g) => g.botPresent).length : 0;
  const totalCount = data.status === 'connected' ? data.manageable.length : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-3 sm:p-6">
        {/* Hero */}
        <div className="rounded-md bg-gradient-to-br from-[#5865F2]/15 via-surface to-surface border border-line p-6 sm:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-[#5865F2] font-mono mb-1">
                Discord-Integration
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight">
                Kanbanly Discord-Bot
              </h1>
              <p className="text-sm text-muted mt-2 max-w-xl">
                Welcome-Messages, Auto-Roles, Moderation, AutoMod, Logging,
                Leveling, Tickets &amp; mehr — komplett über dieses Dashboard
                konfigurierbar.
              </p>
            </div>
            {data.status === 'connected' && (
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <Stat label="Aktiv" value={activeCount} accent />
                <Stat label="Verwaltbar" value={totalCount} />
              </div>
            )}
          </div>
        </div>

        {errorParam && (
          <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
            Verbindung fehlgeschlagen: {errorParam}
          </div>
        )}

        {data.status === 'disconnected' ? (
          <div className="rounded-md bg-surface border border-line p-6 sm:p-8 text-center">
            <h2 className="text-lg font-semibold text-fg mb-2">
              Mit Discord verbinden
            </h2>
            <p className="text-sm text-muted mb-5 max-w-md mx-auto">
              Wir holen nur deinen Benutzernamen und die Liste deiner Server
              (Scopes:{' '}
              <code className="mx-1 px-1 rounded bg-elev text-fg-soft text-xs">
                identify
              </code>
              <code className="px-1 rounded bg-elev text-fg-soft text-xs">
                guilds
              </code>
              ).
            </p>
            <Link
              href="/api/discord/connect"
              className="inline-flex items-center gap-2 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium px-5 py-2.5 transition-colors"
            >
              Mit Discord verbinden
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-md bg-surface border border-line p-4 mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-[#5865F2]/15 grid place-items-center text-[#5865F2] text-sm font-semibold shrink-0">
                  {data.discordUsername.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-subtle">Verbunden als</div>
                  <div className="text-sm text-fg font-medium truncate">
                    {data.discordUsername}
                  </div>
                </div>
              </div>
              <form action="/api/discord/disconnect" method="post">
                <button
                  type="submit"
                  className="text-xs rounded-md border border-line-strong hover:border-fg-soft bg-elev hover:bg-elev-hover text-fg-soft hover:text-fg px-3 py-1.5 transition-colors"
                >
                  Trennen
                </button>
              </form>
            </div>

            {data.apiError && (
              <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                {data.apiError}
              </div>
            )}

            <h2 className="text-sm font-semibold text-fg mb-3 flex items-center gap-2">
              <span>Deine Server</span>
              <span className="text-xs text-subtle font-mono">
                {totalCount}
              </span>
            </h2>

            {data.manageable.length === 0 ? (
              <div className="rounded-md border border-dashed border-line-strong p-8 text-center text-sm text-subtle">
                Keine Server gefunden, auf denen du „Server verwalten&quot; darfst.
              </div>
            ) : (
              <ServerList servers={data.manageable} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md px-3 py-2 border ${
        accent
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-elev border-line-strong'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-subtle">
        {label}
      </div>
      <div
        className={`text-xl font-semibold font-mono tabular-nums ${
          accent ? 'text-emerald-700 dark:text-emerald-300' : 'text-fg'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ServerList({ servers }: { servers: GuildRow[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {servers.map((g) => (
        <ServerCard key={g.id} guild={g} />
      ))}
    </div>
  );
}

function ServerCard({ guild }: { guild: GuildRow }) {
  const icon = guildIconUrl(guild);
  return (
    <div
      className={`relative rounded-md border p-4 transition-colors ${
        guild.botPresent
          ? 'bg-surface border-emerald-500/30 hover:border-emerald-500/60'
          : 'bg-surface border-line hover:border-line-strong'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="h-12 w-12 rounded-md bg-elev flex items-center justify-center overflow-hidden shrink-0">
          {icon ? (
            <Image
              src={icon}
              alt=""
              width={48}
              height={48}
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="text-sm text-muted font-semibold">
              {guild.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-fg font-medium leading-snug break-words">
            {guild.name}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                guild.botPresent ? 'bg-emerald-500' : 'bg-muted/50'
              }`}
            />
            <span className="text-[11px] text-subtle">
              {guild.owner ? 'Owner' : 'Verwalter'} ·{' '}
              {guild.botPresent ? 'Bot aktiv' : 'Bot nicht eingeladen'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {guild.botPresent ? (
          <Link
            href={`/integrations/discord/${guild.id}`}
            className="flex-1 text-center text-xs font-medium rounded-md bg-accent hover:bg-accent-hover text-white px-3 py-1.5 transition-colors"
          >
            Verwalten
          </Link>
        ) : (
          <a
            href={buildBotInviteUrl(guild.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-xs font-medium rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-1.5 transition-colors"
          >
            Bot einladen
          </a>
        )}
      </div>
    </div>
  );
}
