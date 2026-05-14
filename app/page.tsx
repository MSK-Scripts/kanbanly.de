import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LegalFooter } from '@/components/LegalFooter';
import { HelpMenu } from '@/components/HelpMenu';
import { BoardPreview } from '@/components/BoardPreview';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kanbanly.de';

export const metadata = {
  title:
    'kanbanly — minimalistische Kanban-Alternative auf Deutsch · Flow first. Build fast.',
  description:
    'Kanbanly ist ein schlankes Kanban-Tool für Selbstständige und kleine Teams: Boards, Karten, Labels, Fälligkeiten, Zuweisungen, Realtime-Sync. Kostenlos, DSGVO-konform, ohne Ballast.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'kanbanly — minimalistische Kanban-Alternative',
    description:
      'Schlankes Kanban-Tool auf Deutsch. Boards, Labels, Realtime-Sync. Kostenlos und DSGVO-konform.',
    url: SITE_URL,
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'kanbanly',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description:
    'Minimalistisches Kanban-Tool für Selbstständige und kleine Teams. Boards, Karten, Labels, Fälligkeiten, Zuweisungen, Realtime-Sync. DSGVO-konform, auf Deutsch, kostenlos.',
  inLanguage: 'de-DE',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  },
  creator: {
    '@type': 'Person',
    name: 'Felix Franzen',
  },
  featureList: [
    'Drag & Drop Kanban-Board',
    'Workspaces und Boards',
    'Labels in acht Farben',
    'Fälligkeitsdaten mit visueller Warnung',
    'Mitglieder-Zuweisungen',
    'Checklisten pro Karte',
    'Markdown-Beschreibungen',
    'Karten-Kommentare mit @mentions',
    'Aktivitätslog pro Karte',
    'Kalender-Ansicht',
    'Realtime-Synchronisation zwischen Sessions',
    'Rollen Viewer, Editor, Admin',
    'Lesbare Slug-URLs',
  ],
};

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signedIn = Boolean(user);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-base font-semibold text-fg tracking-tight leading-none">
            kanbanly
          </h1>
          <p className="text-[11px] text-subtle mt-0.5">
            Flow first. Build fast.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium px-3 py-1.5 transition-colors"
            >
              Zum Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs text-fg-soft hover:text-fg transition-colors"
              >
                Anmelden
              </Link>
              <Link
                href="/register"
                className="rounded-md border border-line-strong hover:border-muted bg-elev hover:bg-elev-hover text-fg-soft hover:text-fg text-xs px-3 py-1.5 transition-colors"
              >
                Registrieren
              </Link>
            </>
          )}
          <HelpMenu />
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="px-4 sm:px-6 pt-12 pb-16 sm:pt-24 sm:pb-28">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-5xl font-semibold text-fg tracking-tight leading-tight">
              Manage dein Projekt —
              <span className="block text-accent">ohne Chaos.</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted max-w-xl mx-auto leading-relaxed">
              Workspaces, Boards, Karten mit Labels, Fälligkeiten und
              Zuweisungen. Drag &amp; Drop, live gespeichert. Gemacht für dich
              und dein Team.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <Link
                href={signedIn ? '/dashboard' : '/register'}
                className="rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-5 py-2.5 transition-colors"
              >
                {signedIn ? 'Zum Dashboard' : 'Manage dein Projekt'}
              </Link>
              {!signedIn && (
                <Link
                  href="/login"
                  className="rounded-md border border-line-strong hover:border-muted bg-elev hover:bg-elev-hover text-fg-soft text-sm px-5 py-2.5 transition-colors"
                >
                  Anmelden
                </Link>
              )}
            </div>
          </div>

          <div className="mt-12 sm:mt-16 max-w-5xl mx-auto">
            <BoardPreview />
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-16 sm:pb-20">
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Feature
              title="Workspaces & Boards"
              body="Strukturiere mehrere Projekte parallel. Jeder Workspace hat eigene Boards und Mitglieder."
            />
            <Feature
              title="Drag & Drop"
              body="Karten flüssig zwischen Spalten ziehen — Reihenfolge bleibt sofort gespeichert."
            />
            <Feature
              title="Labels & Fälligkeiten"
              body="Acht Farb-Labels pro Karte, Fällig-am mit Tönen für überfällig, heute und bald."
            />
            <Feature
              title="Team-Zuweisungen"
              body="Lade andere per Link ein, weise Karten zu — mit Rollen Viewer, Editor, Admin."
            />
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-16 sm:pb-20">
          <div className="max-w-5xl mx-auto rounded-md bg-surface border border-line p-6 sm:p-10">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center mb-6">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-accent-soft font-mono mb-1">
                  Inklusive
                </div>
                <h3 className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight">
                  Discord-Bot für deine Community
                </h3>
                <p className="text-sm text-muted mt-2 max-w-xl">
                  40+ Module: Welcome, Reaction-Roles, Auto-Roles, Tickets,
                  Helpdesk, Verify, Anti-Raid, Giveaways, XP/Level, Moderation,
                  Logging und mehr. Alles über das Web-Dashboard konfigurierbar.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <Link
                  href="/preise"
                  className="rounded-md border border-line-strong hover:border-fg-soft bg-surface hover:bg-elev text-fg text-sm font-medium px-5 py-2.5 transition-colors text-center"
                >
                  Preise &amp; Pläne
                </Link>
                <Link
                  href={signedIn ? '/integrations/discord' : '/register'}
                  className="rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium px-5 py-2.5 transition-colors text-center"
                >
                  {signedIn ? 'Bot einrichten' : 'Jetzt starten'}
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BotFeature label="Welcome &amp; Reaction-Roles" />
              <BotFeature label="Tickets &amp; Helpdesk" />
              <BotFeature label="Verify &amp; Anti-Raid" />
              <BotFeature label="Giveaways" />
              <BotFeature label="XP-System &amp; Level-Rewards" />
              <BotFeature label="Moderation /warn /kick /ban" />
              <BotFeature label="Logging der Events" />
              <BotFeature label="40+ Module insgesamt" />
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-16 sm:pb-20">
          <div className="max-w-5xl mx-auto rounded-md bg-surface border border-line p-6 sm:p-10">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center mb-6">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-accent-soft font-mono mb-1">
                  Mini-Tool
                </div>
                <h3 className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight">
                  Linkvertise / Boost-Link Bypass
                </h3>
                <p className="text-sm text-muted mt-2 max-w-xl">
                  Verkürzungs- und Werbe-Link-Dienste (Linkvertise, Boost.ink,
                  Lootlinks, Rekonise, AdFly und mehr) führen oft zu langen
                  Captcha-Ketten. Wirf den Link in unser kostenloses Bypass-Tool —
                  zurück kommt das echte Ziel.
                </p>
              </div>
              <Link
                href="/bypass"
                className="rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-5 py-2.5 transition-colors text-center shrink-0"
              >
                Bypass öffnen
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BotFeature label="Linkvertise &amp; link-to.net" />
              <BotFeature label="Boost.ink, mboost.me" />
              <BotFeature label="Sub2unlock, Rekonise" />
              <BotFeature label="Lootlinks, Lootdest" />
              <BotFeature label="AdFly, Shorte.st, AdFoc.us" />
              <BotFeature label="ouo.io, bit.ly, tinyurl" />
              <BotFeature label="Kostenlos, ohne Login" />
              <BotFeature label="Kein Tracking" />
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-20 sm:pb-24">
          <div className="max-w-3xl mx-auto rounded-md bg-surface border border-line p-6 sm:p-8 text-center">
            <h3 className="text-xl font-semibold text-fg mb-2">
              Bereit loszulegen?
            </h3>
            <p className="text-sm text-muted mb-5">
              Leg in unter einer Minute deinen ersten Workspace an.
            </p>
            <Link
              href={signedIn ? '/dashboard' : '/register'}
              className="inline-block rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-5 py-2.5 transition-colors"
            >
              {signedIn ? 'Zum Dashboard' : 'Konto erstellen'}
            </Link>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md bg-surface border border-line p-5">
      <h4 className="text-sm font-semibold text-fg mb-1.5">{title}</h4>
      <p className="text-xs text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function BotFeature({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-elev border border-line-strong px-3 py-2">
      <span className="text-emerald-500 text-xs leading-5 shrink-0">✓</span>
      <span
        className="text-xs text-fg-soft leading-snug"
        dangerouslySetInnerHTML={{ __html: label }}
      />
    </div>
  );
}
