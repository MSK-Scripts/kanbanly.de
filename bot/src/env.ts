import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  DISCORD_BOT_TOKEN: required('DISCORD_BOT_TOKEN'),
  DISCORD_CLIENT_ID: required('DISCORD_CLIENT_ID'),
  DISCORD_PUBLIC_KEY: required('DISCORD_PUBLIC_KEY'),
  // Supabase optional bis wir DB-gestützte Commands haben (Phase 2+).
  // db.ts wirft, wenn der Client ohne diese Werte verwendet wird.
  SUPABASE_URL: process.env.SUPABASE_URL || null,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
  DEV_GUILD_ID: process.env.DEV_GUILD_ID || null,
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};
