'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  getPremiumStatus,
  startGuildTrial,
  createPremiumCheckout,
  createPremiumPortal,
  type PremiumStatusView,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { StatusBanner, StatusPill } from './ui/Status';

type Plan = 'monthly' | 'quarterly' | 'biannual';

const PLANS: Array<{
  key: Plan;
  badge: string | null;
  title: string;
  subtitle: string;
  pricePerMonth: string;
  totalNote: string;
  highlight?: boolean;
  benefits: string[];
}> = [
  {
    key: 'monthly',
    badge: null,
    title: '1 Monat',
    subtitle: 'Keine Mindestlaufzeit',
    pricePerMonth: '5,99 €',
    totalNote: 'inkl. 19% MwSt.',
    benefits: [
      'Alle Premium-Module',
      '24/7 Support',
      'Regelmäßige Updates',
      'Monatlich kündbar',
    ],
  },
  {
    key: 'quarterly',
    badge: 'Beliebtester Plan',
    title: '3 Monate',
    subtitle: '3 Monate Mindestlaufzeit',
    pricePerMonth: '4,99 €',
    totalNote: '14,97 € · inkl. 19% MwSt.',
    highlight: true,
    benefits: [
      'Alle Premium-Module',
      '24/7 Support',
      'Regelmäßige Updates',
      '17 % günstiger',
    ],
  },
  {
    key: 'biannual',
    badge: '–33 %',
    title: '6 Monate',
    subtitle: '6 Monate Mindestlaufzeit',
    pricePerMonth: '3,99 €',
    totalNote: '23,94 € · inkl. 19% MwSt.',
    benefits: [
      'Alle Premium-Module',
      '24/7 Support',
      'Regelmäßige Updates',
      '33 % günstiger',
    ],
  },
];

export function PremiumForm({ guildId }: { guildId: string }) {
  const [status, setStatus] = useState<PremiumStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getPremiumStatus(guildId).then((r) => {
      if (r.ok && r.status) setStatus(r.status);
      setLoading(false);
    });
  }, [guildId]);

  const isPremium =
    status?.status === 'active' ||
    status?.status === 'trial' ||
    status?.status === 'past_due';

  const startTrial = () => {
    startTransition(async () => {
      const r = await startGuildTrial(guildId);
      if (r.ok) {
        toast.success('14-Tage-Trial gestartet! Alle Premium-Module freigeschaltet.');
        const refreshed = await getPremiumStatus(guildId);
        if (refreshed.ok && refreshed.status) setStatus(refreshed.status);
      } else toast.error('Trial konnte nicht gestartet werden', r.error);
    });
  };

  const checkout = (plan: Plan) => {
    startTransition(async () => {
      const r = await createPremiumCheckout(guildId, plan);
      if (r.ok && r.url) {
        window.location.href = r.url;
      } else toast.error('Checkout-Fehler', r.error);
    });
  };

  const portal = () => {
    startTransition(async () => {
      const r = await createPremiumPortal(guildId);
      if (r.ok && r.url) {
        window.location.href = r.url;
      } else toast.error('Portal-Fehler', r.error);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-subtle py-6">
        <Spinner size="xs" /> Lade Premium-Status…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status-Card */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-accent-soft font-mono mb-1">
              Status
            </div>
            <h2 className="text-xl font-bold text-fg">
              {status?.status === 'active' && 'Premium aktiv'}
              {status?.status === 'trial' && 'Trial läuft'}
              {status?.status === 'past_due' && 'Zahlung überfällig'}
              {status?.status === 'cancelled' && 'Gekündigt'}
              {status?.status === 'expired' && 'Premium abgelaufen'}
              {(!status || status.status === 'none') && 'Free-Tier'}
            </h2>
            {status?.currentPeriodEnd && isPremium && (
              <div className="text-[12.5px] text-muted mt-1">
                {status.cancelAtPeriodEnd ? 'Endet' : 'Verlängert'} am{' '}
                {new Date(status.currentPeriodEnd).toLocaleDateString('de-DE')}
              </div>
            )}
          </div>
          <StatusPill kind={isPremium ? 'success' : 'neutral'} dot>
            {isPremium ? 'Premium' : 'Free'}
          </StatusPill>
        </div>
        <p className="text-[13px] text-muted leading-relaxed">
          Im Free-Tier sind Welcome, Auto-Roles, Logging (basic), Levels (max. 5
          Reward-Rollen) und Reaction-Roles (max. 3 Panels) inklusive. Alle
          weiteren Module brauchen Premium.
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          {status?.hasStripeCustomer && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={portal}
              loading={pending}
            >
              Abo verwalten / Rechnungen
            </Button>
          )}
          {!isPremium && !status?.trialUsed && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={startTrial}
              loading={pending}
            >
              14-Tage-Trial starten (kostenlos)
            </Button>
          )}
        </div>
      </div>

      {/* Pakete */}
      {!isPremium && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-accent-soft font-mono mb-1">
            Pakete
          </div>
          <h3 className="text-lg font-semibold text-fg mb-4">
            Wähle das passende Modell
          </h3>
          {status?.trialUsed && (
            <StatusBanner kind="info">
              Dein 14-Tage-Trial wurde bereits genutzt. Wähle unten ein Paket.
            </StatusBanner>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            {PLANS.map((p) => (
              <div
                key={p.key}
                className={`rounded-xl border ${
                  p.highlight
                    ? 'border-accent bg-accent/5'
                    : 'border-line bg-surface'
                } p-5 flex flex-col`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase tracking-wide text-accent-soft font-mono">
                    {p.title}
                  </div>
                  {p.badge && (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        p.highlight
                          ? 'bg-accent text-white'
                          : 'bg-elev text-fg-soft border border-line'
                      }`}
                    >
                      {p.badge}
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-muted mb-3">{p.subtitle}</div>
                <div className="text-3xl font-bold text-fg mb-1">
                  {p.pricePerMonth}
                  <span className="text-sm font-normal text-muted ml-1">/Monat</span>
                </div>
                <div className="text-[11px] text-subtle mb-4">{p.totalNote}</div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {p.benefits.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-[12.5px] text-fg-soft"
                    >
                      <span className="text-[var(--success)] shrink-0 leading-5">
                        ✓
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="md"
                  variant={p.highlight ? 'primary' : 'secondary'}
                  onClick={() => checkout(p.key)}
                  loading={pending}
                >
                  In den Warenkorb
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
