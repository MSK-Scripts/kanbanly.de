import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LegalFooter } from '@/components/LegalFooter';
import { HelpMenu } from '@/components/HelpMenu';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kanbanly.de';

export const metadata = {
  title:
    'Trello-Alternative auf Deutsch — kanbanly · schlank, DSGVO-konform, kostenlos',
  description:
    'Kanbanly ist eine minimalistische, deutschsprachige Trello-Alternative für Selbstständige und kleine Teams. DSGVO-konform, ohne Ballast, kostenlos. Vergleich Kanbanly vs Trello.',
  alternates: { canonical: `${SITE_URL}/trello-alternative` },
  openGraph: {
    title: 'Trello-Alternative auf Deutsch — kanbanly',
    description:
      'Schlanke Trello-Alternative aus Deutschland: DSGVO-konform, kostenlos, reduziert auf das Wesentliche.',
    url: `${SITE_URL}/trello-alternative`,
  },
};

const structuredFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Ist Kanbanly eine Trello-Alternative?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ja. Kanbanly ist ein minimalistisches Kanban-Tool mit Workspaces, Boards, Karten, Labels, Fälligkeiten und Zuweisungen — die Kern-Funktionen, die Trello bekannt gemacht haben — in einer schlanken, werbefreien und DSGVO-konformen Variante auf Deutsch.',
      },
    },
    {
      '@type': 'Question',
      name: 'Ist Kanbanly kostenlos?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ja. Kanbanly ist derzeit vollständig kostenlos, ohne Beschränkung der Boards, Karten oder Mitglieder. Keine Kreditkarte nötig.',
      },
    },
    {
      '@type': 'Question',
      name: 'Ist Kanbanly DSGVO-konform?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ja. Die Daten liegen in der EU (Frankfurt) auf Supabase, der Anbieter ist in Deutschland ansässig, Impressum und Datenschutzerklärung sind verfügbar.',
      },
    },
    {
      '@type': 'Question',
      name: 'Was unterscheidet Kanbanly von Trello?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Kanbanly ist bewusst reduziert — kein Power-Up-Store, keine Werbung, keine Marketing-Videos. Fokus auf schnelle Karten-Erstellung, Drag & Drop, Realtime-Sync und deutschsprachige Oberfläche. Für Selbstständige und kleine Teams, denen Trello zu überladen ist.',
      },
    },
  ],
};

type Row = {
  feature: string;
  kanbanly: string | boolean;
  trello: string | boolean;
};

const ROWS: Row[] = [
  { feature: 'Drag & Drop Kanban-Board', kanbanly: true, trello: true },
  { feature: 'Workspaces + Boards', kanbanly: true, trello: true },
  { feature: 'Labels, Fälligkeiten, Zuweisungen', kanbanly: true, trello: true },
  {
    feature: 'Checklisten mit Fortschrittsbalken',
    kanbanly: true,
    trello: true,
  },
  { feature: 'Realtime-Sync zwischen Sessions', kanbanly: true, trello: true },
  { feature: 'Karten-Kommentare mit @mentions', kanbanly: true, trello: true },
  { feature: 'Aktivitätslog pro Karte', kanbanly: true, trello: true },
  {
    feature: 'Markdown in Beschreibungen',
    kanbanly: true,
    trello: 'teilweise',
  },
  { feature: 'Kalender-Ansicht', kanbanly: true, trello: 'Power-Up' },
  { feature: 'Bedienoberfläche auf Deutsch', kanbanly: true, trello: true },
  {
    feature: 'Daten in der EU (Frankfurt)',
    kanbanly: true,
    trello: 'USA',
  },
  { feature: 'DSGVO-konformer Anbieter', kanbanly: true, trello: 'begrenzt' },
  {
    feature: 'Kostenlos ohne Begrenzung der Boards',
    kanbanly: true,
    trello: 'max. 10 im Free-Plan',
  },
  { feature: 'Werbefrei, keine Upsells', kanbanly: true, trello: false },
  {
    feature: 'Open-Source-Ökosystem (Next.js, Supabase)',
    kanbanly: true,
    trello: false,
  },
  { feature: 'Power-Up-Store', kanbanly: false, trello: true },
  { feature: 'Mobile-Apps (iOS/Android)', kanbanly: 'Web', trello: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return <span className="text-emerald-300 font-medium">Ja</span>;
  }
  if (value === false) {
    return <span className="text-rose-300/80">Nein</span>;
  }
  return <span className="text-slate-300">{value}</span>;
}

export default async function TrelloAlternativePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredFaq) }}
      />

      <header className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex flex-col group">
          <h1 className="text-base font-semibold text-slate-100 tracking-tight leading-none group-hover:text-violet-200 transition-colors">
            kanbanly
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Flow first. Build fast.
          </p>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-violet-500/90 hover:bg-violet-400 text-white text-xs font-medium px-3 py-1.5 transition-colors"
            >
              Zum Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs text-slate-300 hover:text-slate-100 transition-colors"
              >
                Anmelden
              </Link>
              <Link
                href="/register"
                className="rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-slate-100 text-xs px-3 py-1.5 transition-colors"
              >
                Registrieren
              </Link>
            </>
          )}
          <HelpMenu />
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="px-4 sm:px-6 pt-12 pb-10 sm:pt-20 sm:pb-14">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-medium text-violet-300 uppercase tracking-wider mb-3">
              Trello-Alternative
            </p>
            <h2 className="text-3xl sm:text-5xl font-semibold text-slate-100 tracking-tight leading-tight mb-5">
              Die schlanke Kanban-Alternative —{' '}
              <span className="bg-gradient-to-r from-violet-300 to-emerald-300 bg-clip-text text-transparent">
                auf Deutsch
              </span>
              .
            </h2>
            <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl">
              Kanbanly ist ein minimalistisches Kanban-Tool für Selbstständige
              und kleine Teams, die ihr Projektmanagement ohne Ballast und ohne
              Werbung machen wollen. DSGVO-konform, aus Deutschland,
              Daten-Hosting in der EU. Kostenlos, ohne Kreditkarte.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link
                href={signedIn ? '/dashboard' : '/register'}
                className="rounded-lg bg-violet-500/90 hover:bg-violet-400 text-white text-sm font-medium px-5 py-2.5 transition-colors shadow-lg shadow-violet-500/20 text-center"
              >
                {signedIn ? 'Zum Dashboard' : 'Konto erstellen — kostenlos'}
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800 text-slate-200 text-sm px-5 py-2.5 transition-colors text-center"
              >
                Zur Landing
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-12">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              Wann Kanbanly passt — wann nicht
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-5">
                <h4 className="text-sm font-semibold text-emerald-300 mb-2">
                  Passt, wenn du …
                </h4>
                <ul className="text-sm text-slate-300 space-y-1.5 leading-relaxed">
                  <li>als Solo-Dev, Freelancer oder Kleinteam arbeitest</li>
                  <li>ein schnelles, schlichtes Board willst</li>
                  <li>deutschsprachige Oberfläche brauchst</li>
                  <li>auf DSGVO und EU-Daten Wert legst</li>
                  <li>ohne Monats-Abo starten willst</li>
                </ul>
              </div>
              <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-5">
                <h4 className="text-sm font-semibold text-rose-300 mb-2">
                  Passt nicht, wenn du …
                </h4>
                <ul className="text-sm text-slate-300 space-y-1.5 leading-relaxed">
                  <li>Gantt-Diagramme, Timelines oder OKRs brauchst</li>
                  <li>Integrationen mit Jira, Slack, Confluence erwartest</li>
                  <li>ein Team mit 50+ Personen koordinierst</li>
                  <li>native iOS/Android-Apps zwingend brauchst</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-12">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-xl font-semibold text-slate-100 mb-1">
              Kanbanly vs Trello im Überblick
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Ehrliche Gegenüberstellung. Kein Trello-Bashing, nur Fakten.
            </p>
            <div className="overflow-x-auto rounded-xl bg-slate-900/60 border border-slate-800/80">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Funktion
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-violet-300 uppercase tracking-wide">
                      Kanbanly
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Trello (Free)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ROWS.map((r) => (
                    <tr key={r.feature}>
                      <td className="px-4 py-3 text-slate-200">{r.feature}</td>
                      <td className="px-4 py-3">
                        <Cell value={r.kanbanly} />
                      </td>
                      <td className="px-4 py-3">
                        <Cell value={r.trello} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              Stand: April 2026. Angaben zu Trello basieren auf dem offiziellen
              Free-Plan von Atlassian und können sich ändern.
            </p>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-12">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-xl font-semibold text-slate-100 mb-5">
              Warum eine deutsche Alternative überhaupt?
            </h3>
            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                Trello hat Kanban-Boards 2011 populär gemacht und macht einen
                guten Job für Teams, die den Atlassian-Stack sowieso nutzen.
                Für viele deutschsprachige Selbstständige und kleine Teams ist
                es aber drei Schritte zu viel: überfrachteter Power-Up-Store,
                Daten in den USA, Upsells zum Premium-Plan.
              </p>
              <p>
                <strong className="text-slate-100">Kanbanly</strong> verzichtet
                bewusst auf Marketplace-Ecosystem, Enterprise-Features und
                Monetarisierungs-Druck. Stattdessen: schneller
                Karten-Workflow, Realtime-Sync zwischen Sessions, Markdown in
                Beschreibungen und Kommentaren, Fälligkeiten mit visuellen
                Warnungen, Aktivitätslog pro Karte. Alles auf Deutsch, alles
                aus der EU heraus betrieben.
              </p>
              <p>
                Die Infrastruktur läuft auf{' '}
                <span className="font-mono text-xs text-slate-400">
                  Supabase (Frankfurt)
                </span>{' '}
                und einem deutschen VPS. Der Code liegt öffentlich auf GitHub —
                wenn du willst, kannst du die Entwicklung live verfolgen.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-20 sm:pb-24">
          <div className="max-w-3xl mx-auto rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 sm:p-8 text-center">
            <h3 className="text-xl font-semibold text-slate-100 mb-2">
              Ausprobieren kostet nichts
            </h3>
            <p className="text-sm text-slate-400 mb-5 max-w-md mx-auto">
              Leg in unter einer Minute deinen ersten Workspace an. Keine
              Kreditkarte, keine Trial-Beschränkung.
            </p>
            <Link
              href={signedIn ? '/dashboard' : '/register'}
              className="inline-block rounded-lg bg-violet-500/90 hover:bg-violet-400 text-white text-sm font-medium px-5 py-2.5 transition-colors"
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
