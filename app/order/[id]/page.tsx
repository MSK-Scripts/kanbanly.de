import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createConnectPaymentIntent,
  stripeEnabled,
} from '@/lib/stripe';
import { CheckoutClient } from './CheckoutClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata = {
  title: 'Bezahlen · kanbanly',
  robots: { index: false, follow: false },
};

function formatPrice(cents: number, currency: string): string {
  const value = (cents / 100).toFixed(2);
  const cur = currency.toUpperCase();
  if (cur === 'EUR') return `${value.replace('.', ',')} €`;
  if (cur === 'USD') return `$${value}`;
  return `${value} ${cur}`;
}

type Props = { params: Promise<{ id: string }> };

export default async function OrderCheckoutPage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from('bot_orders')
    .select(
      'id, guild_id, product_name, amount_cents, currency, status, stripe_payment_intent_id',
    )
    .eq('id', id)
    .maybeSingle();
  if (!order) notFound();

  // Schon bezahlt? Saubere Bestätigung anzeigen.
  if (order.status === 'paid' || order.status === 'fulfilled') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-fg p-6">
        <div className="max-w-md w-full rounded-xl border border-line bg-surface p-8 text-center">
          <div className="text-3xl mb-3">✅</div>
          <h1 className="text-xl font-semibold mb-2">Zahlung erfolgreich</h1>
          <p className="text-sm text-muted">
            Vielen Dank für deine Bestellung. Das Staff-Team wurde im Discord-Channel
            benachrichtigt.
          </p>
        </div>
      </main>
    );
  }
  if (order.status === 'cancelled' || order.status === 'refunded' || order.status === 'failed') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-fg p-6">
        <div className="max-w-md w-full rounded-xl border border-line bg-surface p-8 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h1 className="text-xl font-semibold mb-2">Bestellung nicht aktiv</h1>
          <p className="text-sm text-muted">
            Diese Bestellung ist {order.status === 'failed' ? 'fehlgeschlagen' : 'storniert/erstattet'} und kann nicht mehr bezahlt werden.
          </p>
        </div>
      </main>
    );
  }

  if (!stripeEnabled()) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-fg p-6">
        <div className="max-w-md w-full rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Bezahlung temporär nicht möglich</h1>
          <p className="text-sm text-muted">
            Stripe ist auf dieser Plattform aktuell deaktiviert.
          </p>
        </div>
      </main>
    );
  }

  // Stripe-Account des Servers laden.
  const { data: guildRow } = await admin
    .from('bot_guilds')
    .select(
      'stripe_account_id, stripe_charges_enabled, shop_platform_fee_bps, name',
    )
    .eq('guild_id', order.guild_id)
    .maybeSingle();
  if (!guildRow?.stripe_account_id || !guildRow.stripe_charges_enabled) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-fg p-6">
        <div className="max-w-md w-full rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Shop nicht aktiv</h1>
          <p className="text-sm text-muted">
            Der Server-Owner hat sein Stripe-Konto nicht (vollständig) verbunden.
          </p>
        </div>
      </main>
    );
  }

  const feeBps = (guildRow.shop_platform_fee_bps as number) ?? 0;
  const applicationFeeAmount = feeBps > 0
    ? Math.floor((order.amount_cents as number) * (feeBps / 10000))
    : 0;

  // PaymentIntent — wenn schon vorhanden, müssten wir ihn retrieven; für MVP
  // legen wir bei jedem Page-Load ggf. neu an (idempotent über order_id metadata).
  let clientSecret: string;
  const stripeAccountId: string = guildRow.stripe_account_id as string;
  try {
    const pi = await createConnectPaymentIntent({
      amountCents: order.amount_cents as number,
      currency: order.currency as string,
      stripeAccountId,
      applicationFeeAmount,
      metadata: { order_id: order.id as string },
    });
    clientSecret = pi.client_secret ?? '';
    // PI-ID speichern (idempotent).
    if (pi.id && pi.id !== order.stripe_payment_intent_id) {
      await admin
        .from('bot_orders')
        .update({ stripe_payment_intent_id: pi.id })
        .eq('id', order.id);
    }
  } catch (err) {
    console.error('[order] PaymentIntent:', err);
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-fg p-6">
        <div className="max-w-md w-full rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Bezahlung nicht möglich</h1>
          <p className="text-sm text-muted">
            Stripe konnte die Zahlung nicht initialisieren.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg text-fg p-6">
      <div className="max-w-md w-full rounded-xl border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold mb-1">{order.product_name}</h1>
        <div className="text-sm text-muted mb-4">
          {(guildRow.name as string | null) ?? 'Bestellung'}
        </div>
        <div className="text-2xl font-bold mb-4">
          {formatPrice(order.amount_cents as number, order.currency as string)}
        </div>
        <CheckoutClient
          clientSecret={clientSecret}
          stripeAccountId={stripeAccountId}
          publishableKey={process.env.STRIPE_PUBLISHABLE_KEY ?? ''}
        />
        <p className="text-[11px] text-subtle mt-4 leading-relaxed">
          Sichere Zahlungsabwicklung durch Stripe. Deine Zahlungsdaten werden
          niemals auf kanbanly.de gespeichert.
        </p>
      </div>
    </main>
  );
}
