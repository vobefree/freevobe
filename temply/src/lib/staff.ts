import { randomBytes } from "node:crypto";
import { db, type UserRow } from "./db";
import { RESERVED_ROLE, type Permission, type StaffRole } from "./admin/permissions";
import { permissionsFor, roleBySlug } from "./admin/roles";

export type StaffStatus = "invited" | "active" | "suspended";

export type StaffRow = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  token: string | null;
  user_id: string | null;
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
  last_seen_at: string | null;
};

/** Bootstrap-ägare: miljölistan fungerar även om databasen töms. */
export function ownerEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string): boolean {
  return ownerEmails().includes(email.toLowerCase());
}

export function listStaff(): StaffRow[] {
  return db().prepare("SELECT * FROM staff ORDER BY created_at ASC").all() as unknown as StaffRow[];
}

export function staffByEmail(email: string): StaffRow | null {
  const row = db().prepare("SELECT * FROM staff WHERE email = ?").get(email.toLowerCase()) as unknown as StaffRow | undefined;
  return row ?? null;
}

export function staffById(id: string): StaffRow | null {
  const row = db().prepare("SELECT * FROM staff WHERE id = ?").get(id) as unknown as StaffRow | undefined;
  return row ?? null;
}

export function staffByToken(token: string): StaffRow | null {
  const row = db().prepare("SELECT * FROM staff WHERE token = ?").get(token) as unknown as StaffRow | undefined;
  return row ?? null;
}

export type AdminIdentity = {
  role: StaffRole;
  roleLabel: string;
  permissions: Permission[];
  owner: boolean;
  staff: StaffRow | null;
};

/** Roll för inloggad användare: ägare via ADMIN_EMAILS, annars aktiv personalrad. */
export function identityFor(user: UserRow | null): AdminIdentity | null {
  if (!user) return null;
  if (isOwnerEmail(user.email)) {
    return { role: RESERVED_ROLE, roleLabel: "Ägare", permissions: permissionsFor(RESERVED_ROLE), owner: true, staff: staffByEmail(user.email) };
  }
  const row = staffByEmail(user.email);
  if (!row || row.status !== "active") return null;
  if (row.user_id && row.user_id !== user.id) return null;
  const role = roleBySlug(row.role);
  if (!role) return null;
  if (!row.name && user.name) db().prepare("UPDATE staff SET name = ? WHERE id = ?").run(user.name, row.id);
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  if (Date.now() - lastSeen > 3_600_000) {
    db().prepare("UPDATE staff SET last_seen_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
  }
  return { role: role.slug, roleLabel: role.label, permissions: role.permissions, owner: false, staff: row };
}

export function staffCan(identity: AdminIdentity | null, permission: Permission): boolean {
  return Boolean(identity?.permissions.includes(permission));
}

export type InviteResult = { staff: StaffRow; token: string };

export function inviteStaff(input: { email: string; name: string; role: StaffRole; invitedBy: string }): InviteResult {
  if (!roleBySlug(input.role) || input.role === RESERVED_ROLE) throw new Error("invalid_role");
  const email = input.email.trim().toLowerCase();
  const existing = staffByEmail(email);
  if (existing && existing.status === "active") throw new Error("already_staff");
  if (existing && existing.status === "suspended") throw new Error("suspended");
  if (isOwnerEmail(email)) throw new Error("already_owner");

  const token = randomBytes(24).toString("hex");
  if (existing) {
    db().prepare("UPDATE staff SET name = ?, role = ?, token = ?, invited_by = ? WHERE id = ?").run(
      input.name.trim(),
      input.role,
      token,
      input.invitedBy,
      existing.id,
    );
    return { staff: staffById(existing.id) as StaffRow, token };
  }

  const id = crypto.randomUUID();
  db()
    .prepare(
      "INSERT INTO staff (id, email, name, role, status, token, invited_by, created_at) VALUES (?, ?, ?, ?, 'invited', ?, ?, ?)",
    )
    .run(id, email, input.name.trim(), input.role, token, input.invitedBy, new Date().toISOString());
  return { staff: staffById(id) as StaffRow, token };
}

export function issueStaffToken(id: string): string {
  const token = randomBytes(24).toString("hex");
  db().prepare("UPDATE staff SET token = ?, status = 'invited', user_id = NULL, accepted_at = NULL WHERE id = ?").run(token, id);
  return token;
}

export function updateStaff(id: string, patch: Partial<Pick<StaffRow, "name" | "role" | "status">>): StaffRow | null {
  const row = staffById(id);
  if (!row) return null;
  if (patch.role && (!roleBySlug(patch.role) || patch.role === RESERVED_ROLE)) throw new Error("invalid_role");
  db()
    .prepare("UPDATE staff SET name = ?, role = ?, status = ? WHERE id = ?")
    .run(patch.name ?? row.name, patch.role ?? row.role, patch.status ?? row.status, id);
  return staffById(id);
}

export function deleteStaff(id: string): void {
  db().prepare("DELETE FROM staff WHERE id = ?").run(id);
}

export function activateStaff(id: string, userId: string, name: string): void {
  db()
    .prepare("UPDATE staff SET status = 'active', user_id = ?, name = ?, token = NULL, accepted_at = ?, last_seen_at = ? WHERE id = ?")
    .run(userId, name, new Date().toISOString(), new Date().toISOString(), id);
}

/**
 * Tilldelar en personalroll till ett befintligt konto, eller tar bort rollen.
 * Används från användarvyn så att en anställd aldrig behöver en inbjudningslänk
 * om kontot redan finns.
 */
export function assignStaffRole(input: {
  email: string;
  userId: string;
  name: string;
  role: StaffRole | null;
  invitedBy: string;
}): StaffRow | null {
  const email = input.email.trim().toLowerCase();
  const existing = staffByEmail(email);
  if (input.role === null) {
    if (!existing) return null;
    if (existing.role === RESERVED_ROLE) throw new Error("owner_protected");
    deleteStaff(existing.id);
    return null;
  }
  if (!roleBySlug(input.role) || input.role === RESERVED_ROLE) throw new Error("invalid_role");
  const timestamp = new Date().toISOString();
  if (existing) {
    db()
      .prepare("UPDATE staff SET role = ?, status = 'active', user_id = ?, name = ?, token = NULL, accepted_at = COALESCE(accepted_at, ?) WHERE id = ?")
      .run(input.role, input.userId, input.name || existing.name, timestamp, existing.id);
    return staffById(existing.id);
  }
  const id = crypto.randomUUID();
  db()
    .prepare(
      "INSERT INTO staff (id, email, name, role, status, token, user_id, invited_by, created_at, accepted_at, last_seen_at) VALUES (?, ?, ?, ?, 'active', NULL, ?, ?, ?, ?, NULL)",
    )
    .run(id, email, input.name, input.role, input.userId, input.invitedBy, timestamp, timestamp);
  return staffById(id);
}

export function staffForProjectOwner(userId: string): { role: StaffRole; email: string } | null {
  const row = db().prepare("SELECT role, email FROM staff WHERE user_id = ? AND status = 'active' LIMIT 1").get(userId) as unknown as
    | { role: StaffRole; email: string }
    | undefined;
  return row ?? null;
}
