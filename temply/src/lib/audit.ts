import { db } from "./db";

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  target: string;
  meta: string;
  created_at: string;
};

export function logAudit(actor: { id?: string | null; email: string }, action: string, target = "", meta: unknown = ""): void {
  const payload = typeof meta === "string" ? meta : JSON.stringify(meta);
  db()
    .prepare("INSERT INTO admin_audit (id, actor_id, actor_email, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(crypto.randomUUID(), actor.id ?? null, actor.email, action, target, payload.slice(0, 2000), new Date().toISOString());
}

export function listAudit(limit = 100, query = ""): AuditRow[] {
  if (query.trim()) {
    const like = `%${query.trim()}%`;
    return db()
      .prepare("SELECT * FROM admin_audit WHERE actor_email LIKE ? OR action LIKE ? OR target LIKE ? ORDER BY created_at DESC LIMIT ?")
      .all(like, like, like, limit) as unknown as AuditRow[];
  }
  return db().prepare("SELECT * FROM admin_audit ORDER BY created_at DESC LIMIT ?").all(limit) as unknown as AuditRow[];
}
