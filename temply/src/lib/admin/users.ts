import { db, findUserById, updateUser, type PaymentRow, type ProjectRow, type UserRow } from "@/lib/db";
import { staffByEmail } from "@/lib/staff";

export type AdminUserListRow = {
  id: string;
  email: string;
  name: string;
  locale: string;
  plan: string;
  trialEndsAt: string;
  createdAt: string;
  shopifyShop: string | null;
  disabled: number;
  projects: number;
  paidCents: number;
  staffRole: string | null;
};

export function listAdminUsers(input: { q?: string; limit?: number; offset?: number }): { users: AdminUserListRow[]; total: number } {
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const q = (input.q ?? "").trim().toLowerCase();
  const where = q ? "WHERE u.email LIKE ? OR u.name LIKE ? OR u.shopify_shop LIKE ?" : "";
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
  const total = db()
    .prepare(`SELECT COUNT(*) AS count FROM users u ${where}`)
    .get(...params) as unknown as { count: number };
  const rows = db()
    .prepare(
      `SELECT u.id, u.email, u.name, u.locale, u.plan_status AS plan, u.trial_ends_at AS trialEndsAt,
        u.created_at AS createdAt, u.shopify_shop AS shopifyShop, u.disabled,
        (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projects,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM payments pay WHERE pay.user_id = u.id AND pay.status = 'paid') AS paidCents
       FROM users u ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as unknown as AdminUserListRow[];
  return {
    users: rows.map((row) => ({ ...row, staffRole: staffByEmail(row.email)?.role ?? null })),
    total: Number(total?.count ?? 0),
  };
}

export type AdminUserDetail = {
  user: Omit<UserRow, "password_hash" | "shopify_token">;
  projects: (ProjectRow & { health: number | null })[];
  payments: PaymentRow[];
  staff: { role: string; status: string; id: string } | null;
};

export function adminUserDetail(id: string): AdminUserDetail | null {
  const user = findUserById(id);
  if (!user) return null;
  const projects = db()
    .prepare(
      `SELECT p.*, (SELECT score FROM theme_health h WHERE h.project_id = p.id ORDER BY h.created_at DESC LIMIT 1) AS health
       FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`,
    )
    .all(id) as unknown as (ProjectRow & { health: number | null })[];
  const payments = db().prepare("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 25").all(id) as unknown as PaymentRow[];
  const staff = staffByEmail(user.email);
  const { password_hash: _password, shopify_token: _token, ...safe } = user;
  return {
    user: safe,
    projects: projects.map((project) => ({ ...project, health: project.health === null ? null : Number(project.health) })),
    payments,
    staff: staff ? { id: staff.id, role: staff.role, status: staff.status } : null,
  };
}

export function setUserPassword(id: string, passwordHash: string): void {
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

export function deleteUserAccount(id: string): void {
  db().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function extendTrial(id: string, days: number): string {
  const user = findUserById(id);
  if (!user) throw new Error("not_found");
  const base = Math.max(Date.now(), new Date(user.trial_ends_at).getTime());
  const next = new Date(base + Math.max(1, Math.min(90, days)) * 86_400_000).toISOString();
  updateUser(id, { trial_ends_at: next, plan_status: "trialing" });
  return next;
}

export function paymentsCsv(rows: { id: string; email: string; provider: string; amount_cents: number; currency: string; status: string; created_at: string }[]): string {
  const header = "id,email,provider,amount_cents,currency,status,created_at";
  const lines = rows.map((row) => [row.id, row.email, row.provider, row.amount_cents, row.currency, row.status, row.created_at].join(","));
  return [header, ...lines].join("\n");
}
