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

// 12 sichtbare Module + Platzhalter "+30 weitere"
const FEATURED_MODULES = [
  { id: 'moderation', name: 'Moderation', Icon: ShieldIcon },
  { id: 'tickets', name: 'Ticket System', Icon: TicketIcon },
  { id: 'levels', name: 'Leveling & XP', Icon: TrendingIcon },
  { id: 'games', name: 'Games', Icon: GamepadIcon },
  { id: 'embed', name: 'Embed Creator', Icon: ChatIcon },
  { id: 'welcome', name: 'Willkommenssystem', Icon: BellIcon },
  { id: 'rr', name: 'Reaction Roles', Icon: UsersIcon },
  { id: 'verify', name: 'Verifizierung', Icon: CheckIcon },
  { id: 'custom', name: 'Custom Commands', Icon: CommandIcon },
  { id: 'automod', name: 'Auto-Moderation', Icon: ZapIcon },
  { id: 'giveaways', name: 'Giveaways', Icon: HeartIcon },
] as const;

const COMMUNITY_FEATURES = [
  'Welcome & Reaction-Roles',
  'Auto-Roles beim Join',
  'Moderation /warn /kick /ban',
  'Logging der Events',
  'XP-System & Levels',
  'Level-Rewards (Rollen)',
  'Leaderboard /rank',
  'Pro Server konfigurierbar',
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
      <header className="border-b border-line bg-bg/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-fg hover:text-accent-soft transition-colors"
          >
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
        <section className="border-b border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-accent-soft mb-4">
              Discord-Bot · Kostenlos
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-fg leading-[1.05] mb-5">
              Alles, was dein Server braucht.
            </h1>
            <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed mb-8">
              Welcome-Messages, Moderation, AutoMod, Tickets, Leveling, Logging
              und mehr — auf Deutsch, werbefrei, DSGVO-konform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-2.5 transition-all"
              >
                Bot zu Server hinzufügen
              </a>
              <Link
                href={signedIn ? '/integrations/discord' : '/login?next=/integrations/discord'}
                className="inline-flex items-center gap-2 rounded-md border border-line-strong hover:border-fg-soft bg-surface hover:bg-elev text-fg text-sm font-medium px-5 py-2.5 transition-colors"
              >
                Zum Dashboard →
              </Link>
            </div>
          </div>
        </section>

        {/* INKLUSIVE — Discord-Bot für deine Community */}
        <section className="border-b border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="rounded-2xl border border-line bg-surface p-8 sm:p-10">
              <div className="flex items-start justify-between gap-6 flex-wrap mb-5">
                <div className="min-w-0 max-w-xl">
                  <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-accent-soft mb-3">
                    Inklusive
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg leading-tight mb-3">
                    Discord-Bot für deine Community
                  </h2>
                  <p className="text-[14px] text-muted leading-relaxed">
                    Welcome-Messages, Reaction-Roles, Auto-Roles, Moderation,
                    Logging und ein XP-/Leveling-System. Alles über ein
                    Web-Dashboard konfigurierbar — keine Slash-Commands raten.
                  </p>
                </div>
                <Link
                  href={signedIn ? '/integrations/discord' : '/login?next=/integrations/discord'}
                  className="inline-flex items-center gap-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-5 py-2.5 transition-all shrink-0"
                >
                  Bot einrichten
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {COMMUNITY_FEATURES.map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 rounded-lg border border-line bg-elev/40 px-3 py-2.5"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-[var(--success)] shrink-0" />
                    <span className="text-[13px] text-fg-soft truncate">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 40+ Module — Alles inklusive */}
        <section className="border-b border-line" id="modules">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
              <div className="max-w-xl">
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-accent-soft mb-3">
                  40+ Module
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg leading-tight mb-3">
                  Alles inklusive. Keine Extras.
                </h2>
                <p className="text-[14px] text-muted leading-relaxed">
                  Jedes Modul ist in jedem Plan enthalten. Aktiviere was du
                  brauchst, deaktiviere den Rest.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                <span className="text-[11.5px] text-fg-soft font-medium">
                  Alle Module kostenlos
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {FEATURED_MODULES.map((m) => (
                <div
                  key={m.id}
                  className="group flex items-center gap-3 rounded-lg border border-line bg-surface hover:border-line-strong hover:bg-elev/50 px-4 py-3.5 transition-all"
                >
                  <m.Icon className="h-4 w-4 text-muted group-hover:text-fg transition-colors shrink-0" />
                  <span className="text-[13.5px] font-medium text-fg truncate">
                    {m.name}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface/40 px-4 py-3.5">
                <span className="text-[13.5px] text-subtle">+30 weitere</span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-b border-line">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg mb-3">
              Bereit für deinen Server?
            </h2>
            <p className="text-base text-muted mb-8 max-w-md mx-auto">
              In 30 Sekunden eingerichtet. Alles im Web-Dashboard
              konfigurierbar.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-6 py-3 transition-all"
              >
                Jetzt einladen
              </a>
              <Link
                href={signedIn ? '/integrations/discord' : '/login?next=/integrations/discord'}
                className="text-sm text-muted hover:text-fg transition-colors px-4 py-3"
              >
                Dashboard öffnen →
              </Link>
            </div>
          </div>
        </section>

        <LegalFooter />
      </main>
    </div>
  );
}

// ============== Icons (Lucide-style, inline SVG) ==============

type IconProps = { className?: string };

function CheckCircle({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function TicketIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z" />
      <line x1="13" y1="5" x2="13" y2="7" />
      <line x1="13" y1="11" x2="13" y2="13" />
      <line x1="13" y1="17" x2="13" y2="19" />
    </svg>
  );
}

function TrendingIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function GamepadIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258C21.305 6.91 19.5 5 17.32 5z" />
    </svg>
  );
}

function ChatIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BellIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 12 15 17 10" />
    </svg>
  );
}

function CommandIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function ZapIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function HeartIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
