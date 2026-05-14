import 'server-only';
import Stripe from 'stripe';

/**
 * Plattform-Stripe-Client (kanbanly). Geht über alle Connect-Accounts hinweg.
 * Für Calls im Namen eines verbundenen Accounts (Charge, Refund) immer
 * `{ stripeAccount }` mitgeben.
 */
let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY fehlt — Bestellsystem nicht konfiguriert.',
    );
  }
  _client = new Stripe(key, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
    appInfo: { name: 'kanbanly', url: 'https://kanbanly.de' },
  });
  return _client;
}

export function stripeEnabled(): boolean {
  if (process.env.STRIPE_PLATFORM_DISABLED === 'true') return false;
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_CONNECT_CLIENT_ID);
}

export function getStripeConnectStartUrl(state: string, redirectUri: string): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) throw new Error('STRIPE_CONNECT_CLIENT_ID fehlt.');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    state,
    redirect_uri: redirectUri,
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeStripeCode(
  code: string,
): Promise<{ stripeAccountId: string }> {
  const stripe = getStripe();
  const res = await stripe.oauth.token({ grant_type: 'authorization_code', code });
  if (!res.stripe_user_id) throw new Error('Stripe lieferte keine Account-ID.');
  return { stripeAccountId: res.stripe_user_id };
}

export async function fetchAccountSummary(stripeAccountId: string): Promise<{
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const stripe = getStripe();
  const acc = await stripe.accounts.retrieve(stripeAccountId);
  return {
    chargesEnabled: Boolean(acc.charges_enabled),
    detailsSubmitted: Boolean(acc.details_submitted),
  };
}

export type CreatePaymentIntentArgs = {
  amountCents: number;
  currency: string;
  stripeAccountId: string;
  applicationFeeAmount?: number;
  customerEmail?: string;
  metadata?: Record<string, string>;
};

/**
 * Erstellt einen PaymentIntent im Namen des verbundenen Accounts (Direct Charge).
 * Geld geht direkt an den Server-Owner; optional Plattform-Fee an kanbanly.
 */
export async function createConnectPaymentIntent(
  args: CreatePaymentIntentArgs,
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe();
  return stripe.paymentIntents.create(
    {
      amount: args.amountCents,
      currency: args.currency,
      automatic_payment_methods: { enabled: true },
      ...(args.applicationFeeAmount && args.applicationFeeAmount > 0
        ? { application_fee_amount: args.applicationFeeAmount }
        : {}),
      ...(args.customerEmail ? { receipt_email: args.customerEmail } : {}),
      ...(args.metadata ? { metadata: args.metadata } : {}),
    },
    { stripeAccount: args.stripeAccountId },
  );
}

// ───── Subscription Checkout / Portal (Plattform-Account, kein Connect) ─────

export async function createSubscriptionCheckoutSession(args: {
  guildId: string;
  priceId: string;
  customerEmail?: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: args.priceId, quantity: 1 }],
    metadata: { guild_id: args.guildId },
    subscription_data: { metadata: { guild_id: args.guildId } },
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    ...(args.customerId ? { customer: args.customerId } : {}),
    ...(args.customerEmail && !args.customerId
      ? { customer_email: args.customerEmail }
      : {}),
    allow_promotion_codes: true,
    automatic_tax: { enabled: false },
  });
  if (!session.url) throw new Error('Stripe Checkout: keine URL.');
  return { url: session.url };
}

export async function createCustomerPortalSession(args: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: args.customerId,
    return_url: args.returnUrl,
  });
  return { url: session.url };
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET fehlt.');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
