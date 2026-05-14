import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature, stripeEnabled } from '@/lib/stripe';

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
