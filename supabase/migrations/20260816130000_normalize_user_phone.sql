-- Normalize public.users.phone to the Korean domestic form (010…).
--
-- Firestore stores most numbers in E.164 ("+821012345678") and a few domestically
-- ("01012345678"), and the import copied them through verbatim: 87 of the 90 populated
-- rows were "+82…". Everything that looks a user up by phone uses the domestic form —
-- app/lib/otp/service.ts (`.eq("phone", local)`) and handle_new_user()'s phone match —
-- so those 87 people were invisible to a phone lookup: signing in by phone would not
-- find their profile and would create a second account.
--
-- Normalize once, then keep it that way with a trigger so no writer (app, edge function,
-- or a re-run of the migration loader at cutover) can put a "+82…" value back.

create or replace function public.normalize_kr_phone(p text)
 returns text
 language sql
 immutable
as $function$
  select case
    when p is null or btrim(p) = '' then null
    -- digits only, then international 82 prefix -> domestic 0
    else regexp_replace(regexp_replace(p, '\D', '', 'g'), '^82', '0')
  end;
$function$;

update public.users
   set phone = public.normalize_kr_phone(phone)
 where phone is not null
   and phone is distinct from public.normalize_kr_phone(phone);

create or replace function public.users_normalize_phone()
 returns trigger
 language plpgsql
as $function$
begin
  new.phone := public.normalize_kr_phone(new.phone);
  return new;
end $function$;

drop trigger if exists users_normalize_phone_trg on public.users;
create trigger users_normalize_phone_trg
  before insert or update of phone on public.users
  for each row execute function public.users_normalize_phone();
