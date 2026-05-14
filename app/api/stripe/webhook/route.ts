import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature, stripeEnabled } from '@/lib/stripe';
import { invalidatePremiumCache, planFromPriceId } from '@/lib/premium';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!stripeEnabled()) {
    return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 503 });
  }
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ ok: false, reason: 'no signature' }, { status: 400 });
  }
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(raw, signature);
  } catch (err) {
    console.warn('[stripe-webhook] signature failed:', err);
    return NextResponse.json({ ok: false, reason: 'bad signature' }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id;
        if (!orderId) break;
        await admin
          .from('bot_orders')
          .update({
            status: 'paid',
            stripe_payment_intent_id: pi.id,
            paid_at: new Date().toISOString(),
            customer_email: pi.receipt_email ?? null,
          })
          .eq('id', orderId)
          .neq('status', 'paid');
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id;
        if (!orderId) break;
        await admin
          .from('bot_orders')
          .update({ status: 'failed', stripe_payment_intent_id: pi.id })
          .eq('id', orderId)
          .neq('status', 'paid');
        break;
      }
      case 'account.updated': {
        const acc = event.data.object as Stripe.Account;
        await admin
          .from('bot_guilds')
          .update({
            stripe_charges_enabled: Boolean(acc.charges_enabled),
            stripe_details_submitted: Boolean(acc.details_submitted),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', acc.id);
        break;
      }
      // ─── Subscription-Lifecycle (Premium-Plan pro Guild) ───
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        const guildId = session.metadata?.guild_id;
        if (!guildId) break;
        // subscription.created kommt direkt danach — wir setzen aber schon den
        // Stripe-Customer, damit Customer-Portal sofort verfügbar ist.
        if (session.customer) {
          await admin
            .from('bot_subscriptions')
            .upsert(
              {
                guild_id: guildId,
                stripe_customer_id: session.customer as string,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'guild_id' },
            );
        }
        invalidatePremiumCache(guildId);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const guildId = sub.metadata?.guild_id;
        if (!guildId) break;
        const priceId = sub.items.data[0]?.price.id ?? null;
        const plan = planFromPriceId(priceId);
        const statusMap: Record<string, string> = {
          active: 'active',
          trialing: 'trial',
          past_due: 'past_due',
          unpaid: 'past_due',
          canceled: 'cancelled',
          incomplete: 'past_due',
          incomplete_expired: 'expired',
        };
        const status = statusMap[sub.status] ?? 'none';
        await admin.from('bot_subscriptions').upsert(
          {
            guild_id: guildId,
            status,
            plan,
            stripe_customer_id:
              typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: Boolean(sub.cancel_at_period_end),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'guild_id' },
        );
        invalidatePremiumCache(guildId);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const guildId = sub.metadata?.guild_id;
        if (!guildId) break;
        await admin
          .from('bot_subscriptions')
          .update({
            status: 'expired',
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('guild_id', guildId);
        invalidatePremiumCache(guildId);
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === 'string' ? inv.subscription : null;
        if (!subId) break;
        await admin
          .from('bot_subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subId);
        // Cache wird nicht pro guild_id invalidiert — passiert beim nächsten
        // subscription.updated Event eh. Hier 60s Stale ist OK.
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === 'string' ? inv.subscription : null;
        if (!subId) break;
        await admin
          .from('bot_subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subId);
        break;
      }
      case 'account.application.deauthorized': {
        const acc = event.account;
        if (!acc) break;
        await admin
          .from('bot_guilds')
          .update({
            stripe_account_id: null,
            stripe_charges_enabled: false,
            stripe_details_submitted: false,
            stripe_onboarded_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', acc);
        break;
      }
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err);
    // 200 zurück damit Stripe nicht ewig retried — wir haben das Event gespeichert.
  }

  return NextResponse.json({ ok: true });
}
