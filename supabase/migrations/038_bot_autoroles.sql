-- Block 25: Bot — Auto-Roles.
-- Eine (oder mehrere) Rollen, die jedem neu beigetretenen Member
-- automatisch zugewiesen werden. Als jsonb-Array für Mehrfach-
-- Auto-Roles, ohne weitere Tabelle.

alter table public.bot_guilds
  add column if not exists auto_role_ids jsonb not null default '[]'::jsonb,
  add column if not exists auto_roles_enabled boolean not null default false;
