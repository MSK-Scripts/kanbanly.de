import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Freemium-Modell: ~5 Entry-Module für immer kostenlos, Rest hinter Premium.
 * Trial: 14 Tage Premium pro Guild, 1x.
 */

export type PremiumModuleKey =
  | 'tickets'
  | 'helpdesk'
  | 'antiraid'
  | 'verify'
  | 'giveaways'
  | 'automod_advanced'
  | 'customcommands'
  | 'suggestions'
  | 'suggestion_panels'
  | 'birthday'
  | 'rolebadges'
  | 'afk'
  | 'invitetracker'
  | 'tempvoice'
  | 'dailyimage'
  | 'teamlist'
  | 'pricelist'
  | 'shop'
  | 'webhook_creator'
  | 'embed_creator_advanced'
  | 'sticky'
  | 'channelmodes'
  | 'booster'
  | 'ai';

/** Module die für IMMER kostenlos sind. Alles andere ist Premium. */
export const FREE_MODULES = new Set<string>([
  'welcome',
  'autoroles',
  'logging',
  'levels',
  'reactionroles',
  'embed', // basic embed creator
  'moderation', // /warn /kick /ban /clear / timeout — sind eh nur slash-commands
]);

/** Limits für Free-Tier. Premium = unbegrenzt. */
export const FREE_LIMITS = {
  levelRewards: 5,
  reactionRolePanels: 3,
  autoRoles: 5,
  stickyMessages: 1,
} as const;

export type SubscriptionStatus =
  | 'none'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export type SubscriptionPlan = 'monthly' | 'quarterly' | 'biannual';

export type GuildSubscription = {
  guildId: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  trialStartedAt: string | null;
  trialUsedAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
};

// In-Memory Cache (1 Minute) — reduziert DB-Hits drastisch da
// isGuildPremium() in fast jeder Server-Action aufgerufen wird.
const subCache = new Map<string, { value: GuildSubscription; expires: number }>();
const SUB_CACHE_MS = 60_000;

export function invalidatePremiumCache(guildId: string): void {
  subCache.delete(guildId);
}

export async function getGuildSubscription(guildId: string): Promise<GuildSubscription> {
  const cached = subCache.get(guildId);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.value;

  const admin = createAdminClient();
  const { data } = await admin
    .from('bot_subscriptions')
    .select(
      'guild_id, status, plan, trial_started_at, trial_used_at, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, stripe_price_id',
    )
    .eq('guild_id', guildId)
    .maybeSingle();

  const value: GuildSubscription = data
    ? {
        guildId: data.guild_id as string,
        status: ((data.status as SubscriptionStatus | null) ?? 'none'),
        plan: (data.plan as SubscriptionPlan | null) ?? null,
        trialStartedAt: (data.trial_started_at as string | null) ?? null,
        trialUsedAt: (data.trial_used_at as string | null) ?? null,
        currentPeriodEnd: (data.current_period_end as string | null) ?? null,
        cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
        stripeCustomerId: (data.stripe_customer_id as string | null) ?? null,
        stripeSubscriptionId: (data.stripe_subscription_id as string | null) ?? null,
        stripePriceId: (data.stripe_price_id as string | null) ?? null,
      }
    : {
        guildId,
        status: 'none',
        plan: null,
        trialStartedAt: null,
        trialUsedAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
      };
  // Eff-Status: Trial automatisch ablaufen.
  const effective = computeEffectiveStatus(value);
  if (effective !== value.status) value.status = effective;

  subCache.set(guildId, { value, expires: now + SUB_CACHE_MS });
  return value;
}

function computeEffectiveStatus(sub: GuildSubscription): SubscriptionStatus {
  if (sub.status === 'trial') {
    if (
      sub.currentPeriodEnd &&
      Date.parse(sub.currentPeriodEnd) < Date.now()
    ) {
      return 'expired';
    }
  }
  if (sub.status === 'active' || sub.status === 'past_due') {
    // Stripe sendet automatisch Updates; cancellled+period_end<=now → expired
    if (
      sub.cancelAtPeriodEnd &&
      sub.currentPeriodEnd &&
      Date.parse(sub.currentPeriodEnd) < Date.now()
    ) {
      return 'expired';
    }
  }
  return sub.status;
}

export function isPremium(sub: GuildSubscription): boolean {
  return sub.status === 'active' || sub.status === 'trial' || sub.status === 'past_due';
}

export async function isGuildPremium(guildId: string): Promise<boolean> {
  return isPremium(await getGuildSubscription(guildId));
}

export async function assertPremium(guildId: string): Promise<void> {
  if (!(await isGuildPremium(guildId))) {
    throw new Error('PREMIUM_REQUIRED');
  }
}

// ───── Stripe Price-IDs aus env ─────
export function getStripePriceId(plan: SubscriptionPlan): string | null {
  switch (plan) {
    case 'monthly':
      return process.env.STRIPE_PRICE_MONTHLY ?? null;
    case 'quarterly':
      return process.env.STRIPE_PRICE_QUARTERLY ?? null;
    case 'biannual':
      return process.env.STRIPE_PRICE_BIANNUAL ?? null;
  }
}

export const PLAN_DETAILS: Record<
  SubscriptionPlan,
  { label: string; months: number; pricePerMonth: string; total: string; savings: string | null }
> = {
  monthly: {
    label: '1 Monat',
    months: 1,
    pricePerMonth: '5,99 €',
    total: '5,99 €',
    savings: null,
  },
  quarterly: {
    label: '3 Monate',
    months: 3,
    pricePerMonth: '4,99 €',
    total: '14,97 €',
    savings: '17% günstiger',
  },
  biannual: {
    label: '6 Monate',
    months: 6,
    pricePerMonth: '3,99 €',
    total: '23,94 €',
    savings: '33% günstiger',
  },
};

export function planFromPriceId(priceId: string | null): SubscriptionPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly';
  if (priceId === process.env.STRIPE_PRICE_QUARTERLY) return 'quarterly';
  if (priceId === process.env.STRIPE_PRICE_BIANNUAL) return 'biannual';
  return null;
}
