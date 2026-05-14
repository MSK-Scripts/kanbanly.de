import Link from 'next/link';
import { LegalFooter } from '@/components/LegalFooter';
import { BypassClient } from './BypassClient';
import { SUPPORTED_HOSTS } from './hosts';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kanbanly.de';

export const metadata = {
  title: 'Linkvertise Bypass — kanbanly',
  description:
    'Kostenloser Bypasser für Linkvertise, Boost.ink, Adfly, Sub2Unlock, Rekonise, ouo.io und mehr. Direkt im Browser, ohne Anmeldung.',
  alternates: { canonical: `${SITE_URL}/bypass` },
  openGraph: {
    title: 'Linkvertise Bypass — kanbanly',
    description:
      'Linkvertise, Boost.ink & Co. mit einem Klick auflösen. Kostenlos, ohne Anmeldung.',
    url: `${SITE_URL}/bypass`,
  },
};

export default function BypassPage() {
  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight hover:opacity-80"
          >
            kanbanly
          </Link>
          <nav className="flex items-center gap-4 text-[12.5px] text-muted">
            <Link href="/bot" className="hover:text-fg">
              Bot
            </Link>
            <Link href="/login" className="hover:text-fg">
              Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="mb-8">
            <div className="text-[11px] uppercase tracking-wider text-muted mb-2">
              Tool
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              Linkvertise Bypass
            </h1>
            <p className="mt-3 text-[15px] text-muted leading-relaxed">
              Linkvertise, Boost.ink, Adfly, Sub2Unlock & Co. mit einem Klick
              auflösen. Kein Account, keine Werbung, keine Tracker.
            </p>
          </div>

          <BypassClient supportedHosts={SUPPORTED_HOSTS} />

          <div className="mt-10 rounded-xl border border-line bg-surface p-4 text-[13px] text-muted leading-relaxed">
            <div className="text-fg font-medium mb-1">Wie funktioniert das?</div>
            <p>
              Wir leiten deine URL an einen öffentlichen Bypass-Service weiter
              (api.bypass.vip), der den Shortener-Workflow simuliert und die
              Ziel-URL zurückgibt. Wir speichern weder die eingegebene URL noch
              das Ergebnis.
            </p>
            <p className="mt-2">
              Funktioniert ein Link nicht? Der Dienst wird evtl. (noch) nicht
              unterstützt oder hat sein Anti-Bypass-System aktualisiert. In dem
              Fall einfach später nochmal versuchen.
            </p>
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
