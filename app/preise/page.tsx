import Link from 'next/link';
import { LegalFooter } from '@/components/LegalFooter';

export const metadata = {
  title: 'Bot-Preise & Pläne · kanbanly',
  description:
    'kanbanly-Bot — 14 Tage kostenlos testen, dann 5,99 €/Monat. Alle Premium-Module: Tickets, Helpdesk, Verify, Anti-Raid, Giveaways, Shop und mehr.',
};

type Plan = {
  index: string;
  badge: { label: string; tone: 'trial' | 'popular' | 'discount' } | null;
  title: string;
  subtitle: string;
  price: string;
  priceUnit: string | null;
  priceNote: string | null;
  benefits: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    index: '00',
    badge: { label: 'Trial', tone: 'trial' },
    title: '14 Tage',
    subtitle: 'Nur 1× einlösbar',
    price: '0,00 €',
    priceUnit: null,
    priceNote: null,
    benefits: [
      '14 Tage kostenlos',
      'Alle Premium-Module',
      'Community-Support',
      'Regelmäßige Updates',
    ],
    cta: { label: 'Trial im Dashboard starten', href: '/integrations/discord' },
  },
  {
    index: '01',
    badge: null,
    title: '1 Monat',
    subtitle: 'Keine Mindestlaufzeit',
    price: '5,99 €',
    priceUnit: '/Monat',
    priceNote: 'inkl. 19 % MwSt.',
    benefits: [
      'Vollständiger Bot-Zugriff',
      'Unbegrenzte Module',
      'Support',
      'Regelmäßige Updates',
      'Monatlich kündbar',
    ],
    cta: { label: 'Im Dashboard kaufen', href: '/integrations/discord' },
  },
  {
    index: '02',
    badge: { label: 'Beliebtester Plan', tone: 'popular' },
    title: '3 Monate',
    subtitle: '3 Monate Mindestlaufzeit',
    price: '4,99 €',
    priceUnit: '/Monat',
    priceNote: '14,97 € · inkl. 19 % MwSt.',
    highlight: true,
    benefits: [
      'Vollständiger Bot-Zugriff',
      'Unbegrenzte Module',
      'Support',
      'Regelmäßige Updates',
      '17 % günstiger',
    ],
    cta: { label: 'Im Dashboard kaufen', href: '/integrations/discord' },
  },
  {
    index: '03',
    badge: { label: '–33 %', tone: 'discount' },
    title: '6 Monate',
    subtitle: '6 Monate Mindestlaufzeit',
    price: '3,99 €',
    priceUnit: '/Monat',
    priceNote: '23,94 € · inkl. 19 % MwSt.',
    benefits: [
      'Vollständiger Bot-Zugriff',
      'Unbegrenzte Module',
      'Support',
      'Regelmäßige Updates',
      '33 % günstiger',
    ],
    cta: { label: 'Im Dashboard kaufen', href: '/integrations/discord' },
  },
];

function BadgeChip({ tone, label }: { tone: 'trial' | 'popular' | 'discount'; label: string }) {
  const cls =
    tone === 'popular'
      ? 'bg-fg text-bg'
      : tone === 'discount'
      ? 'bg-elev text-fg-soft border border-line'
      : 'bg-elev text-fg-soft border border-line';
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-[0.15em] px-2.5 py-1 rounded ${cls}`}
    >
      {label}
    </span>
  );
}

export default function PreisePage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-fg">
            kanbanly
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/bot" className="text-muted hover:text-fg transition-colors">
              Bot
            </Link>
            <Link href="/preise" className="text-fg font-medium">
              Preise
            </Link>
            <Link
              href="/integrations/discord"
              className="rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-3.5 py-1.5 transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-accent-soft mb-3">
          Pricing · 04 Plans
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-fg mb-3">
          Bot Preise &amp; Pläne
        </h1>
        <p className="text-[14px] text-muted max-w-xl mb-12">
          Wähle das passende Abo für deinen Discord-Server. Alle Premium-Module
          (Tickets, Helpdesk, Verify, Anti-Raid, Giveaways, Bestellsystem, AutoMod
          und mehr) sind in jedem Plan enthalten.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLANS.map((p) => (
            <div
              key={p.index}
              className={`rounded-xl border ${
                p.highlight ? 'border-fg/40 bg-elev/40' : 'border-line bg-surface'
              } p-6 flex flex-col`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] text-subtle font-mono">{p.index}</span>
                {p.badge && <BadgeChip tone={p.badge.tone} label={p.badge.label} />}
              </div>
              <h3 className="text-xl font-bold text-fg leading-tight">{p.title}</h3>
              <div className="text-[12px] text-muted mt-0.5 mb-5">{p.subtitle}</div>
              <div className="text-4xl font-bold text-fg leading-none mb-1">
                {p.price}
                {p.priceUnit && (
                  <span className="text-sm font-normal text-muted ml-1">
                    {p.priceUnit}
                  </span>
                )}
              </div>
              {p.priceNote && (
                <div className="text-[11px] text-subtle mb-5">{p.priceNote}</div>
              )}
              {!p.priceNote && <div className="mb-5" />}
              <ul className="space-y-1.5 mb-6 flex-1">
                {p.benefits.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-[13px] text-fg-soft"
                  >
                    <span className="text-[var(--success)] shrink-0 leading-5">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.cta.href}
                className={`text-center rounded-md text-sm font-semibold px-4 py-2.5 transition-colors ${
                  p.highlight
                    ? 'bg-fg text-bg hover:bg-fg/90'
                    : 'border border-line-strong hover:border-fg-soft bg-elev text-fg'
                }`}
              >
                {p.cta.label}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-line bg-surface p-6">
            <h2 className="text-base font-semibold text-fg mb-2">
              Was ist im Free-Tier dabei?
            </h2>
            <ul className="text-[13px] text-fg-soft space-y-1.5">
              <li>· Welcome / Goodbye-Nachrichten</li>
              <li>· Auto-Roles beim Join</li>
              <li>· Logging (Joins, Leaves, Edits, Deletes)</li>
              <li>· XP &amp; Levels (max. 5 Reward-Rollen)</li>
              <li>· Reaction-Roles (max. 3 Panels)</li>
              <li>· Slash-Moderation (/warn, /kick, /ban, /timeout)</li>
              <li>· Embed-Creator (basic)</li>
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6">
            <h2 className="text-base font-semibold text-fg mb-2">Premium schaltet frei</h2>
            <ul className="text-[13px] text-fg-soft space-y-1.5">
              <li>· Tickets v3 (Multi-Button, Feedback, SLA, Transcripts)</li>
              <li>· Helpdesk-Panels</li>
              <li>· Verify + Anti-Raid</li>
              <li>· Giveaways</li>
              <li>· AutoMod (advanced) + Custom-Commands</li>
              <li>· Suggestions + Panel</li>
              <li>· Birthday / Role-Badges / AFK / Invite-Tracker</li>
              <li>· Temp-Voice / Daily-Image / Teamlisten</li>
              <li>· Preisliste · Bestellsystem (Stripe)</li>
              <li>· Webhook-Sender · AI-Features</li>
              <li>· Unbegrenzte Reaction-Role-Panels, Level-Rewards, …</li>
            </ul>
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
