-- Block 15: Admin-Panel. Flag auf profiles, damit /admin nur für
-- berechtigte User lädt. Abfragen selbst laufen serverseitig mit
-- Service-Role, daher kein zusätzliches RLS nötig.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Felix ist Admin.
update public.profiles
set is_admin = true
where id in (
  select id from auth.users
  where lower(email) = lower('felixfranzen5@gmail.com')
);
