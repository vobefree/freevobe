import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { BUILTIN_ROLES } from "./admin/permissions";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  locale: string;
  created_at: string;
  trial_ends_at: string;
  plan_status: "trialing" | "active" | "canceled";
  plan_renews_at: string | null;
  shopify_shop: string | null;
  shopify_token: string | null;
  shopify_scope: string | null;
  shopify_connected_at: string | null;
  disabled: number;
  referral_code: string | null;
  referred_by: string | null;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  config: string;
  shopify_theme_id: string | null;
  last_published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  user_id: string;
  provider: string;
  amount_cents: number;
  currency: string;
  status: string;
  stripe_session_id: string | null;
  created_at: string;
};

const globalForDb = globalThis as unknown as { __templyDb?: DatabaseSync };

function connect(): DatabaseSync {
  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "temply.db"));
  // Flera bygg- och serverprocesser kan öppna samma fil: vänta på låset i stället för att krascha.
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'sv',
      created_at TEXT NOT NULL,
      trial_ends_at TEXT NOT NULL,
      plan_status TEXT NOT NULL DEFAULT 'trialing',
      plan_renews_at TEXT,
      shopify_shop TEXT,
      shopify_token TEXT,
      shopify_scope TEXT,
      shopify_connected_at TEXT,
      disabled INTEGER NOT NULL DEFAULT 0,
      referral_code TEXT,
      referred_by TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      mfa_at TEXT
    );

    CREATE TABLE IF NOT EXISTS mfa (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      secret TEXT NOT NULL,
      recovery TEXT NOT NULL DEFAULT '[]',
      confirmed_at TEXT,
      last_step INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      shopify_theme_id TEXT,
      last_published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      stripe_session_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'sv',
      handled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'starter',
      brand_name TEXT NOT NULL DEFAULT '',
      brand_color TEXT NOT NULL DEFAULT '#143328',
      white_label INTEGER NOT NULL DEFAULT 0,
      ai_copy_used INTEGER NOT NULL DEFAULT 0,
      ai_images_used INTEGER NOT NULL DEFAULT 0,
      ai_period TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(owner_id)
    );

    CREATE TABLE IF NOT EXISTS agency_members (
      id TEXT PRIMARY KEY,
      agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'designer',
      status TEXT NOT NULL DEFAULT 'invited',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agency_clients (
      id TEXT PRIMARY KEY,
      agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      shop_domain TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agency_projects (
      id TEXT PRIMARY KEY,
      agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      client_id TEXT REFERENCES agency_clients(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agency_library (
      id TEXT PRIMARY KEY,
      agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agency_reviews (
      id TEXT PRIMARY KEY,
      agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agency_comments (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL REFERENCES agency_reviews(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS theme_health (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      report TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stats_snapshots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      shop TEXT,
      source TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_insights (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invitee_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      bonus_days INTEGER NOT NULL DEFAULT 0,
      reward_days INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      rewarded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'support',
      status TEXT NOT NULL DEFAULT 'invited',
      token TEXT,
      user_id TEXT,
      invited_by TEXT,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS staff_roles (
      slug TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      permissions TEXT NOT NULL DEFAULT '[]',
      system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_overrides (
      locale TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (locale, key)
    );

    CREATE TABLE IF NOT EXISTS image_generations (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, month)
    );

    CREATE TABLE IF NOT EXISTS admin_audit (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      meta TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
    CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_id, status);
    CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_health_project ON theme_health(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_stats_project ON stats_snapshots(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_insights_project ON ai_insights(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agency_projects ON agency_projects(agency_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agency_library ON agency_library(agency_id, kind);
    CREATE INDEX IF NOT EXISTS idx_agency_reviews ON agency_reviews(agency_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_versions_project ON project_versions(project_id, created_at DESC);
  `);

  // Lättviktsmigrering: äldre databaser saknar kolumnerna.
  try {
    db.exec("ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0");
  } catch {
    /* kolumnen finns redan */
  }
  try {
    db.exec("ALTER TABLE contact_messages ADD COLUMN handled INTEGER NOT NULL DEFAULT 0");
  } catch {
    /* kolumnen finns redan */
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT");
  } catch {
    /* kolumnen finns redan */
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN referred_by TEXT");
  } catch {
    /* kolumnen finns redan */
  }
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN mfa_at TEXT");
  } catch {
    /* kolumnen finns redan */
  }
  // Indexet skapas efter migreringen ovan: äldre databaser saknade kolumnen.
  db.exec("CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);");

  // Inbyggda roller seedas en gång. Rollerna kan sedan redigeras i panelen.
  const seedRole = db.prepare(
    "INSERT OR IGNORE INTO staff_roles (slug, label, description, permissions, system, created_at) VALUES (?, ?, ?, ?, 1, ?)",
  );
  for (const role of BUILTIN_ROLES) {
    seedRole.run(role.slug, role.label, role.description, JSON.stringify(role.permissions), new Date().toISOString());
  }

  // Nya behörigheter (t.ex. innehållseditorn) läggs till i inbyggda roller som
  // redan finns. Ingen behörighet tas bort här – det görs i panelen.
  const readRole = db.prepare("SELECT permissions FROM staff_roles WHERE slug = ?");
  const updateRole = db.prepare("UPDATE staff_roles SET permissions = ? WHERE slug = ?");
  for (const role of BUILTIN_ROLES) {
    const row = readRole.get(role.slug) as unknown as { permissions: string } | undefined;
    if (!row) continue;
    let current: string[] = [];
    try {
      const parsed: unknown = JSON.parse(row.permissions);
      if (Array.isArray(parsed)) current = parsed.filter((item): item is string => typeof item === "string");
    } catch {
      current = [];
    }
    const merged = [...new Set([...current, ...role.permissions])];
    if (merged.length !== current.length) updateRole.run(JSON.stringify(merged), role.slug);
  }

  return db;
}

export type ContactRow = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: string;
  handled: number;
  created_at: string;
};

export function saveContactMessage(input: Omit<ContactRow, "id" | "created_at" | "handled">): ContactRow {
  const row: ContactRow = { ...input, id: crypto.randomUUID(), handled: 0, created_at: now() };
  db()
    .prepare("INSERT INTO contact_messages (id, name, email, subject, message, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(row.id, row.name, row.email, row.subject, row.message, row.locale, row.created_at);
  return row;
}

export function db(): DatabaseSync {
  if (!globalForDb.__templyDb) globalForDb.__templyDb = connect();
  return globalForDb.__templyDb;
}

const now = () => new Date().toISOString();
export const TRIAL_DAYS = 3;
export const SUBSCRIPTION_DAYS = 30;

/** Kort, läsbar värvningskod. Tvetydiga tecken (0/O, 1/I/L) är borttagna. */
export function generateReferralCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  locale: string;
  trialDays?: number;
  referralCode?: string | null;
}): UserRow {
  const id = crypto.randomUUID();
  const days = Math.max(1, Math.min(90, Math.round(input.trialDays ?? TRIAL_DAYS)));
  const trialEnds = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  db()
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, locale, created_at, trial_ends_at, plan_status, referral_code, referred_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'trialing', ?, ?)`,
    )
    .run(
      id,
      input.email.toLowerCase(),
      input.name,
      input.passwordHash,
      input.locale,
      now(),
      trialEnds,
      generateReferralCode(),
      input.referralCode ?? null,
    );
  return db().prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as UserRow;
}

export function findUserByEmail(email: string): UserRow | null {
  const row = db().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  return (row as unknown as UserRow) ?? null;
}

export function findUserByShopifyShop(shop: string): UserRow | null {
  const row = db().prepare("SELECT * FROM users WHERE shopify_shop = ? ORDER BY shopify_connected_at DESC LIMIT 1").get(shop);
  return (row as unknown as UserRow) ?? null;
}

export function findUserById(id: string): UserRow | null {
  const row = db().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return (row as unknown as UserRow) ?? null;
}

export function findUserByReferralCode(code: string): UserRow | null {
  const row = db().prepare("SELECT * FROM users WHERE referral_code = ?").get(code.trim().toUpperCase());
  return (row as unknown as UserRow) ?? null;
}
export function setUserReferral(userId: string, patch: { referralCode?: string; referredBy?: string | null }): void {
  if (patch.referralCode !== undefined) db().prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(patch.referralCode, userId);
  if (patch.referredBy !== undefined) db().prepare("UPDATE users SET referred_by = ? WHERE id = ?").run(patch.referredBy, userId);
}

/** Förlänger prenumerationen (eller provperioden) med ett antal dagar. */
export function addPlanDays(userId: string, days: number): { until: string; kind: "subscription" | "trial" } | null {
  const user = findUserById(userId);
  if (!user) return null;
  const span = Math.max(1, Math.round(days)) * 86_400_000;
  if (user.plan_status === "active") {
    const base = Math.max(Date.now(), user.plan_renews_at ? new Date(user.plan_renews_at).getTime() : 0);
    const until = new Date(base + span).toISOString();
    db().prepare("UPDATE users SET plan_renews_at = ? WHERE id = ?").run(until, userId);
    return { until, kind: "subscription" };
  }
  const base = Math.max(Date.now(), new Date(user.trial_ends_at).getTime());
  const until = new Date(base + span).toISOString();
  db().prepare("UPDATE users SET trial_ends_at = ? WHERE id = ?").run(until, userId);
  return { until, kind: "trial" };
}

export function updateUser(id: string, patch: Partial<Omit<UserRow, "id" | "password_hash">>): void {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sql = `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
  db()
    .prepare(sql)
    .run(...keys.map((k) => (patch[k] === undefined ? null : (patch[k] as string))), id);
}

export function createSession(userId: string): { id: string; expiresAt: string } {
  const id = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db().prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(id, userId, expiresAt);
  return { id, expiresAt };
}

export type SessionRow = { id: string; user_id: string; expires_at: string; mfa_at: string | null };

export function sessionById(sessionId: string): SessionRow | null {
  const row = db().prepare("SELECT id, user_id, expires_at, mfa_at FROM sessions WHERE id = ?").get(sessionId) as unknown as SessionRow | undefined;
  return row ?? null;
}

/** Markerar sessionen som tvåfaktorsverifierad (krävs för adminpanelen). */
export function markSessionVerified(sessionId: string): void {
  db().prepare("UPDATE sessions SET mfa_at = ? WHERE id = ?").run(new Date().toISOString(), sessionId);
}

/** Tar bort verifieringen så att nästa adminbesök kräver en ny kod. */
export function clearSessionVerification(sessionId: string): void {
  db().prepare("UPDATE sessions SET mfa_at = NULL WHERE id = ?").run(sessionId);
}

export function userForSession(sessionId: string): UserRow | null {
  const session = db().prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?").get(sessionId) as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }
  return findUserById(session.user_id);
}

export function deleteSession(sessionId: string): void {
  db().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function listProjects(userId: string): ProjectRow[] {
  return db().prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as unknown as ProjectRow[];
}

export function getProject(userId: string, id: string): ProjectRow | null {
  const row = db().prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(id, userId);
  return (row as unknown as ProjectRow) ?? null;
}

export function createProject(userId: string, name: string, config: string): ProjectRow {
  const id = crypto.randomUUID();
  const ts = now();
  db()
    .prepare("INSERT INTO projects (id, user_id, name, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, userId, name, config, ts, ts);
  return getProject(userId, id) as ProjectRow;
}

export function updateProject(userId: string, id: string, patch: { name?: string; config?: string; shopifyThemeId?: string; published?: boolean }): ProjectRow | null {
  const project = getProject(userId, id);
  if (!project) return null;
  const ts = now();
  db()
    .prepare(
      `UPDATE projects SET name = ?, config = ?, shopify_theme_id = ?, last_published_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    )
    .run(
      patch.name ?? project.name,
      patch.config ?? project.config,
      patch.shopifyThemeId ?? project.shopify_theme_id,
      patch.published ? ts : project.last_published_at,
      ts,
      id,
      userId,
    );
  return getProject(userId, id);
}

export function deleteProject(userId: string, id: string): void {
  db().prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(id, userId);
}

export type VersionRow = {
  id: string;
  project_id: string;
  label: string;
  config: string;
  created_at: string;
};

export const MAX_VERSIONS = 30;

/** Sparar en ögonblicksbild av temat så att användaren alltid kan gå tillbaka. */
export function createVersion(userId: string, projectId: string, label: string, config: string): VersionRow | null {
  const project = getProject(userId, projectId);
  if (!project) return null;
  const last = db()
    .prepare("SELECT config FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(projectId) as { config: string } | undefined;
  if (last?.config === config) {
    return db().prepare("SELECT * FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get(projectId) as unknown as VersionRow;
  }
  const id = crypto.randomUUID();
  db()
    .prepare("INSERT INTO project_versions (id, project_id, user_id, label, config, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, projectId, userId, label.slice(0, 80) || "Version", config, now());
  db()
    .prepare(
      `DELETE FROM project_versions WHERE project_id = ? AND id NOT IN (
        SELECT id FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?
      )`,
    )
    .run(projectId, projectId, MAX_VERSIONS);
  return db().prepare("SELECT * FROM project_versions WHERE id = ?").get(id) as unknown as VersionRow;
}

export function listVersions(userId: string, projectId: string, limit = MAX_VERSIONS): VersionRow[] {
  if (!getProject(userId, projectId)) return [];
  return db()
    .prepare("SELECT id, project_id, label, config, created_at FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(projectId, limit) as unknown as VersionRow[];
}

export function getVersion(userId: string, projectId: string, versionId: string): VersionRow | null {
  if (!getProject(userId, projectId)) return null;
  const row = db().prepare("SELECT * FROM project_versions WHERE id = ? AND project_id = ?").get(versionId, projectId);
  return (row as unknown as VersionRow) ?? null;
}

export function recordPayment(input: {
  userId: string;
  provider: string;
  amountCents: number;
  currency: string;
  status: string;
  stripeSessionId?: string;
}): void {
  db()
    .prepare(
      "INSERT INTO payments (id, user_id, provider, amount_cents, currency, status, stripe_session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(crypto.randomUUID(), input.userId, input.provider, input.amountCents, input.currency, input.status, input.stripeSessionId ?? null, now());
}

/**
 * Sant när en betald rad redan finns för Stripe-sessionen. Returflödet, webhooken
 * och Stripes egna omförsök kan annars bokföra samma betalning flera gånger.
 */
export function hasPaidPaymentForSession(stripeSessionId: string): boolean {
  const row = db()
    .prepare("SELECT 1 AS found FROM payments WHERE stripe_session_id = ? AND status = 'paid' LIMIT 1")
    .get(stripeSessionId) as unknown as { found: number } | undefined;
  return Boolean(row);
}

export function activateSubscription(userId: string, days = SUBSCRIPTION_DAYS): void {
  const renews = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  db().prepare("UPDATE users SET plan_status = 'active', plan_renews_at = ? WHERE id = ?").run(renews, userId);
}

export type Access = { status: "active" | "trial" | "expired"; daysLeft: number; trialEndsAt: string };

export function accessFor(user: UserRow): Access {
  const trialEnds = new Date(user.trial_ends_at).getTime();
  const remainingMs = trialEnds - Date.now();
  if (user.plan_status === "active") {
    return { status: "active", daysLeft: Math.max(0, Math.ceil(((user.plan_renews_at ? new Date(user.plan_renews_at).getTime() : 0) - Date.now()) / 86400000)), trialEndsAt: user.trial_ends_at };
  }
  if (remainingMs > 0) {
    return { status: "trial", daysLeft: Math.ceil(remainingMs / 86400000), trialEndsAt: user.trial_ends_at };
  }
  return { status: "expired", daysLeft: 0, trialEndsAt: user.trial_ends_at };
}

export function canBuild(user: UserRow): boolean {
  return accessFor(user).status !== "expired";
}

/**
 * Vattenmärket följer med teman som laddas ner under provperioden. Betalande
 * konton får rena teman; utgångna konton kan inte bygga alls.
 */
export function watermarkRequired(user: UserRow): boolean {
  return accessFor(user).status === "trial";
}

/* ---------- Byrå / Partner ---------- */

export type AgencyPlanId = "starter" | "pro" | "unlimited";
export type AgencyRole = "owner" | "admin" | "designer" | "reviewer";

export type AgencyRow = {
  id: string;
  owner_id: string;
  name: string;
  plan: AgencyPlanId;
  brand_name: string;
  brand_color: string;
  white_label: number;
  ai_copy_used: number;
  ai_images_used: number;
  ai_period: string;
  created_at: string;
};

export type AgencyMemberRow = {
  id: string;
  agency_id: string;
  email: string;
  name: string;
  role: AgencyRole;
  status: "invited" | "active";
  created_at: string;
};

export type AgencyClientRow = {
  id: string;
  agency_id: string;
  name: string;
  shop_domain: string;
  contact_email: string;
  created_at: string;
};

export type AgencyProjectRow = {
  id: string;
  agency_id: string;
  project_id: string;
  client_id: string | null;
  status: "draft" | "review" | "approved" | "delivered";
  created_at: string;
  updated_at: string;
};

export type AgencyLibraryKind = "theme" | "section" | "brand" | "tokens" | "conversion";

export type AgencyLibraryRow = {
  id: string;
  agency_id: string;
  kind: AgencyLibraryKind;
  name: string;
  payload: string;
  created_at: string;
};

export type AgencyReviewRow = {
  id: string;
  agency_id: string;
  project_id: string;
  token: string;
  client_name: string;
  status: "pending" | "approved" | "changes";
  created_at: string;
  updated_at: string;
};

export type AgencyCommentRow = {
  id: string;
  review_id: string;
  author: string;
  body: string;
  created_at: string;
};

const period = () => new Date().toISOString().slice(0, 7);

export function getAgencyByOwner(ownerId: string): AgencyRow | null {
  const row = db().prepare("SELECT * FROM agencies WHERE owner_id = ?").get(ownerId);
  return (row as unknown as AgencyRow) ?? null;
}

export function createAgency(ownerId: string, name: string): AgencyRow {
  const id = crypto.randomUUID();
  db()
    .prepare(
      "INSERT INTO agencies (id, owner_id, name, plan, brand_name, brand_color, white_label, ai_copy_used, ai_images_used, ai_period, created_at) VALUES (?, ?, ?, 'starter', ?, '#143328', 0, 0, 0, ?, ?)",
    )
    .run(id, ownerId, name, name, period(), now());
  return db().prepare("SELECT * FROM agencies WHERE id = ?").get(id) as unknown as AgencyRow;
}

export function updateAgency(id: string, patch: Partial<Pick<AgencyRow, "name" | "plan" | "brand_name" | "brand_color" | "white_label">>): AgencyRow {
  const current = db().prepare("SELECT * FROM agencies WHERE id = ?").get(id) as unknown as AgencyRow;
  const next = { ...current, ...patch };
  db()
    .prepare("UPDATE agencies SET name = ?, plan = ?, brand_name = ?, brand_color = ?, white_label = ? WHERE id = ?")
    .run(next.name, next.plan, next.brand_name, next.brand_color, next.white_label, id);
  return db().prepare("SELECT * FROM agencies WHERE id = ?").get(id) as unknown as AgencyRow;
}

export function listMembers(agencyId: string): AgencyMemberRow[] {
  return db().prepare("SELECT * FROM agency_members WHERE agency_id = ? ORDER BY created_at ASC").all(agencyId) as unknown as AgencyMemberRow[];
}

export function addMember(agencyId: string, input: { email: string; name: string; role: AgencyRole }): AgencyMemberRow {
  const id = crypto.randomUUID();
  db()
    .prepare("INSERT INTO agency_members (id, agency_id, email, name, role, status, created_at) VALUES (?, ?, ?, ?, ?, 'invited', ?)")
    .run(id, agencyId, input.email.toLowerCase(), input.name, input.role, now());
  return db().prepare("SELECT * FROM agency_members WHERE id = ?").get(id) as unknown as AgencyMemberRow;
}

export function updateMemberRole(agencyId: string, id: string, role: AgencyRole): void {
  db().prepare("UPDATE agency_members SET role = ? WHERE id = ? AND agency_id = ?").run(role, id, agencyId);
}

export function removeMember(agencyId: string, id: string): void {
  db().prepare("DELETE FROM agency_members WHERE id = ? AND agency_id = ?").run(id, agencyId);
}

export function listClients(agencyId: string): AgencyClientRow[] {
  return db().prepare("SELECT * FROM agency_clients WHERE agency_id = ? ORDER BY name ASC").all(agencyId) as unknown as AgencyClientRow[];
}

export function upsertClient(agencyId: string, input: { name: string; shopDomain?: string; contactEmail?: string }): AgencyClientRow {
  const existing = db()
    .prepare("SELECT * FROM agency_clients WHERE agency_id = ? AND lower(name) = lower(?)")
    .get(agencyId, input.name) as unknown as AgencyClientRow | undefined;
  if (existing) {
    db()
      .prepare("UPDATE agency_clients SET shop_domain = ?, contact_email = ? WHERE id = ?")
      .run(input.shopDomain ?? existing.shop_domain, input.contactEmail ?? existing.contact_email, existing.id);
    return db().prepare("SELECT * FROM agency_clients WHERE id = ?").get(existing.id) as unknown as AgencyClientRow;
  }
  const id = crypto.randomUUID();
  db()
    .prepare("INSERT INTO agency_clients (id, agency_id, name, shop_domain, contact_email, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, agencyId, input.name, input.shopDomain ?? "", input.contactEmail ?? "", now());
  return db().prepare("SELECT * FROM agency_clients WHERE id = ?").get(id) as unknown as AgencyClientRow;
}

export function listAgencyProjects(agencyId: string): AgencyProjectRow[] {
  return db().prepare("SELECT * FROM agency_projects WHERE agency_id = ? ORDER BY updated_at DESC").all(agencyId) as unknown as AgencyProjectRow[];
}

export function getAgencyProject(agencyId: string, projectId: string): AgencyProjectRow | null {
  const row = db().prepare("SELECT * FROM agency_projects WHERE agency_id = ? AND project_id = ?").get(agencyId, projectId);
  return (row as unknown as AgencyProjectRow) ?? null;
}

export function addAgencyProject(agencyId: string, projectId: string, clientId: string | null): AgencyProjectRow {
  const id = crypto.randomUUID();
  const ts = now();
  db()
    .prepare("INSERT INTO agency_projects (id, agency_id, project_id, client_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)")
    .run(id, agencyId, projectId, clientId, ts, ts);
  return getAgencyProject(agencyId, projectId) as AgencyProjectRow;
}

export function setAgencyProjectStatus(agencyId: string, projectId: string, status: AgencyProjectRow["status"]): void {
  db().prepare("UPDATE agency_projects SET status = ?, updated_at = ? WHERE agency_id = ? AND project_id = ?").run(status, now(), agencyId, projectId);
}

export function removeAgencyProject(agencyId: string, projectId: string): void {
  db().prepare("DELETE FROM agency_projects WHERE agency_id = ? AND project_id = ?").run(agencyId, projectId);
}

export function listLibrary(agencyId: string): AgencyLibraryRow[] {
  return db().prepare("SELECT * FROM agency_library WHERE agency_id = ? ORDER BY created_at DESC").all(agencyId) as unknown as AgencyLibraryRow[];
}

export function getLibraryItem(agencyId: string, id: string): AgencyLibraryRow | null {
  const row = db().prepare("SELECT * FROM agency_library WHERE agency_id = ? AND id = ?").get(agencyId, id);
  return (row as unknown as AgencyLibraryRow) ?? null;
}

export function addLibraryItem(agencyId: string, kind: AgencyLibraryKind, name: string, payload: string): AgencyLibraryRow {
  const id = crypto.randomUUID();
  db()
    .prepare("INSERT INTO agency_library (id, agency_id, kind, name, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, agencyId, kind, name, payload, now());
  return getLibraryItem(agencyId, id) as AgencyLibraryRow;
}

export function deleteLibraryItem(agencyId: string, id: string): void {
  db().prepare("DELETE FROM agency_library WHERE id = ? AND agency_id = ?").run(id, agencyId);
}

export function listReviews(agencyId: string): AgencyReviewRow[] {
  return db().prepare("SELECT * FROM agency_reviews WHERE agency_id = ? ORDER BY created_at DESC").all(agencyId) as unknown as AgencyReviewRow[];
}
export function getReviewByToken(token: string): AgencyReviewRow | null {
  const row = db().prepare("SELECT * FROM agency_reviews WHERE token = ?").get(token);
  return (row as unknown as AgencyReviewRow) ?? null;
}

export function getReviewForProject(agencyId: string, projectId: string): AgencyReviewRow | null {
  const row = db()
    .prepare("SELECT * FROM agency_reviews WHERE agency_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(agencyId, projectId);
  return (row as unknown as AgencyReviewRow) ?? null;
}

export function createReview(agencyId: string, projectId: string, clientName: string): AgencyReviewRow {
  const existing = getReviewForProject(agencyId, projectId);
  if (existing) {
    db().prepare("UPDATE agency_reviews SET client_name = ?, updated_at = ? WHERE id = ?").run(clientName, now(), existing.id);
    return db().prepare("SELECT * FROM agency_reviews WHERE id = ?").get(existing.id) as unknown as AgencyReviewRow;
  }
  const id = crypto.randomUUID();
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 8);
  db()
    .prepare("INSERT INTO agency_reviews (id, agency_id, project_id, token, client_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)")
    .run(id, agencyId, projectId, token, clientName, now(), now());
  setAgencyProjectStatus(agencyId, projectId, "review");
  return db().prepare("SELECT * FROM agency_reviews WHERE id = ?").get(id) as unknown as AgencyReviewRow;
}
export function setReviewStatus(id: string, status: AgencyReviewRow["status"]): AgencyReviewRow {
  db().prepare("UPDATE agency_reviews SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
  const review = db().prepare("SELECT * FROM agency_reviews WHERE id = ?").get(id) as unknown as AgencyReviewRow;
  setAgencyProjectStatus(review.agency_id, review.project_id, status === "approved" ? "approved" : "review");
  return review;
}

export function listComments(reviewId: string): AgencyCommentRow[] {
  return db().prepare("SELECT * FROM agency_comments WHERE review_id = ? ORDER BY created_at ASC").all(reviewId) as unknown as AgencyCommentRow[];
}

export function addComment(reviewId: string, author: string, body: string): AgencyCommentRow {
  const id = crypto.randomUUID();
  db().prepare("INSERT INTO agency_comments (id, review_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)").run(id, reviewId, author, body.slice(0, 1200), now());
  return db().prepare("SELECT * FROM agency_comments WHERE id = ?").get(id) as unknown as AgencyCommentRow;
}

/** Nollställer AI-räknarna när en ny kalendermånad börjar. */
export function aiUsage(agency: AgencyRow): { copy: number; images: number } {
  if (agency.ai_period !== period()) {
    db().prepare("UPDATE agencies SET ai_copy_used = 0, ai_images_used = 0, ai_period = ? WHERE id = ?").run(period(), agency.id);
    return { copy: 0, images: 0 };
  }
  return { copy: agency.ai_copy_used, images: agency.ai_images_used };
}

export function addAiUsage(agencyId: string, copy: number, images: number): void {
  db()
    .prepare("UPDATE agencies SET ai_copy_used = ai_copy_used + ?, ai_images_used = ai_images_used + ?, ai_period = ? WHERE id = ?")
    .run(copy, images, period(), agencyId);
}

/**
 * Bildgenereringen är lokal och gratis, så det finns ingen kvot att räkna.
 * Tabellen `image_generations` finns kvar för bakåtkompatibilitet med äldre
 * databaser men används inte längre.
 */

export function getAgencyById(id: string): AgencyRow | null {
  const row = db().prepare("SELECT * FROM agencies WHERE id = ?").get(id);
  return (row as unknown as AgencyRow) ?? null;
}

export type HealthRow = {
  id: string;
  user_id: string;
  project_id: string;
  score: number;
  report: string;
  created_at: string;
};

export type StatsRow = {
  id: string;
  user_id: string;
  project_id: string;
  shop: string | null;
  source: string;
  payload: string;
  created_at: string;
};

export type InsightRow = {
  id: string;
  user_id: string;
  project_id: string;
  kind: string;
  source: string;
  body: string;
  created_at: string;
};

/** Sparar senaste health-rapporten per projekt (historik behålls för adminpanelen). */
export function saveHealthReport(userId: string, projectId: string, score: number, report: string): void {
  db()
    .prepare("INSERT INTO theme_health (id, user_id, project_id, score, report, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(crypto.randomUUID(), userId, projectId, Math.round(score), report, now());
  db()
    .prepare(
      "DELETE FROM theme_health WHERE project_id = ? AND id NOT IN (SELECT id FROM theme_health WHERE project_id = ? ORDER BY created_at DESC LIMIT 20)",
    )
    .run(projectId, projectId);
}

export function latestHealthReport(projectId: string): HealthRow | null {
  const row = db().prepare("SELECT * FROM theme_health WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get(projectId);
  return (row as unknown as HealthRow) ?? null;
}

export function latestHealthReports(limit = 20): (HealthRow & { project_name: string; user_email: string })[] {
  return db()
    .prepare(
      `SELECT h.*, p.name AS project_name, u.email AS user_email FROM theme_health h
       JOIN projects p ON p.id = h.project_id JOIN users u ON u.id = h.user_id
       ORDER BY h.created_at DESC LIMIT ?`,
    )
    .all(limit) as unknown as (HealthRow & { project_name: string; user_email: string })[];
}

export function saveStatsSnapshot(userId: string, projectId: string, shop: string | null, source: string, payload: string): void {
  db()
    .prepare("INSERT INTO stats_snapshots (id, user_id, project_id, shop, source, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(crypto.randomUUID(), userId, projectId, shop, source, payload, now());
  db()
    .prepare(
      "DELETE FROM stats_snapshots WHERE project_id = ? AND id NOT IN (SELECT id FROM stats_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 10)",
    )
    .run(projectId, projectId);
}

export function latestStatsSnapshot(projectId: string): StatsRow | null {
  const row = db().prepare("SELECT * FROM stats_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get(projectId);
  return (row as unknown as StatsRow) ?? null;
}

export function saveInsight(userId: string, projectId: string, kind: string, source: string, body: string): InsightRow {
  const row: InsightRow = { id: crypto.randomUUID(), user_id: userId, project_id: projectId, kind, source, body, created_at: now() };
  db()
    .prepare("INSERT INTO ai_insights (id, user_id, project_id, kind, source, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(row.id, row.user_id, row.project_id, row.kind, row.source, row.body, row.created_at);
  return row;
}

export function latestInsight(projectId: string, kind = "combined"): InsightRow | null {
  const row = db()
    .prepare("SELECT * FROM ai_insights WHERE project_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1")
    .get(projectId, kind);
  return (row as unknown as InsightRow) ?? null;
}

export function countInsights(): number {
  const row = db().prepare("SELECT COUNT(*) AS count FROM ai_insights").get() as unknown as { count: number };
  return Number(row?.count ?? 0);
}
