-- Block 12b: email_mismatch beim Annehmen von Einladungen trotz gleicher
-- E-Mail. Grund: auth.users.email wird nicht garantiert lowercased oder
-- kann trailing whitespace haben. Wir trimmen + lowern jetzt beide Seiten.

create or replace function public.accept_invitation(t text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations%rowtype;
  u_email text;
  resulting_board uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select email into u_email from auth.users where id = auth.uid();

  select * into inv
  from invitations
  where token = t
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'invitation_invalid_or_expired';
  end if;

  if lower(btrim(coalesce(inv.email, ''))) <> lower(btrim(coalesce(u_email, ''))) then
    raise exception 'email_mismatch';
  end if;

  if inv.board_id is not null then
    insert into board_members (board_id, user_id, role)
    values (inv.board_id, auth.uid(), inv.role)
    on conflict (board_id, user_id) do update set role = excluded.role;
    resulting_board := inv.board_id;
  end if;

  update invitations set accepted_at = now() where id = inv.id;

  return resulting_board;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;
