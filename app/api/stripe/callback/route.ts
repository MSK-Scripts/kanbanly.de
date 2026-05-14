import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  exchangeStripeCode,
  fetchAccountSummary,
  stripeEnabled,
} from '@/lib/stripe';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get('stripe_oauth_state')?.value;
  const guildId = request.cookies.get('stripe_oauth_guild')?.value;

  if (!code || !state || state !== cookieState || !guildId) {
    return NextResponse.redirect(
      new URL('/integrations/discord?stripe=invalid_state', request.url),
    );
  }
  if (!stripeEnabled()) {
    return NextResponse.redirect(
      new URL(`/integrations/discord/${guildId}?stripe=disabled`, request.url),
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

  try {
    const { stripeAccountId } = await exchangeStripeCode(code);
    const summary = await fetchAccountSummary(stripeAccountId);
    const admin = createAdminClient();
    const { error } = await admin
      .from('bot_guilds')
      .update({
        stripe_account_id: stripeAccountId,
        stripe_charges_enabled: summary.chargesEnabled,
        stripe_details_submitted: summary.detailsSubmitted,
        stripe_onboarded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId);
    if (error) throw error;

    const res = NextResponse.redirect(
      new URL(`/integrations/discord/${guildId}?stripe=connected#shop`, request.url),
    );
    res.cookies.delete('stripe_oauth_state');
    res.cookies.delete('stripe_oauth_guild');
    return res;
  } catch (err) {
    console.error('[stripe-callback]', err);
    return NextResponse.redirect(
      new URL(`/integrations/discord/${guildId}?stripe=error#shop`, request.url),
    );
  }
}
