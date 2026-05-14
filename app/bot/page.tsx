import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LegalFooter } from '@/components/LegalFooter';
import { HelpMenu } from '@/components/HelpMenu';
import { buildBotInviteUrl } from '@/lib/discord';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kanbanly.de';

export const metadata = {
  title:
    'Kanbanly Discord-Bot — Moderation, Tickets, Leveling, AutoMod & mehr',
  description:
    'Der Kanbanly Discord-Bot: Welcome-Messages, Auto-Roles, Moderation, AutoMod, Logging, Leveling, Tickets, Reminders, Server-Stats — alles aus einem Dashboard. Kostenlos, DSGVO-konform.',
  alternates: { canonical: `${SITE_URL}/bot` },
  openGraph: {
    title: 'Kanbanly Discord-Bot',
    description:
      'Discord-Bot mit Dashboard — Moderation, Tickets, Leveling, AutoMod und vieles mehr.',
    url: `${SITE_URL}/bot`,
  },
};

type Module = {
  id: string;
  icon: string;
  title: string;
  description: string;
  features: string[];
  accent: string;
};

const MODULES: Module[] = [
  {
    id: 'welcome',
    icon: '👋',
    title: 'Welcome',
    description:
      'Begrüße neue Mitglieder mit personalisierten Nachrichten und Platzhaltern.',
    features: ['Live-Preview', 'Markdown', '{user} {mention} {server} {members}'],
    accent: 'from-amber-500/30 to-orange-500/15 text-amber-500',
  },
  {
    id: 'autoroles',
    icon: '🎭',
    title: 'Auto-Roles',
    description:
      'Vergib Rollen automatisch an jedes neue Mitglied — bis zu 10 Rollen pro Server.',
    features: ['Bei Join', 'Mehrere Rollen', 'Rollen-Hierarchie-Check'],
    accent: 'from-fuchsia-500/30 to-pink-500/15 text-fuchsia-500',
  },
  {
    id: 'moderation',
    icon: '⚖️',
    title: 'Moderation',
    description:
      'Klassische Mod-Befehle mit Reason-Logging in Audit-Channel.',
    features: ['/warn', '/kick', '/ban', '/timeout', '/clear'],
    accent: 'from-red-500/30 to-rose-500/15 text-red-500',
  },
  {
    id: 'automod',
    icon: '🛡️',
    title: 'AutoMod',
    description:
      'Spam-, Link-, Caps- und Mention-Filter plus Wort-Blacklist — vollautomatisch.',
    features: ['Link-Allowlist', 'Caps-%', 'Mention-Limit', 'Wort-Filter'],
    accent: 'from-rose-500/30 to-red-500/15 text-rose-500',
  },
  {
    id: 'logging',
    icon: '📋',
    title: 'Logging',
    description:
      'Audit-Trail in deinem Log-Channel: Joins, Leaves, Edits, Deletes, Rollen.',
    features: ['Server-Events', 'Message-Events', 'Rollen-Changes'],
    accent: 'from-sky-500/30 to-cyan-500/15 text-sky-500',
  },
  {
    id: 'leveling',
    icon: '🏆',
    title: 'Leveling',
    description:
      'XP pro Nachricht (15–25 mit 60s Cooldown), Level-Up-Nachrichten und Rollen-Rewards.',
    features: ['/rank', '/leaderboard', 'Reward-Rollen'],
    accent: 'from-yellow-400/30 to-amber-500/15 text-yellow-500',
  },
  {
    id: 'reactionroles',
    icon: '✨',
    title: 'Reaction-Rollen',
    description:
      'Self-Service-Rollen über Emoji-Reaktionen unter einer Nachricht.',
    features: ['/reactionroles add', 'Unlimitierte Rollen', 'Custom-Emojis'],
    accent: 'from-violet-500/30 to-purple-500/15 text-violet-500',
  },
  {
    id: 'tags',
    icon: '🏷️',
    title: 'Tags',
    description:
      'Server-Wiki im Bot: speichere FAQ-Antworten und ruf sie per Command ab.',
    features: ['/tag get', '/tag set', '/tag list', 'Pro Server'],
    accent: 'from-emerald-500/30 to-teal-500/15 text-emerald-500',
  },
  {
    id: 'polls',
    icon: '📊',
    title: 'Polls',
    description:
      'Schnelle Umfragen mit bis zu 10 Optionen — Stimmen per Reaktion.',
    features: ['/poll', 'Bis 10 Optionen', 'Live-Zählung'],
    accent: 'from-indigo-500/30 to-blue-500/15 text-indigo-500',
  },
  {
    id: 'customcmd',
    icon: '⚙️',
    title: 'Custom Commands',
    description:
      'Eigene Prefix-Commands mit Variable-Substitution — wie ein Tag, aber mit Triggern.',
    features: ['Eigene Präfixe', '{user} {server}', 'Pro Server'],
    accent: 'from-purple-500/30 to-pink-500/15 text-purple-500',
  },
  {
    id: 'reminders',
    icon: '⏰',
    title: 'Reminders',
    description:
      'Lass dich vom Bot erinnern — beliebige Zeitspannen, in DM oder Channel.',
    features: ['/remind in 2h', 'DM oder Channel', 'Pro User'],
    accent: 'from-cyan-500/30 to-sky-500/15 text-cyan-500',
  },
  {
    id: 'serverstats',
    icon: '📈',
    title: 'Server-Stats',
    description:
      'Voice-Channels die automatisch deine Member-/Online-Zahlen anzeigen.',
    features: ['Auto-Update', 'Member-Count', 'Online-Count'],
    accent: 'from-teal-500/30 to-emerald-500/15 text-teal-500',
  },
  {
    id: 'tickets',
    icon: '🎫',
    title: 'Tickets',
    description:
      'Support-Ticket-System mit Buttons: Member erstellen Ticket-Channels, Mods schließen sie.',
    features: ['Button-Panel', 'Auto-Channel', 'Transcripts'],
    accent: 'from-orange-500/30 to-amber-500/15 text-orange-500',
  },
  {
    id: 'booster',
    icon: '🚀',
    title: 'Booster-Message',
    description:
      'Bedankt sich automatisch wenn jemand den Server boostet — eigener Channel und Template.',
    features: ['Eigene Message', 'Channel-Pick', 'Platzhalter'],
    accent: 'from-pink-500/30 to-fuchsia-500/15 text-pink-500',
  },
  {
    id: 'sticky',
    icon: '📌',
    title: 'Sticky Messages',
    description:
      'Wichtige Nachrichten bleiben am Channel-Ende — der Bot re-postet automatisch.',
    features: ['Pro Channel', 'Markdown', 'Re-Post-Trigger'],
    accent: 'from-amber-500/30 to-yellow-500/15 text-amber-500',
  },
  {
    id: 'channelmodes',
    icon: '🎯',
    title: 'Channel-Modes',
    description:
      'Bilder-Only oder Text-Only-Channels — Bot löscht alles was nicht passt.',
    features: ['Bilder-Only', 'Text-Only', 'Mod-Bypass'],
    accent: 'from-cyan-500/30 to-sky-500/15 text-cyan-500',
  },
  {
    id: 'embed',
    icon: '🎨',
    title: 'Embed-Creator',
    description:
      'Baue benutzerdefinierte Embeds mit Titel, Beschreibung, Farbe, Bild — und sende sie als Bot.',
    features: ['Live-Preview', '6 Farbpresets', 'Markdown'],
    accent: 'from-purple-500/30 to-indigo-500/15 text-purple-500',
  },
  {
    id: 'verify',
    icon: '🛡️',
    title: 'Verifizierung',
    description:
      'Button-Verify schützt vor Selfbots — neue Member klicken, um die Verified-Rolle zu bekommen.',
    features: ['Button-Panel', 'Verified-Rolle', 'Anti-Selfbot'],
    accent: 'from-blue-500/30 to-sky-500/15 text-blue-500',
  },
  {
    id: 'antiraid',
    icon: '🚨',
    title: 'Anti-Raid',
    description:
      'Erkennt Burst-Joins (X Mitglieder in Y Sekunden) und reagiert automatisch.',
    features: ['Burst-Detection', 'Alert / Kick / Lockdown', 'Alert-Channel'],
    accent: 'from-red-500/30 to-orange-500/15 text-red-500',
  },
  {
    id: 'giveaways',
    icon: '🎉',
    title: 'Giveaways',
    description:
      'Verlose Preise mit Button-Teilnahme, automatischem Ende und Reroll-Funktion.',
    features: ['Button-Join', 'Auto-Ende', 'Reroll'],
    accent: 'from-fuchsia-500/30 to-pink-500/15 text-fuchsia-500',
  },
];

const COMMANDS: Array<{ name: string; description: string }> = [
  { name: '/help', description: 'Zeigt alle Commands.' },
  { name: '/rank', description: 'Dein aktuelles Level und XP.' },
  { name: '/leaderboard', description: 'Top 10 Member nach XP.' },
  { name: '/warn @user grund', description: 'Verwarnung mit Begründung.' },
  { name: '/kick @user grund', description: 'Member aus Server entfernen.' },
  { name: '/ban @user grund', description: 'Member dauerhaft bannen.' },
  { name: '/timeout @user 10m', description: 'Member temporär stummschalten.' },
  { name: '/clear 50', description: 'Bis zu 100 Nachrichten löschen.' },
  { name: '/remind in 2h ...', description: 'Dich später erinnern lassen.' },
  { name: '/poll frage option1 ...', description: 'Umfrage starten.' },
  { name: '/tag get name', description: 'Gespeicherten FAQ-Tag abrufen.' },
  { name: '/ticket setup', description: 'Ticket-Panel im Channel posten.' },
  { name: '/serverstats setup', description: 'Auto-updating Stat-Channels.' },
  { name: '/reactionroles add', description: 'Reaction-Rolle einrichten.' },
  { name: '/slowmode 30', description: 'Slowmode im Channel setzen.' },
  { name: '/roleall @rolle', description: 'Rolle an alle Mitglieder.' },
  { name: '/giveaway start', description: 'Giveaway mit Button-Teilnahme starten.' },
];

export default async function BotLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user);
  const inviteUrl = buildBotInviteUrl();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top-Bar */}
      <header className="border-b border-line bg-surface/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-fg hover:text-accent transition-colors">
            kanbanly
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 text-sm">
            <Link
              href="/trello-alternative"
              className="hidden sm:inline-block px-3 py-1.5 rounded-md text-muted hover:text-fg hover:bg-elev transition-colors"
            >
              Kanban
            </Link>
            <Link
              href="/bot"
              className="px-3 py-1.5 rounded-md text-fg bg-elev font-medium"
            >
              Bot
            </Link>
            {signedIn ? (
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
              >
                Anmelden
              </Link>
            )}
            <HelpMenu />
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[1200px] rounded-full bg-[#5865F2]/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-20 -right-32 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-40 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl"
            aria-hidden
          />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#5865F2]/30 bg-[#5865F2]/10 px-3 py-1 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5865F2] animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#5865F2] font-semibold">
                Discord-Bot · Kostenlos
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-fg leading-[1.05] mb-6">
              Ein Bot für{' '}
              <span className="bg-gradient-to-r from-[#5865F2] via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                deinen Server
              </span>
              .<br />
              Komplett aus dem Dashboard.
            </h1>

            <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed mb-8">
              Welcome-Messages, Moderation, AutoMod, Tickets, Leveling, Logging
              und mehr — vergleichbar mit MEE6 oder Dyno, aber auf Deutsch,
              werbefrei und DSGVO-konform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold px-6 py-3 shadow-lg shadow-[#5865F2]/30 transition-all hover:scale-[1.02]"
              >
                <DiscordIcon className="h-4 w-4" />
                Bot zu Server hinzufügen
              </a>
              <Link
                href={signedIn ? '/integrations/discord' : '/login?next=/integrations/discord'}
                className="inline-flex items-center gap-2 rounded-md border border-line-strong hover:border-fg-soft bg-surface hover:bg-elev text-fg text-sm font-medium px-6 py-3 transition-colors"
              >
                Zum Dashboard →
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-4 max-w-md mx-auto text-center">
              <HeroStat value="21" label="Module" />
              <HeroStat value="20" label="Commands" />
              <HeroStat value="0 €" label="Forever" />
            </div>
          </div>
        </section>

        {/* Module Marketplace */}
        <section id="modules" className="border-b border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-accent mb-2">
                Module
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg mb-3">
                Alles, was dein Server braucht
              </h2>
              <p className="text-base text-muted">
                Jedes Modul einzeln aktivierbar — kein Bloat, keine Premium-Walls.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MODULES.map((m) => (
                <article
                  key={m.id}
                  className="group relative overflow-hidden rounded-lg border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-xl"
                >
                  <div
                    className={`pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br ${m.accent} opacity-40 blur-2xl transition-opacity group-hover:opacity-70`}
                    aria-hidden
                  />
                  <div className="relative">
                    <div
                      className={`h-12 w-12 rounded-lg bg-gradient-to-br ${m.accent} grid place-items-center text-2xl mb-4 border border-line-strong/40 shadow-inner`}
                      aria-hidden
                    >
                      {m.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-fg mb-1.5">
                      {m.title}
                    </h3>
                    <p className="text-sm text-muted leading-relaxed mb-4">
                      {m.description}
                    </p>
                    <ul className="space-y-1.5">
                      {m.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-center gap-2 text-[12px] text-fg-soft"
                        >
                          <span className="h-1 w-1 rounded-full bg-accent shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Commands */}
        <section id="commands" className="border-b border-line bg-elev/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-accent mb-2">
                Slash-Commands
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg mb-3">
                19 Befehle ab Tag eins
              </h2>
              <p className="text-base text-muted">
                Alle Commands sind Slash-Commands — keine Präfixe zu merken.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-3xl mx-auto">
              {COMMANDS.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 hover:border-line-strong transition-colors"
                >
                  <code className="shrink-0 rounded bg-[#5865F2]/15 text-[#5865F2] text-xs font-mono font-semibold px-2 py-0.5">
                    {c.name}
                  </code>
                  <span className="text-xs text-muted truncate">
                    {c.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-b border-line">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-8 sm:p-12">
              <div
                className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#5865F2]/25 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl"
                aria-hidden
              />
              <div className="relative">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg mb-3">
                  Bereit für deinen Server?
                </h2>
                <p className="text-base text-muted mb-8 max-w-md mx-auto">
                  In 30 Sekunden eingerichtet. Alles im Web-Dashboard
                  konfigurierbar — keine Kommandos zum Setup nötig.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold px-6 py-3 shadow-lg shadow-[#5865F2]/30 transition-all hover:scale-[1.02]"
                  >
                    <DiscordIcon className="h-4 w-4" />
                    Jetzt einladen
                  </a>
                  <Link
                    href={signedIn ? '/integrations/discord' : '/login?next=/integrations/discord'}
                    className="text-sm text-muted hover:text-fg transition-colors"
                  >
                    Dashboard öffnen →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LegalFooter />
      </main>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums bg-gradient-to-r from-[#5865F2] to-violet-500 bg-clip-text text-transparent">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-subtle mt-0.5">
        {label}
      </div>
    </div>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
