-- ============================================================================
-- Xfinder (arbetsnamn) – 0002: funktioner och triggers
-- ----------------------------------------------------------------------------
-- Här ligger affärslogiken som MÅSTE köras i databasen:
--   * nya konton får automatiskt en profil (rollen kan aldrig sättas av klienten)
--   * priset på en bokning räknas fram av databasen, inte av klienten
--   * kunder/kompanjörer kan inte ändra pengar, escrow-status eller rollen sin
--   * en kompanjör kan inte godkänna sig själv
--   * meddelanden blockeras automatiskt vid blockering
--   * AI-coachens dagliga gräns ökas atomiskt av servern
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Hjälpfunktioner. Alla är security definer så att de kan läsa tabellerna
-- internt utan att RLS skapar cirklar (en policy på profiles som läser
-- profiles hade annars blivit rekursiv).
-- ----------------------------------------------------------------------------

-- Är den inloggade användaren administratör?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and not p.is_blocked
  );
$$;

-- Körs anropet av servern (service role / direkt databasanslutning) snarare än
-- av en inloggad användare? Webhooks och cron ska kunna göra allt.
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  -- Viktigt: använd session_user (inte current_user) och JWT-claimet, eftersom
  -- current_user byts ut inuti en security definer-funktion.
  select coalesce(
           nullif(current_setting('request.jwt.claim.role', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           ''
         ) = 'service_role'
      or session_user in ('postgres', 'supabase_admin');
$$;

-- admin eller server
create or replace function public.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_service_role();
$$;

-- Finns det en blockering åt något håll mellan två användare?
create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b)
       or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

-- Är den inloggade användaren deltagare i konversationen?
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.customer_id = auth.uid() or c.companion_user_id = auth.uid())
  );
$$;

-- Har den inloggade användaren betalat uppstartsavgiften (19 kr)?
-- Tar ingen parameter: den kan bara svara om den som frågar själv.
create or replace function public.has_paid_registration()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.registration_paid_at is not null
  );
$$;

-- Är den inloggade användaren kompanjör med en godkänd annons?
create or replace function public.is_approved_companion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companion_listings l
    where l.user_id = auth.uid() and l.status = 'approved'
  );
$$;

-- ----------------------------------------------------------------------------
-- Pengar: engångsavgifter och prisberäkning
-- ----------------------------------------------------------------------------

-- 49 kr på användarens FÖRSTA bokning, därefter 0 kr.
create or replace function public.first_booking_fee(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.bookings b
      where b.customer_id = p_user
        and b.status not in ('cancelled', 'expired', 'refunded')
    ) then 0
    else 49
  end;
$$;

-- Intern hjälpare: får bara anropas inifrån databasen, inte via API:t.
revoke all on function public.first_booking_fee(uuid) from public, anon, authenticated;

-- Samma beräkning som bokningen använder, så att priset som visas i
-- bokningsflödet alltid är exakt det pris som Stripe får.
create or replace function public.quote_booking(p_listing_id uuid, p_duration_minutes integer)
returns table (
  listing_id            uuid,
  hourly_rate_sek       integer,
  duration_minutes      integer,
  companion_amount_sek  integer,
  service_fee_sek       integer,
  first_booking_fee_sek integer,
  total_sek             integer,
  currency              text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing public.companion_listings;
  v_amount  integer;
  v_fee     integer;
  v_first   integer;
begin
  if auth.uid() is null then
    raise exception 'Inloggning krävs' using errcode = '28000';
  end if;

  select * into v_listing
  from public.companion_listings l
  where l.id = p_listing_id and l.status = 'approved';

  if not found then
    raise exception 'Annonsen är inte tillgänglig' using errcode = 'P0002';
  end if;

  if p_duration_minutes is null
     or p_duration_minutes < v_listing.min_minutes
     or p_duration_minutes > 480 then
    raise exception 'Längden måste vara mellan % och 480 minuter', v_listing.min_minutes
      using errcode = '22023';
  end if;

  v_amount := round(v_listing.hourly_rate_sek * p_duration_minutes / 60.0)::integer;
  v_fee    := round(v_amount * 0.10)::integer;
  v_first  := public.first_booking_fee(auth.uid());

  return query
    select v_listing.id, v_listing.hourly_rate_sek, p_duration_minutes,
           v_amount, v_fee, v_first, v_amount + v_fee + v_first, 'SEK'::text;
end;
$$;

-- ----------------------------------------------------------------------------
-- AI-coachen: atomisk daglig räknare
-- ----------------------------------------------------------------------------
create or replace function public.consume_ai_message(
  p_session_id  uuid,
  p_daily_limit integer default 40
)
returns table (used integer, remaining integer, daily_limit integer, paused boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_used  integer;
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_exists boolean;
begin
  if v_uid is null then
    raise exception 'Inloggning krävs' using errcode = '28000';
  end if;

  select true into v_exists
  from public.ai_sessions s
  where s.id = p_session_id and s.user_id = v_uid;

  if not coalesce(v_exists, false) then
    raise exception 'Samtalet hittades inte' using errcode = 'P0002';
  end if;

  insert into public.ai_usage_daily as u (user_id, usage_date, message_count, last_message_at)
  values (v_uid, v_today, 1, now())
  on conflict (user_id, usage_date) do update
     set message_count = u.message_count + 1,
         last_message_at = now()
   where u.message_count < p_daily_limit
  returning u.message_count into v_used;

  update public.ai_sessions s
     set last_activity_at = now()
   where s.id = p_session_id;

  if v_used is null then
    select u.message_count into v_used
    from public.ai_usage_daily u
    where u.user_id = v_uid and u.usage_date = v_today;

    return query select coalesce(v_used, p_daily_limit), 0, p_daily_limit, true;
    return;
  end if;

  return query select v_used, greatest(p_daily_limit - v_used, 0), p_daily_limit, false;
end;
$$;

-- ----------------------------------------------------------------------------
-- Nya konton: skapa profil automatiskt.
-- Rollen sätts alltid till 'customer' – den får aldrig komma från metadata,
-- annars kunde någon registrera sig som admin.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Ny användare'
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(v_name, 60), new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'companion_listings', 'bookings', 'reviews', 'reports', 'payments']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Generellt skydd: listade kolumner får bara ändras av admin/servern.
-- Kolumnerna skickas in som trigger-argument.
-- ----------------------------------------------------------------------------
create or replace function public.protect_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col text;
begin
  if public.is_privileged() then
    return new;
  end if;

  foreach v_col in array tg_argv
  loop
    if (to_jsonb(new) -> v_col) is distinct from (to_jsonb(old) -> v_col) then
      raise exception 'Fältet "%" kan bara ändras av en administratör', v_col
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

-- Profil: roll, avstängning och betald uppstartsavgift är skyddade.
drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_columns(
    'role', 'is_blocked', 'blocked_reason', 'registration_paid_at', 'created_at'
  );

-- Meddelanden: brödtexten är oantastbar, bara läsmarkering får ändras.
drop trigger if exists messages_protect on public.messages;
create trigger messages_protect
  before update on public.messages
  for each row execute function public.protect_columns(
    'body', 'conversation_id', 'sender_id', 'created_at', 'flagged_at', 'flag_reason'
  );

-- Anmälningar: bara admin får ändra status och hantering.
drop trigger if exists reports_protect on public.reports;
create trigger reports_protect
  before update on public.reports
  for each row execute function public.protect_columns(
    'reporter_id', 'reported_user_id', 'category', 'details', 'created_at'
  );

-- AI-samtal: användaren får byta titel, inte skriva om sin egen statistik.
drop trigger if exists ai_sessions_protect on public.ai_sessions;
create trigger ai_sessions_protect
  before update on public.ai_sessions
  for each row execute function public.protect_columns(
    'user_id', 'exercise', 'persona', 'crisis_flagged', 'message_count',
    'started_at', 'reality_next_step'
  );

-- ----------------------------------------------------------------------------
-- Kompanjörens annons: ingen självgodkänning.
-- ----------------------------------------------------------------------------
create or replace function public.protect_listing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Annonsen kan inte flyttas till ett annat konto' using errcode = '42501';
  end if;

  if new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by
     or new.rejection_reason is distinct from old.rejection_reason
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or new.completed_bookings is distinct from old.completed_bookings then
    raise exception 'Verifiering och betyg sätts av Xfinder, inte av kompanjören'
      using errcode = '42501';
  end if;

  -- Kompanjören får skicka in annonsen för granskning och återta den till utkast.
  if new.status is distinct from old.status
     and not (old.status in ('draft', 'rejected') and new.status = 'pending_review')
     and not (old.status = 'pending_review' and new.status in ('draft', 'pending_review')) then
    raise exception 'Statusen kan bara ändras av en administratör' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_protect on public.companion_listings;
create trigger listings_protect
  before update on public.companion_listings
  for each row execute function public.protect_listing_columns();

-- ----------------------------------------------------------------------------
-- Bokning: priset räknas fram här, aldrig av klienten.
-- ----------------------------------------------------------------------------
create or replace function public.prepare_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.companion_listings;
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles p where p.id = new.customer_id;
  if not found then
    raise exception 'Kundprofilen hittades inte' using errcode = 'P0002';
  end if;
  if v_profile.is_blocked then
    raise exception 'Kontot är avstängt' using errcode = '42501';
  end if;
  if v_profile.registration_paid_at is null then
    raise exception 'Uppstartsavgiften (19 kr) måste vara betald innan du kan boka'
      using errcode = '42501';
  end if;

  select * into v_listing from public.companion_listings l where l.id = new.listing_id;
  if not found then
    raise exception 'Annonsen hittades inte' using errcode = 'P0002';
  end if;
  if v_listing.status <> 'approved' then
    raise exception 'Annonsen är inte godkänd än' using errcode = '42501';
  end if;
  if v_listing.user_id <> new.companion_user_id then
    raise exception 'Annonsen tillhör inte den kompanjören' using errcode = '22023';
  end if;
  if not (new.activity = any (v_listing.activities)) then
    raise exception 'Den aktiviteten erbjuds inte av den här kompanjören' using errcode = '22023';
  end if;
  if new.starts_at <= now() then
    raise exception 'Tiden måste ligga framåt i tiden' using errcode = '22023';
  end if;
  if new.duration_minutes < v_listing.min_minutes then
    raise exception 'Kortaste bokning hos den här kompanjören är % minuter', v_listing.min_minutes
      using errcode = '22023';
  end if;

  new.ends_at               := new.starts_at + (new.duration_minutes * interval '1 minute');
  new.hourly_rate_sek       := v_listing.hourly_rate_sek;
  new.city                  := coalesce(nullif(new.city, ''), v_listing.city);
  new.companion_amount_sek  := round(v_listing.hourly_rate_sek * new.duration_minutes / 60.0)::integer;
  new.service_fee_sek       := round(new.companion_amount_sek * 0.10)::integer;
  new.first_booking_fee_sek := public.first_booking_fee(new.customer_id);
  new.total_sek             := new.companion_amount_sek + new.service_fee_sek + new.first_booking_fee_sek;
  new.currency              := 'SEK';
  new.status                := 'pending';
  new.pending_expires_at    := now() + interval '15 minutes';
  new.funds_captured_at     := null;
  new.funds_released_at     := null;

  return new;
end;
$$;

drop trigger if exists bookings_prepare on public.bookings;
create trigger bookings_prepare
  before insert on public.bookings
  for each row execute function public.prepare_booking();

-- Efter insert: räkna bort den utgående betalningen från escrow om bokningen
-- avbryts. Skyddar också pengar och escrow mot klientändringar.
create or replace function public.protect_booking_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged() then
    return new;
  end if;

  if (to_jsonb(new) - array[
        'status', 'cancellation_reason', 'cancelled_by', 'cancelled_at',
        'notes_to_companion', 'meeting_point', 'updated_at'
      ])  -- ends_at, priser och escrow ligger utanför listan och är därmed skyddade
     is distinct from
     (to_jsonb(old) - array[
        'status', 'cancellation_reason', 'cancelled_by', 'cancelled_at',
        'notes_to_companion', 'meeting_point', 'updated_at'
      ])
  then
    raise exception 'Pris, betalning och escrow hanteras av Xfinder' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'Statusen kan bara ändras av Xfinder eller en administratör' using errcode = '42501';
  end if;

  if new.status = 'cancelled' then
    if new.cancellation_reason is null or char_length(new.cancellation_reason) < 3 then
      raise exception 'Ange varför bokningen avbokas' using errcode = '22023';
    end if;
    new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_protect on public.bookings;
create trigger bookings_protect
  before update on public.bookings
  for each row execute function public.protect_booking_changes();

-- ----------------------------------------------------------------------------
-- Chatt: deltagarkontroll, blockering och mjuk flaggning av kontaktuppgifter
-- ----------------------------------------------------------------------------
create or replace function public.assert_message_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv   public.conversations;
  v_sender public.profiles;
begin
  select * into v_conv from public.conversations c where c.id = new.conversation_id;
  if not found then
    raise exception 'Konversationen hittades inte' using errcode = 'P0002';
  end if;

  if new.sender_id not in (v_conv.customer_id, v_conv.companion_user_id) then
    raise exception 'Du är inte deltagare i den här konversationen' using errcode = '42501';
  end if;

  select * into v_sender from public.profiles p where p.id = new.sender_id;
  if v_sender.is_blocked then
    raise exception 'Kontot är avstängt' using errcode = '42501';
  end if;

  if public.blocked_between(v_conv.customer_id, v_conv.companion_user_id) then
    raise exception 'Det går inte att skicka meddelanden i den här konversationen'
      using errcode = '42501';
  end if;

  if v_sender.role = 'customer' and v_sender.registration_paid_at is null then
    raise exception 'Uppstartsavgiften (19 kr) måste vara betald innan du kan skriva'
      using errcode = '42501';
  end if;

  -- Mjuk flagga: vi stoppar inte samtalet, men admin får se att kontaktuppgifter
  -- delas (betalningar ska stanna på plattformen).
  if new.body ~* '\+?[0-9][0-9 ()\-]{5,}[0-9]'
     or new.body ~* '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}' then
    new.flagged_at  := coalesce(new.flagged_at, now());
    new.flag_reason := coalesce(new.flag_reason, 'kontaktuppgifter');
  end if;

  return new;
end;
$$;

drop trigger if exists messages_assert_allowed on public.messages;
create trigger messages_assert_allowed
  before insert on public.messages
  for each row execute function public.assert_message_allowed();

-- Uppdatera konversationens tidsstämpel så att inkorgen kan sorteras.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations c
     set last_message_at   = new.created_at,
         last_message_from = new.sender_id
   where c.id = new.conversation_id;
  return null;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ----------------------------------------------------------------------------
-- Betyg: håll annonsens snitt och antal uppdaterade
-- ----------------------------------------------------------------------------
create or replace function public.refresh_listing_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject uuid := coalesce(new.subject_id, old.subject_id);
begin
  update public.companion_listings l
     set rating_avg = coalesce((
           select round(avg(r.rating)::numeric, 2)
           from public.reviews r
           where r.subject_id = v_subject and r.is_public
         ), 0),
         rating_count = (
           select count(*) from public.reviews r
           where r.subject_id = v_subject and r.is_public
         )
   where l.user_id = v_subject;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_listing_rating();

-- ----------------------------------------------------------------------------
-- AI: räkna meddelanden per samtal
-- ----------------------------------------------------------------------------
create or replace function public.bump_session_message_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_sessions s
     set message_count    = s.message_count + 1,
         last_activity_at = now()
   where s.id = new.session_id;
  return null;
end;
$$;

drop trigger if exists ai_messages_bump_session on public.ai_messages;
create trigger ai_messages_bump_session
  after insert on public.ai_messages
  for each row execute function public.bump_session_message_count();
