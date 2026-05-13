import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFreshAccessToken } from '@/lib/discordConnection';
import {
  CHANNEL_TYPE_ANNOUNCEMENT,
  CHANNEL_TYPE_TEXT,
  canManageGuild,
  fetchCurrentUserGuilds,
  fetchGuildChannels,
  fetchGuildRoles,
  type DiscordChannel,
  type DiscordGuild,
  type DiscordRole,
} from '@/lib/discord';
import { WelcomeForm } from '@/components/WelcomeForm';
import { AutoRolesForm } from '@/components/AutoRolesForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Server-Einstellungen · kanbanly',
};

type LoadResult =
  | { kind: 'no-conn' }
  | { kind: 'forbidden' }
  | { kind: 'no-bot' }
  | {
      kind: 'ok';
      guild: DiscordGuild;
      channels: DiscordChannel[];
      roles: DiscordRole[];
      welcome: { enabled: boolean; channelId: string | null; message: string | null };
      autoRoles: { enabled: boolean; roleIds: string[] };
    };

async function load(userId: string, guildId: string): Promise<LoadResult> {
  const token = await getFreshAccessToken(userId);
  if (!token) return { kind: 'no-conn' };

  const guilds = await fetchCurrentUserGuilds(token);
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) return { kind: 'forbidden' };
  if (!guild.owner && !canManageGuild(guild.permissions)) return { kind: 'forbidden' };

  const admin = createAdminClient();
  const { data: guildRow } = await admin
    .from('bot_guilds')
    .select(
      'welcome_enabled, welcome_channel_id, welcome_message, auto_roles_enabled, auto_role_ids',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  if (!guildRow) return { kind: 'no-bot' };

  let channels: DiscordChannel[] = [];
  try {
    channels = (await fetchGuildChannels(guildId))
      .filter((c) => c.type === CHANNEL_TYPE_TEXT || c.type === CHANNEL_TYPE_ANNOUNCEMENT)
      .sort((a, b) => a.position - b.position);
  } catch (err) {
    console.error('[guild-settings] channels:', err);
  }

  let roles: DiscordRole[] = [];
  try {
    roles = (await fetchGuildRoles(guildId)).sort((a, b) => b.position - a.position);
  } catch (err) {
    console.error('[guild-settings] roles:', err);
  }

  const autoRoleIdsRaw = guildRow.auto_role_ids as unknown;
  const autoRoleIds = Array.isArray(autoRoleIdsRaw)
    ? (autoRoleIdsRaw as unknown[]).filter(
        (v): v is string => typeof v === 'string',
      )
    : [];

  return {
    kind: 'ok',
    guild,
    channels,
    roles,
    welcome: {
      enabled: guildRow.welcome_enabled,
      channelId: guildRow.welcome_channel_id,
      message: guildRow.welcome_message,
    },
    autoRoles: {
      enabled: Boolean(guildRow.auto_roles_enabled),
      roleIds: autoRoleIds,
    },
  };
}

export default async function GuildSettingsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { guildId } = await params;
  const result = await load(user.id, guildId);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <Link
            href="/integrations/discord"
            className="text-xs text-muted hover:text-fg transition-colors"
          >
            ← zurück zur Server-Übersicht
          </Link>
        </div>

        {result.kind === 'no-conn' && (
          <div className="rounded-md bg-surface border border-line p-6">
            <p className="text-sm text-fg">Discord-Verbindung abgelaufen.</p>
            <Link
              href="/api/discord/connect"
              className="mt-3 inline-block text-xs rounded-md bg-[#5865F2] text-white px-3 py-1.5"
            >
              Neu verbinden
            </Link>
          </div>
        )}

        {result.kind === 'forbidden' && (
          <div className="rounded-md bg-surface border border-line p-6">
            <p className="text-sm text-fg">Du hast keine Verwaltungsrechte auf diesem Server.</p>
          </div>
        )}

        {result.kind === 'no-bot' && (
          <div className="rounded-md bg-surface border border-line p-6">
            <p className="text-sm text-fg">Der Bot ist (noch) nicht auf diesem Server.</p>
            <Link
              href="/integrations/discord"
              className="mt-3 inline-block text-xs text-muted hover:text-fg"
            >
              Zur Übersicht — dort findest du den Einladen-Link.
            </Link>
          </div>
        )}

        {result.kind === 'ok' && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-fg">{result.guild.name}</h1>
              <p className="text-xs text-muted mt-1">Server-ID: {result.guild.id}</p>
            </div>

            <section className="mb-6">
              <h2 className="text-sm font-semibold text-fg mb-2">Welcome-Messages</h2>
              <div className="rounded-md bg-surface border border-line p-5">
                <WelcomeForm
                  guildId={result.guild.id}
                  channels={result.channels.map((c) => ({ id: c.id, name: c.name }))}
                  initial={result.welcome}
                />
              </div>
            </section>

            <section className="mb-6">
              <h2 className="text-sm font-semibold text-fg mb-2">Auto-Roles</h2>
              <div className="rounded-md bg-surface border border-line p-5">
                <AutoRolesForm
                  guildId={result.guild.id}
                  roles={result.roles.map((r) => ({
                    id: r.id,
                    name: r.name,
                    color: r.color,
                  }))}
                  initial={result.autoRoles}
                />
              </div>
            </section>

            <section className="mb-6">
              <h2 className="text-sm font-semibold text-fg mb-2">Reaction Roles</h2>
              <div className="rounded-md bg-surface border border-line p-5 text-sm text-muted">
                Reaction Roles werden aktuell über den Slash-Command{' '}
                <code className="px-1 rounded bg-elev text-fg-soft">/reactionroles</code>{' '}
                im Server verwaltet. Eine UI dafür folgt.
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
