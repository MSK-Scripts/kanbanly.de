import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getStripeConnectStartUrl, stripeEnabled } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  const guildId = request.nextUrl.searchParams.get('guild_id');
  if (!guildId) {
    return NextResponse.json({ error: 'guild_id fehlt' }, { status: 400 });
  }
  if (!stripeEnabled()) {
    return NextResponse.json(
      { error: 'Stripe-Integration ist nicht aktiviert.' },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=/integrations/discord/${guildId}`, request.url),
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin;
  const redirectUri = `${origin}/api/stripe/callback`;
  const state = randomBytes(24).toString('hex');
  const url = getStripeConnectStartUrl(state, redirectUri);

  const res = NextResponse.redirect(url);
  res.cookies.set('stripe_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });
  res.cookies.set('stripe_oauth_guild', guildId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });
  return res;
}
