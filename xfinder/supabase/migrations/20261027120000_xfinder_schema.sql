-- ============================================================================
-- Xfinder (arbetsnamn) – 0001: datamodell
-- ----------------------------------------------------------------------------
-- Platonsk sällskapsplattform: AI-social coach + marknadsplats för bokning av
-- en verifierad människa för PLATONISKT sällskap.
--
-- Penningregler som databasen själv upprätthåller:
--   * serviceavgift = 10 % av kompanjörens belopp för bokningen
--   * totalpris     = kompanjörens belopp + serviceavgift + engångsavgift
--   * uppstart      19 kr (engångs, spamfilter) och första bokningen 49 kr
-- Alla belopp lagras i HELA KRONOR (integer). Omräkning till öre (× 100) görs
-- först i Stripe-lagret så att databasen aldrig behöver hantera flyttal.
-- ============================================================================

create extension if not exists "pgcrypto";     -- gen_random_uuid()
create extension if not exists "btree_gist";   -- dubbelbokningsskydd

-- ----------------------------------------------------------------------------
-- Enums (guardade så att filen kan köras om utan att falla)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role' and typnamespace = 'public'::regnamespace) then
    create type public.user_role as enum ('customer', 'companion', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_status' and typnamespace = 'public'::regnamespace) then
    create type public.listing_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'booking_status' and typnamespace = 'public'::regnamespace) then
    create type public.booking_status as enum
      ('pending', 'confirmed', 'completed', 'reviewed', 'cancelled', 'refunded', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_kind' and typnamespace = 'public'::regnamespace) then
    create type public.payment_kind as enum ('registration', 'first_booking_fee', 'booking');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status' and typnamespace = 'public'::regnamespace) then
    create type public.payment_status as enum
      ('requires_payment', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_exercise' and typnamespace = 'public'::regnamespace) then
    create type public.ai_exercise as enum
      ('fritt', 'smalltalk', 'forsta_mote', 'jobb_fest', 'brollop', 'konflikt', 'granssattning');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_persona' and typnamespace = 'public'::regnamespace) then
    create type public.ai_persona as enum ('van', 'kollega', 'eventgast', 'coach');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_role' and typnamespace = 'public'::regnamespace) then
    create type public.message_role as enum ('user', 'assistant', 'system');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_category' and typnamespace = 'public'::regnamespace) then
    create type public.report_category as enum
      ('sexuell_tjanst', 'romantik_eller_intimitet', 'trakasserier', 'no_show', 'oroande_beteende',
       'falsk_profil', 'utanfor_plattformen', 'annat');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_status' and typnamespace = 'public'::regnamespace) then
    create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_role' and typnamespace = 'public'::regnamespace) then
    create type public.review_role as enum ('customer', 'companion');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- profiles – en rad per auth.users, roll styr behörighet
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  role                     public.user_role not null default 'customer',
  display_name             text not null default '',
  city                     text,
  languages                text[] not null default array['sv'],
  interests                text[] not null default '{}',
  desired_activities       text[] not null default '{}',
  -- 1 = vill helst bara skriva, 5 = redo för middag och evenemang
  comfort_level            smallint not null default 2 check (comfort_level between 1 and 5),
  bio                      text,
  avatar_url               text,
  is_blocked               boolean not null default false,
  blocked_reason           text,
  -- uppstartsavgiften 19 kr: null = inte betald
  registration_paid_at     timestamptz,
  onboarding_completed_at  timestamptz,
  last_seen_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint profiles_display_name_len check (char_length(display_name) <= 60),
  constraint profiles_bio_len          check (bio is null or char_length(bio) <= 1000)
);

comment on table public.profiles is
  'Publika profiler. Roll: customer (kund), companion (kompanjör), admin.';
comment on column public.profiles.comfort_level is
  '1–5, används för att matcha trygghetsnivå och för AI-coachens tonläge.';
comment on column public.profiles.registration_paid_at is
  'När uppstartsavgiften (19 kr) betalades. Krävs för att kontakta eller boka kompanjörer.';

create index if not exists profiles_city_idx on public.profiles (city);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_interests_idx on public.profiles using gin (interests);

-- ----------------------------------------------------------------------------
-- companion_listings – kompanjörens annons (en per kompanjör)
-- ----------------------------------------------------------------------------
create table if not exists public.companion_listings (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.profiles (id) on delete cascade,
  status                   public.listing_status not null default 'draft',
  headline                 text not null default '',
  bio                      text not null default '',
  photo_urls               text[] not null default '{}',
  video_intro_url          text,
  city                     text not null default '',
  languages                text[] not null default array['sv'],
  interests                text[] not null default '{}',
  -- aktivitets-slugs, t.ex. array['promenad','fika'] – valideras även i appen
  activities               text[] not null default '{}',
  hourly_rate_sek          integer not null default 300 check (hourly_rate_sek between 100 and 5000),
  min_minutes              smallint not null default 60 check (min_minutes between 30 and 240),
  -- [{ "weekday": 1, "from": "18:00", "to": "21:00" }, …]
  availability             jsonb not null default '[]'::jsonb,
  -- kompanjörens egna, uttalade gränser – obligatoriskt vid godkännande
  boundaries               text not null default '',
  accepts_public_meeting   boolean not null default true,
  verified_at              timestamptz,
  verified_by              uuid references public.profiles (id),
  rejection_reason         text,
  rating_avg               numeric(3, 2) not null default 0,
  rating_count             integer not null default 0,
  completed_bookings       integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- En annons får bara godkännas om den är komplett och tydlig.
  constraint listings_approvable check (
    status <> 'approved'
    or (char_length(bio) >= 80
        and cardinality(photo_urls) between 1 and 6
        and cardinality(activities) >= 1
        and char_length(boundaries) >= 20
        and char_length(city) >= 2)
  )
);

comment on table public.companion_listings is
  'Kompanjörens annons. Endast platoniska aktiviteter. Ingen sexuell tjänst får beskrivas.';
comment on column public.companion_listings.boundaries is
  'Kompanjörens uttalade gränser, t.ex. "Ingen fysisk kontakt utöver handskakning".';

create index if not exists listings_status_city_idx on public.companion_listings (status, city);
create index if not exists listings_activities_idx   on public.companion_listings using gin (activities);
create index if not exists listings_languages_idx    on public.companion_listings using gin (languages);
create index if not exists listings_rate_idx         on public.companion_listings (hourly_rate_sek);

-- ----------------------------------------------------------------------------
-- conversations + messages – intern chatt (även före bokning)
-- ----------------------------------------------------------------------------
create table if not exists public.conversations (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.profiles (id) on delete cascade,
  companion_user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id        uuid references public.companion_listings (id) on delete set null,
  last_message_at   timestamptz not null default now(),
  last_message_from uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  constraint conversations_not_self check (customer_id <> companion_user_id),
  constraint conversations_unique unique (customer_id, companion_user_id)
);

create index if not exists conversations_customer_idx
  on public.conversations (customer_id, last_message_at desc);
create index if not exists conversations_companion_idx
  on public.conversations (companion_user_id, last_message_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  read_at         timestamptz,
  -- sätts av moderering/modell om texten bryter mot platoniska regler
  flagged_at      timestamptz,
  flag_reason     text,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at desc);
create index if not exists messages_unread_idx
  on public.messages (conversation_id) where read_at is null;

-- ----------------------------------------------------------------------------
-- bookings – bokning med escrow-liknande betalningsflöde
-- ----------------------------------------------------------------------------
create table if not exists public.bookings (
  id                        uuid primary key default gen_random_uuid(),
  customer_id               uuid not null references public.profiles (id) on delete restrict,
  companion_user_id         uuid not null references public.profiles (id) on delete restrict,
  listing_id                uuid not null references public.companion_listings (id) on delete restrict,
  activity                  text not null,
  city                      text not null,
  -- alltid en offentlig mötesplats vid första träffen
  meeting_point             text,
  starts_at                 timestamptz not null,
  duration_minutes          integer not null check (duration_minutes between 30 and 480),
  -- sluttiden räknas fram av bookings_prepare. Den ligger som egen kolumn
  -- eftersom dubbelbokningsskyddet nedan måste bygga på ett IMMUTABLE uttryck
  -- (timestamptz + interval är bara STABLE och får inte stå i ett indexvillkor).
  ends_at                   timestamptz not null,
  -- prislåsning: priserna kopieras in vid bokningen och ändras aldrig av annonsen
  hourly_rate_sek           integer not null check (hourly_rate_sek between 100 and 5000),
  companion_amount_sek      integer not null check (companion_amount_sek >= 0),
  service_fee_sek           integer not null check (service_fee_sek >= 0),
  first_booking_fee_sek     integer not null default 0 check (first_booking_fee_sek in (0, 49)),
  total_sek                 integer not null check (total_sek > 0),
  currency                  text not null default 'SEK',
  status                    public.booking_status not null default 'pending',
  notes_to_companion        text,
  cancellation_reason       text,
  cancelled_by              uuid references public.profiles (id),
  cancelled_at              timestamptz,
  refund_amount_sek         integer not null default 0 check (refund_amount_sek >= 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,
  stripe_transfer_id         text,
  paid_at                   timestamptz,
  -- escrow: pengarna är fångade men inte släppta till kompanjören
  funds_captured_at         timestamptz,
  funds_released_at         timestamptz,
  completed_at              timestamptz,
  reviewed_at               timestamptz,
  pending_expires_at        timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint bookings_not_self      check (customer_id <> companion_user_id),
  constraint bookings_fee_is_ten_pct
    check (service_fee_sek = round(companion_amount_sek * 0.10)::integer),
  constraint bookings_total_is_sum
    check (total_sek = companion_amount_sek + service_fee_sek + first_booking_fee_sek),
  constraint bookings_cancel_has_reason
    check (status <> 'cancelled' or cancellation_reason is not null),
  constraint bookings_ends_after_start check (ends_at > starts_at)
);

comment on table public.bookings is
  'Bokning. status: pending -> confirmed -> completed -> reviewed. '
  'Betalningen fångas vid bokning och släpps till kompanjören först vid completed.';
comment on column public.bookings.service_fee_sek is
  'Serviceavgift = 10 % av kompanjörens belopp. Upprätthålls av check-villkoret bookings_fee_is_ten_pct.';

create index if not exists bookings_customer_idx  on public.bookings (customer_id, starts_at desc);
create index if not exists bookings_companion_idx on public.bookings (companion_user_id, starts_at desc);
create index if not exists bookings_status_idx    on public.bookings (status, starts_at);

-- Dubbelbokningsskydd: en kompanjör kan inte ha två aktiva bokningar samtidigt.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlap' and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (
        companion_user_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
      ) where (status in ('pending', 'confirmed'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- reviews – båda parter kan betygsätta efter avslutad bokning
-- ----------------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  subject_id  uuid not null references public.profiles (id) on delete cascade,
  author_role public.review_role not null,
  rating      smallint not null check (rating between 1 and 5),
  body        text not null default '' check (char_length(body) <= 2000),
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint reviews_not_self    check (author_id <> subject_id),
  constraint reviews_one_per_party unique (booking_id, author_id)
);

create index if not exists reviews_subject_idx on public.reviews (subject_id, created_at desc);
create index if not exists reviews_public_idx  on public.reviews (subject_id) where is_public;

-- ----------------------------------------------------------------------------
-- reports + blocks – anmälan och blockering
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id       uuid references public.bookings (id) on delete set null,
  conversation_id  uuid references public.conversations (id) on delete set null,
  category         public.report_category not null,
  details          text not null check (char_length(details) between 5 and 4000),
  status           public.report_status not null default 'open',
  handled_by       uuid references public.profiles (id),
  handled_at       timestamptz,
  resolution_note  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint reports_not_self check (reporter_id <> reported_user_id)
);

create index if not exists reports_status_idx   on public.reports (status, created_at desc);
create index if not exists reports_reported_idx on public.reports (reported_user_id);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- ----------------------------------------------------------------------------
-- AI-coachen: sessioner, meddelanden och daglig användning
-- ----------------------------------------------------------------------------
create table if not exists public.ai_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  exercise          public.ai_exercise not null default 'fritt',
  persona           public.ai_persona not null default 'coach',
  title             text not null default '',
  -- AI:ns föreslagna lilla verkliga nästa steg efter samtalet
  reality_next_step text,
  crisis_flagged    boolean not null default false,
  message_count     integer not null default 0,
  started_at        timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  ended_at          timestamptz
);

create index if not exists ai_sessions_user_idx on public.ai_sessions (user_id, started_at desc);

create table if not exists public.ai_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_sessions (id) on delete cascade,
  role       public.message_role not null,
  content    text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_session_idx on public.ai_messages (session_id, created_at);

create table if not exists public.ai_usage_daily (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  usage_date    date not null default ((now() at time zone 'Europe/Stockholm')::date),
  message_count integer not null default 0 check (message_count >= 0),
  last_message_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

comment on table public.ai_usage_daily is
  'Daglig räknare för AI-coachen. Skrivs bara av servern (service role) via '
  'rpc consume_ai_message, så att dagens gräns inte kan kringgås från klienten.';

-- ----------------------------------------------------------------------------
-- payments + stripe_events – betalningsliggare och webhook-idempotens
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles (id) on delete restrict,
  booking_id                uuid references public.bookings (id) on delete set null,
  kind                      public.payment_kind not null,
  amount_sek                integer not null check (amount_sek > 0),
  status                    public.payment_status not null default 'requires_payment',
  refunded_amount_sek       integer not null default 0 check (refunded_amount_sek >= 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,
  stripe_charge_id           text,
  failure_reason             text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
-- En bokning kan bara ha en bokningsbetalning.
create unique index if not exists payments_one_per_booking
  on public.payments (booking_id) where (kind = 'booking');
-- 19 kr och 49 kr är engångsavgifter per användare.
create unique index if not exists payments_once_per_user
  on public.payments (user_id, kind) where (kind in ('registration', 'first_booking_fee'));
create unique index if not exists payments_intent_idx
  on public.payments (stripe_payment_intent_id) where (stripe_payment_intent_id is not null);

create table if not exists public.stripe_events (
  id           text primary key,          -- Stripe event-id, t.ex. evt_1A2B3C
  type         text not null,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

comment on table public.stripe_events is
  'Idempotens för webhooks: samma Stripe-event-id kan bara behandlas en gång. '
  'Endast servern (service role) läser och skriver denna tabell.';

-- ----------------------------------------------------------------------------
-- updated_at sköts av en enda triggerfunktion (definieras i 0002)
-- ----------------------------------------------------------------------------
