-- ============================================================================
-- Xfinder (arbetsnamn) – 0003: Row Level Security
-- ----------------------------------------------------------------------------
-- Grundregler:
--   * anon        – får bara läsa godkända kompanjonsannonser (och profilen bakom)
--   * authenticated – ser och ändrar sina egna uppgifter, sin egen annons,
--                     sina egna bokningar, samtal och AI-samtal
--   * admin        – egen roll (profiles.role = 'admin') med full läs/skriv
--   * service role – servern (webhooks, AI-anrop, admin-actions) går förbi RLS
--
-- Skydd av enskilda kolumner (roll, pengar, escrow, betyg) ligger i triggers
-- i 0002, eftersom en trigger gäller oavsett vilken väg ändringen kommer in.
-- ============================================================================

alter table public.profiles           enable row level security;
alter table public.companion_listings enable row level security;
alter table public.conversations      enable row level security;
alter table public.messages           enable row level security;
alter table public.bookings           enable row level security;
alter table public.reviews            enable row level security;
alter table public.reports            enable row level security;
alter table public.blocks             enable row level security;
alter table public.ai_sessions        enable row level security;
alter table public.ai_messages        enable row level security;
alter table public.ai_usage_daily     enable row level security;
alter table public.payments           enable row level security;
alter table public.stripe_events      enable row level security;

-- Behörigheter på tabellnivå. RLS begränsar sedan vilka RADER som syns.
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- ============================================================================
-- profiles
-- ============================================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Godkända kompanjörers profiler är publika (namn, stad, intressen) – behövs för
-- marknadsplatsen och för delbara länkar.
drop policy if exists profiles_select_approved_companion on public.profiles;
create policy profiles_select_approved_companion on public.profiles
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.companion_listings l
      where l.user_id = profiles.id and l.status = 'approved'
    )
  );

-- Motpart i en bokning eller ett samtal behöver se namn och bild.
drop policy if exists profiles_select_counterpart on public.profiles;
create policy profiles_select_counterpart on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where (b.customer_id = auth.uid() and b.companion_user_id = profiles.id)
         or (b.companion_user_id = auth.uid() and b.customer_id = profiles.id)
    )
    or exists (
      select 1 from public.conversations c
      where (c.customer_id = auth.uid() and c.companion_user_id = profiles.id)
         or (c.companion_user_id = auth.uid() and c.customer_id = profiles.id)
    )
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- companion_listings
-- ============================================================================
drop policy if exists listings_select_approved on public.companion_listings;
create policy listings_select_approved on public.companion_listings
  for select to anon, authenticated
  using (status = 'approved');

drop policy if exists listings_select_own on public.companion_listings;
create policy listings_select_own on public.companion_listings
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists listings_insert_own on public.companion_listings;
create policy listings_insert_own on public.companion_listings
  for insert to authenticated
  with check (user_id = auth.uid() and status in ('draft', 'pending_review'));

drop policy if exists listings_update_own on public.companion_listings;
create policy listings_update_own on public.companion_listings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists listings_admin_all on public.companion_listings;
create policy listings_admin_all on public.companion_listings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- conversations + messages
-- ============================================================================
drop policy if exists conversations_select_participant on public.conversations;
create policy conversations_select_participant on public.conversations
  for select to authenticated
  using (customer_id = auth.uid() or companion_user_id = auth.uid() or public.is_admin());

drop policy if exists conversations_insert_participant on public.conversations;
create policy conversations_insert_participant on public.conversations
  for insert to authenticated
  with check (
    (
      customer_id = auth.uid()
      and public.has_paid_registration()
      and exists (
        select 1 from public.companion_listings l
        where l.user_id = conversations.companion_user_id and l.status = 'approved'
      )
    )
    or companion_user_id = auth.uid()
  );

drop policy if exists conversations_update_participant on public.conversations;
create policy conversations_update_participant on public.conversations
  for update to authenticated
  using (customer_id = auth.uid() or companion_user_id = auth.uid())
  with check (customer_id = auth.uid() or companion_user_id = auth.uid());

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

drop policy if exists messages_insert_participant on public.messages;
create policy messages_insert_participant on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));

-- Bara läskvittot får ändras (se trigger messages_protect). Meddelanden raderas
-- aldrig av användare – vid brott stänger admin av kontot i stället.
drop policy if exists messages_update_read on public.messages;
create policy messages_update_read on public.messages
  for update to authenticated
  using (public.is_conversation_participant(conversation_id))
  with check (public.is_conversation_participant(conversation_id));

drop policy if exists messages_admin_all on public.messages;
create policy messages_admin_all on public.messages
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- bookings
-- ============================================================================
drop policy if exists bookings_select_participant on public.bookings;
create policy bookings_select_participant on public.bookings
  for select to authenticated
  using (
    customer_id = auth.uid() or companion_user_id = auth.uid() or public.is_admin()
  );

drop policy if exists bookings_insert_customer on public.bookings;
create policy bookings_insert_customer on public.bookings
  for insert to authenticated
  with check (
    customer_id = auth.uid()
    and status = 'pending'
    and public.has_paid_registration()
  );

-- Avbokning görs av kund eller kompanjör. Allt annat (bekräfta, släppa escrow,
-- återbetala) sker server-side efter Stripe-webhooks.
drop policy if exists bookings_update_participant on public.bookings;
create policy bookings_update_participant on public.bookings
  for update to authenticated
  using (customer_id = auth.uid() or companion_user_id = auth.uid())
  with check (customer_id = auth.uid() or companion_user_id = auth.uid());

drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- reviews – bara efter en avslutad bokning, bara av deltagarna
-- ============================================================================
drop policy if exists reviews_select_visible on public.reviews;
create policy reviews_select_visible on public.reviews
  for select to anon, authenticated
  using (
    is_public
    or author_id = auth.uid()
    or subject_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists reviews_insert_after_completed on public.reviews;
create policy reviews_insert_after_completed on public.reviews
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = reviews.booking_id
        and b.status in ('completed', 'reviewed')
        and (
          (reviews.author_role = 'customer'
            and b.customer_id = reviews.author_id
            and b.companion_user_id = reviews.subject_id)
          or (reviews.author_role = 'companion'
            and b.companion_user_id = reviews.author_id
            and b.customer_id = reviews.subject_id)
        )
    )
  );

drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- reports – anmälaren ser sin anmälan, bara admin hanterar den
-- ============================================================================
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists reports_admin_all on public.reports;
create policy reports_admin_all on public.reports
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- blocks
-- ============================================================================
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = auth.uid() or public.is_admin());

drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks
  for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

-- ============================================================================
-- AI-coachen. Meddelanden och daglig räknare skrivs ENDAST av servern, så att
-- den dagliga gränsen inte kan kringgås från klienten.
-- ============================================================================
drop policy if exists ai_sessions_select_own on public.ai_sessions;
create policy ai_sessions_select_own on public.ai_sessions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists ai_sessions_insert_own on public.ai_sessions;
create policy ai_sessions_insert_own on public.ai_sessions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists ai_sessions_update_own on public.ai_sessions;
create policy ai_sessions_update_own on public.ai_sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists ai_sessions_delete_own on public.ai_sessions;
create policy ai_sessions_delete_own on public.ai_sessions
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists ai_messages_select_own on public.ai_messages;
create policy ai_messages_select_own on public.ai_messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.ai_sessions s
      where s.id = ai_messages.session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists ai_usage_select_own on public.ai_usage_daily;
create policy ai_usage_select_own on public.ai_usage_daily
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ============================================================================
-- payments + stripe_events – läses av användaren, skrivs bara av servern
-- ============================================================================
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- stripe_events har ingen policy alls: bara service role kommer åt den.

-- ============================================================================
-- RPC:er som klienten får anropa
-- ============================================================================
-- consume_ai_message och quote_booking är avsedda för klienten (inloggad) och
-- kontrollerar alltid auth.uid() internt. Anonyma anrop behövs inte.
revoke all on function public.consume_ai_message(uuid, integer) from anon;
revoke all on function public.quote_booking(uuid, integer) from anon;

-- OBS: is_admin, is_privileged, blocked_between, has_paid_registration och
-- is_conversation_participant används INUTI policyerna ovan och körs med den
-- anropande rollens rättigheter. Deras execute-rätt får därför inte dras in.
-- De är security definer och avslöjar bara fakta om den inloggade själv.
