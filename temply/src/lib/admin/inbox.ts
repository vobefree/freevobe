import { db, type ContactRow } from "@/lib/db";

/** Meddelanden från kontaktformuläret. De sparas redan i databasen – här blir de en inkorg. */

export type InboxMessage = ContactRow;

export type InboxCounts = { total: number; unread: number; handled: number };

export function inboxCounts(): InboxCounts {
  const row = db()
    .prepare("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN handled = 0 THEN 1 ELSE 0 END), 0) AS unread FROM contact_messages")
    .get() as unknown as { total: number; unread: number };
  const total = Number(row?.total ?? 0);
  const unread = Number(row?.unread ?? 0);
  return { total, unread, handled: total - unread };
}

export function listInbox(input: { q?: string; status?: "new" | "handled" | "all"; limit?: number } = {}): InboxMessage[] {
  const limit = Math.min(300, Math.max(1, input.limit ?? 100));
  const q = (input.q ?? "").trim().toLowerCase();
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    clauses.push("(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(message) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (input.status === "new") clauses.push("handled = 0");
  if (input.status === "handled") clauses.push("handled = 1");
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return db()
    .prepare(`SELECT * FROM contact_messages ${where} ORDER BY handled ASC, created_at DESC LIMIT ?`)
    .all(...params, limit) as unknown as InboxMessage[];
}

export function setInboxHandled(id: string, handled: boolean): boolean {
  const result = db().prepare("UPDATE contact_messages SET handled = ? WHERE id = ?").run(handled ? 1 : 0, id);
  return Number(result.changes) > 0;
}

export function deleteInboxMessage(id: string): void {
  db().prepare("DELETE FROM contact_messages WHERE id = ?").run(id);
}

export function latestInbox(limit = 4): { id: string; email: string; subject: string; createdAt: string; handled: number }[] {
  const rows = db()
    .prepare("SELECT id, email, subject, created_at AS createdAt, handled FROM contact_messages ORDER BY created_at DESC LIMIT ?")
    .all(limit) as unknown as { id: string; email: string; subject: string; createdAt: string; handled: number }[];
  // node:sqlite returnerar objekt utan prototype. De kan inte skickas direkt till
  // en klientkomponent, så vi kopierar dem till vanliga objekt här.
  return rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    subject: String(row.subject),
    createdAt: String(row.createdAt),
    handled: Number(row.handled),
  }));
}
