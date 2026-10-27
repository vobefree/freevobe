#!/usr/bin/env node
/**
 * End-to-end-kontroll av databasen.
 *
 *   npm run verify:db
 *
 * Skriptet skapar två tillfälliga konton (en kompanjör och en kund), kör igenom
 * reglerna som måste hålla och städar bort sig självt efteråt. Det kräver
 * .env.local med URL, anon-nyckel och service role-nyckel.
 *
 * Allt som testas här är sådant som RLS, triggers och check-villkor ska
 * upprätthålla – inte sådant appen "kommer ihåg" att göra.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Saknar miljövariabler. Skapa .env.local med NEXT_PUBLIC_SUPABASE_URL, " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY och SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const stamp = Date.now();
const password = "Verifiera-1234!";
const companionEmail = `verify-kompanjon-${stamp}@example.com`;
const customerEmail = `verify-kund-${stamp}@example.com`;
const outsiderEmail = `verify-utomstaende-${stamp}@example.com`;

const state = { users: [], bookings: [], listings: [], sessions: [] };
let failures = 0;

function pass(name, detail = "") {
  console.log(`  ✔ ${name}${detail ? ` – ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failures += 1;
  console.error(`  ✘ ${name}${detail ? ` – ${detail}` : ""}`);
}

function check(name, condition, detail = "") {
  if (condition) pass(name, detail);
  else fail(name, detail);
  return Boolean(condition);
}

function section(title) {
  console.log(`\n${title}`);
}

async function call(path, { method = "GET", token = anonKey, body, headers = {} } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { status: response.status, ok: response.ok, data };
}

/** Felkod från Postgres/PostgREST, t.ex. 42501 eller 23P01. */
function errorCode(result) {
  return result.data?.code ?? "";
}

async function createUser(email) {
  const result = await call("/auth/v1/admin/users", {
    method: "POST",
    token: serviceKey,
    body: { email, password, email_confirm: true, user_metadata: { display_name: "Verifiering" } },
  });

  if (!result.ok) {
    throw new Error(`Kunde inte skapa testkonto: ${JSON.stringify(result.data)}`);
  }

  state.users.push(result.data.id);
  return result.data.id;
}

async function signIn(email) {
  const result = await call("/auth/v1/token?grant_type=password", {
    method: "POST",
    token: anonKey,
    body: { email, password },
  });

  if (!result.ok) {
    throw new Error(`Kunde inte logga in ${email}: ${JSON.stringify(result.data)}`);
  }

  return result.data.access_token;
}

const service = (path, options = {}) => call(path, { ...options, token: serviceKey });

const isoInDays = (days) => new Date(Date.now() + days * 86400000).toISOString();

export async function run() {
  console.log("Xfinder – databaskontroll\n==========================");
  console.log(`Projekt: ${url}`);

  try {
    const companionId = await createUser(companionEmail);
    const customerId = await createUser(customerEmail);
    const outsiderId = await createUser(outsiderEmail);

    // ---------------------------------------------------------------------
    section("1. Nytt konto får automatiskt en profil med rollen customer");

    const autoProfile = await service(`/rest/v1/profiles?id=eq.${companionId}&select=*`);
    check(
      "profil skapades av triggern på auth.users",
      autoProfile.ok && autoProfile.data?.length === 1,
      `status ${autoProfile.status}`,
    );
    check(
      "rollen är customer (metadata kan inte sätta admin)",
      autoProfile.data?.[0]?.role === "customer",
      autoProfile.data?.[0]?.role,
    );

    // ---------------------------------------------------------------------
    section("2. Anonyma besökare ser inga profiler");

    const anonProfiles = await call("/rest/v1/profiles?select=id");
    check(
      "anon får noll rader från profiles",
      anonProfiles.ok && Array.isArray(anonProfiles.data) && anonProfiles.data.length === 0,
      `${anonProfiles.data?.length ?? "?"} rader`,
    );

    // ---------------------------------------------------------------------
    section("3. Inloggad användare ser bara sig själv");

    const companionToken = await signIn(companionEmail);
    const ownProfiles = await call("/rest/v1/profiles?select=id", { token: companionToken });
    check(
      "endast den egna profilen returneras",
      ownProfiles.data?.length === 1 && ownProfiles.data[0].id === companionId,
      `${ownProfiles.data?.length ?? "?"} rad(er)`,
    );

    const otherProfile = await call(`/rest/v1/profiles?id=eq.${customerId}&select=id`, {
      token: companionToken,
    });
    check(
      "en annan användares profil är osynlig",
      otherProfile.data?.length === 0,
      `${otherProfile.data?.length ?? "?"} rad(er)`,
    );

    // ---------------------------------------------------------------------
    section("4. Skyddade kolumner kan inte ändras av användaren");

    const rename = await call(`/rest/v1/profiles?id=eq.${companionId}`, {
      method: "PATCH",
      token: companionToken,
      body: { display_name: "Testkompanjör" },
      headers: { Prefer: "return=representation" },
    });
    check(
      "eget visningsnamn går att ändra",
      rename.ok && rename.data?.[0]?.display_name === "Testkompanjör",
      `status ${rename.status}`,
    );

    const escalate = await call(`/rest/v1/profiles?id=eq.${companionId}`, {
      method: "PATCH",
      token: companionToken,
      body: { role: "admin" },
    });
    check(
      "rollen kan inte eskeleras till admin",
      !escalate.ok && errorCode(escalate) === "42501",
      errorCode(escalate) || `status ${escalate.status}`,
    );

    const selfPay = await call(`/rest/v1/profiles?id=eq.${companionId}`, {
      method: "PATCH",
      token: companionToken,
      body: { registration_paid_at: new Date().toISOString() },
    });
    check(
      "uppstartsavgiften kan inte markeras som betald av användaren",
      !selfPay.ok && errorCode(selfPay) === "42501",
      errorCode(selfPay) || `status ${selfPay.status}`,
    );

    // ---------------------------------------------------------------------
    section("5. Kompanjören kan inte godkänna sig själv");

    const listing = {
      user_id: companionId,
      headline: "Promenader och fika i Stockholm",
      bio:
        "Jag tycker om lugna promenader, kaffe och att prata om böcker. " +
        "Vi ses gärna på ett kafé på Södermalm eller i en park.",
      city: "Stockholm",
      photo_urls: [`${url}/storage/v1/object/public/companion-photos/${companionId}/test.jpg`],
      activities: ["fika", "promenad"],
      interests: ["bocker", "natur"],
      hourly_rate_sek: 300,
      min_minutes: 60,
      boundaries: "Ingen fysisk kontakt utöver en hälsning. Vi ses alltid offentligt.",
      status: "draft",
    };

    const draft = await call("/rest/v1/companion_listings", {
      method: "POST",
      token: companionToken,
      body: listing,
      headers: { Prefer: "return=representation" },
    });
    const listingId = draft.data?.[0]?.id;
    if (listingId) state.listings.push(listingId);
    check("kompanjören kan skapa ett utkast", draft.ok && Boolean(listingId), `status ${draft.status}`);

    const selfApprove = await call(`/rest/v1/companion_listings?id=eq.${listingId}`, {
      method: "PATCH",
      token: companionToken,
      body: { status: "approved" },
    });
    check(
      "kompanjören kan inte publicera sig själv",
      !selfApprove.ok && errorCode(selfApprove) === "42501",
      errorCode(selfApprove) || `status ${selfApprove.status}`,
    );

    const submit = await call(`/rest/v1/companion_listings?id=eq.${listingId}`, {
      method: "PATCH",
      token: companionToken,
      body: { status: "pending_review" },
    });
    check("kompanjören kan skicka in för granskning", submit.ok, `status ${submit.status}`);

    // Servern (service role) gör det admin/Stripe ska göra.
    await service(`/rest/v1/profiles?id=eq.${companionId}`, {
      method: "PATCH",
      body: { role: "companion", registration_paid_at: new Date().toISOString() },
    });
    await service(`/rest/v1/profiles?id=eq.${customerId}`, {
      method: "PATCH",
      body: { registration_paid_at: new Date().toISOString() },
    });

    const approve = await service(`/rest/v1/companion_listings?id=eq.${listingId}`, {
      method: "PATCH",
      body: { status: "approved", verified_at: new Date().toISOString() },
    });
    check("servern kan godkänna annonsen", approve.ok, `status ${approve.status}`);

    const incomplete = await service("/rest/v1/companion_listings", {
      method: "POST",
      body: { ...listing, user_id: outsiderId, status: "approved", bio: "För kort." },
    });
    check(
      "en ofullständig annons kan inte godkännas (krav på text, bild och gränser)",
      !incomplete.ok && errorCode(incomplete) === "23514",
      errorCode(incomplete) || `status ${incomplete.status}`,
    );

    // ---------------------------------------------------------------------
    section("6. Priset räknas fram av databasen");

    const customerToken = await signIn(customerEmail);

    const quote = await call("/rest/v1/rpc/quote_booking", {
      method: "POST",
      token: customerToken,
      body: { p_listing_id: listingId, p_duration_minutes: 90 },
    });
    const q = quote.data?.[0];
    check(
      "quote_booking: 300 kr/h i 90 min = 450 + 45 + 49 = 544 kr",
      q?.companion_amount_sek === 450 &&
        q?.service_fee_sek === 45 &&
        q?.first_booking_fee_sek === 49 &&
        q?.total_sek === 544,
      q ? JSON.stringify(q) : `status ${quote.status}`,
    );

    // ---------------------------------------------------------------------
    section("7. Bokning: pris, escrow och dubbelbokning");

    const booking = await call("/rest/v1/bookings", {
      method: "POST",
      token: customerToken,
      headers: { Prefer: "return=representation" },
      body: {
        customer_id: customerId,
        companion_user_id: companionId,
        listing_id: listingId,
        activity: "fika",
        city: "Stockholm",
        meeting_point: "Kaféet vid Medborgarplatsen",
        starts_at: isoInDays(3),
        duration_minutes: 90,
        // Klienten försöker sätta priset själv – det ska ignoreras.
        companion_amount_sek: 1,
        service_fee_sek: 0,
        total_sek: 1,
      },
    });

    const created = booking.data?.[0];
    if (created?.id) state.bookings.push(created.id);

    check("kunden kan skapa en bokning", booking.ok, `status ${booking.status}`);
    check(
      "klientens prisförsök skrivs över av databasen",
      created?.total_sek === 544 && created?.companion_amount_sek === 450,
      `total ${created?.total_sek} kr`,
    );
    check("bokningen får status pending", created?.status === "pending", created?.status);
    check(
      "escrow är inte släppt vid bokning",
      created?.funds_captured_at === null && created?.funds_released_at === null,
      "funds_released_at är tomt",
    );
    check(
      "sluttid och 15-minutersfönster sätts",
      Boolean(created?.ends_at) && Boolean(created?.pending_expires_at),
    );

    const overlap = await call("/rest/v1/bookings", {
      method: "POST",
      token: customerToken,
      body: {
        customer_id: customerId,
        companion_user_id: companionId,
        listing_id: listingId,
        activity: "promenad",
        city: "Stockholm",
        starts_at: isoInDays(3),
        duration_minutes: 60,
      },
    });
    check(
      "samma kompanjör kan inte dubbelbokas",
      !overlap.ok && errorCode(overlap) === "23P01",
      errorCode(overlap) || `status ${overlap.status}`,
    );

    const tamper = await call(`/rest/v1/bookings?id=eq.${created?.id}`, {
      method: "PATCH",
      token: customerToken,
      body: { total_sek: 1 },
    });
    check(
      "kunden kan inte ändra totalpriset i efterhand",
      !tamper.ok && errorCode(tamper) === "42501",
      errorCode(tamper) || `status ${tamper.status}`,
    );

    const forcedStatus = await call(`/rest/v1/bookings?id=eq.${created?.id}`, {
      method: "PATCH",
      token: customerToken,
      body: { status: "completed" },
    });
    check(
      "kunden kan inte markera bokningen som genomförd (då skulle escrow kunna släppas)",
      !forcedStatus.ok && errorCode(forcedStatus) === "42501",
      errorCode(forcedStatus) || `status ${forcedStatus.status}`,
    );

    const outsiderBookings = await call(`/rest/v1/bookings?select=id`, {
      token: await signIn(outsiderEmail),
    });
    check(
      "utomstående ser inte bokningen",
      outsiderBookings.data?.length === 0,
      `${outsiderBookings.data?.length ?? "?"} rad(er)`,
    );

    // ---------------------------------------------------------------------
    section("8. AI-coachens dagliga gräns");

    const session = await call("/rest/v1/ai_sessions", {
      method: "POST",
      token: customerToken,
      headers: { Prefer: "return=representation" },
      body: { user_id: customerId, exercise: "smalltalk", title: "Småprat" },
    });
    const sessionId = session.data?.[0]?.id;
    if (sessionId) state.sessions.push(sessionId);
    check("AI-samtal kan skapas", session.ok && Boolean(sessionId), `status ${session.status}`);

    const first = await call("/rest/v1/rpc/consume_ai_message", {
      method: "POST",
      token: customerToken,
      body: { p_session_id: sessionId, p_daily_limit: 2 },
    });
    const second = await call("/rest/v1/rpc/consume_ai_message", {
      method: "POST",
      token: customerToken,
      body: { p_session_id: sessionId, p_daily_limit: 2 },
    });
    const third = await call("/rest/v1/rpc/consume_ai_message", {
      method: "POST",
      token: customerToken,
      body: { p_session_id: sessionId, p_daily_limit: 2 },
    });

    check(
      "räknaren ökar och pausar vid gränsen",
      first.data?.[0]?.paused === false &&
        second.data?.[0]?.remaining === 0 &&
        third.data?.[0]?.paused === true,
      `1:${first.data?.[0]?.remaining} 2:${second.data?.[0]?.remaining} 3:${third.data?.[0]?.paused}`,
    );

    const clientWrite = await call("/rest/v1/ai_messages", {
      method: "POST",
      token: customerToken,
      body: { session_id: sessionId, role: "user", content: "Hej" },
    });
    check(
      "klienten kan inte skriva AI-meddelanden direkt (då kringgås gränsen)",
      !clientWrite.ok,
      errorCode(clientWrite) || `status ${clientWrite.status}`,
    );

    // Utan update-policy svarar PostgREST 204 men rör inga rader. Det som
    // avgör saken är om värdet står kvar, inte statuskoden.
    await call(`/rest/v1/ai_usage_daily?user_id=eq.${customerId}`, {
      method: "PATCH",
      token: customerToken,
      headers: { Prefer: "return=representation" },
      body: { message_count: 0 },
    });
    const counterAfter = await call(
      `/rest/v1/ai_usage_daily?user_id=eq.${customerId}&select=message_count`,
      { token: customerToken },
    );
    check(
      "klienten kan inte nollställa dagens räknare",
      counterAfter.data?.[0]?.message_count === 2,
      `message_count=${counterAfter.data?.[0]?.message_count ?? "?"}`,
    );
  } finally {
    // -----------------------------------------------------------------------
    section("Städning");
    for (const id of state.bookings) {
      await service(`/rest/v1/bookings?id=eq.${id}`, { method: "DELETE" });
    }
    for (const id of state.sessions) {
      await service(`/rest/v1/ai_sessions?id=eq.${id}`, { method: "DELETE" });
    }
    for (const id of state.listings) {
      await service(`/rest/v1/companion_listings?id=eq.${id}`, { method: "DELETE" });
    }
    for (const id of state.users) {
      await service(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
    }
    pass("testkonton, bokningar och annonser borttagna");
  }

  console.log(
    failures === 0
      ? "\nAlla kontroller gick igenom."
      : `\n${failures} kontroll(er) misslyckades.`,
  );

  return failures === 0;
}

const succeeded = await run();
process.exit(succeeded ? 0 : 1);
