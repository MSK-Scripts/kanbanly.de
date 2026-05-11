import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeCode, fetchCurrentUser, getOAuthRedirectUri } from '@/lib/discord';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = request.cookies.get('discord_oauth_state')?.value;
  const err = url.searchParams.get('error');

  if (err) {
    return NextResponse.redirect(
      new URL(`/integrations/discord?error=${encodeURIComponent(err)}`, request.url),
    );
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      new URL('/integrations/discord?error=invalid_state', request.url),
    );
  }

  try {
    const tokens = await exchangeCode(code, getOAuthRedirectUri(url.origin));
    const discordUser = await fetchCurrentUser(tokens.access_token);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const admin = createAdminClient();
    const { error } = await admin.from('bot_user_connections').upsert(
      {
        user_id: user.id,
        discord_user_id: discordUser.id,
        discord_username: discordUser.global_name ?? discordUser.username,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
  } catch (e) {
    console.error('[discord/callback] Fehler:', e);
    return NextResponse.redirect(
      new URL('/integrations/discord?error=oauth_failed', request.url),
    );
  }

  const res = NextResponse.redirect(new URL('/integrations/discord', request.url));
  res.cookies.delete('discord_oauth_state');
  return res;
}
