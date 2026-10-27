import { db } from "@/lib/db";
import { PERMISSIONS, RESERVED_ROLE, type Permission, type RoleDefinition } from "./permissions";

/**
 * Roller lagras i databasen så att panelen kan få nya roller utan kodändring.
 * `owner` är alltid låst till alla behörigheter och kan inte skapas, ändras eller
 * delas ut härifrån – den kommer från ADMIN_EMAILS.
 */

type RoleRow = {
  slug: string;
  label: string;
  description: string;
  permissions: string;
  system: number;
  created_at: string;
};

function parsePermissions(raw: string): Permission[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Permission => typeof item === "string" && (PERMISSIONS as readonly string[]).includes(item));
  } catch {
    return [];
  }
}

function toDefinition(row: RoleRow): RoleDefinition {
  const permissions = row.slug === RESERVED_ROLE ? [...PERMISSIONS] : parsePermissions(row.permissions);
  return {
    slug: String(row.slug),
    label: String(row.label),
    description: String(row.description ?? ""),
    permissions,
    system: Number(row.system) === 1,
  };
}

export function listRoles(): RoleDefinition[] {
  const rows = db()
    .prepare("SELECT * FROM staff_roles ORDER BY system DESC, created_at ASC")
    .all() as unknown as RoleRow[];
  return rows.map(toDefinition);
}

export function roleBySlug(slug: string): RoleDefinition | null {
  const row = db().prepare("SELECT * FROM staff_roles WHERE slug = ?").get(slug) as unknown as RoleRow | undefined;
  return row ? toDefinition(row) : null;
}

/** Behörigheter för en roll. Okänd roll ger inga behörigheter. */
export function permissionsFor(slug: string): Permission[] {
  if (slug === RESERVED_ROLE) return [...PERMISSIONS];
  return roleBySlug(slug)?.permissions ?? [];
}

export function roleLabel(slug: string): string {
  return roleBySlug(slug)?.label ?? slug;
}

/** Bara kända behörigheter sparas, i panelens ordning. */
function normalize(permissions: string[] | undefined): Permission[] {
  const requested = new Set(permissions ?? []);
  return PERMISSIONS.filter((permission) => requested.has(permission));
}

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "roll";
}

export type RoleInput = { label: string; description?: string; permissions?: string[] };

export function createRole(input: RoleInput): RoleDefinition {
  const label = input.label.trim().slice(0, 40);
  if (!label) throw new Error("missing_label");
  const existing = listRoles();
  let slug = slugify(label);
  if (existing.some((role) => role.slug === slug) || slug === RESERVED_ROLE) {
    let index = 2;
    while (existing.some((role) => role.slug === `${slug}-${index}`)) index += 1;
    slug = `${slug}-${index}`;
  }
  db()
    .prepare("INSERT INTO staff_roles (slug, label, description, permissions, system, created_at) VALUES (?, ?, ?, ?, 0, ?)")
    .run(slug, label, (input.description ?? "").trim().slice(0, 200), JSON.stringify(normalize(input.permissions)), new Date().toISOString());
  return roleBySlug(slug) as RoleDefinition;
}

export function updateRole(slug: string, patch: { label?: string; description?: string; permissions?: string[] }): RoleDefinition {
  const role = roleBySlug(slug);
  if (!role) throw new Error("not_found");
  if (slug === RESERVED_ROLE) throw new Error("reserved_role");
  const label = patch.label === undefined ? role.label : patch.label.trim().slice(0, 40);
  if (!label) throw new Error("missing_label");
  const description = patch.description === undefined ? role.description : patch.description.trim().slice(0, 200);
  const permissions = patch.permissions === undefined ? role.permissions : normalize(patch.permissions);
  db()
    .prepare("UPDATE staff_roles SET label = ?, description = ?, permissions = ? WHERE slug = ?")
    .run(label, description, JSON.stringify(permissions), slug);
  return roleBySlug(slug) as RoleDefinition;
}

export function deleteRole(slug: string): void {
  const role = roleBySlug(slug);
  if (!role) throw new Error("not_found");
  if (role.system || slug === RESERVED_ROLE) throw new Error("system_role");
  const inUse = db().prepare("SELECT COUNT(*) AS count FROM staff WHERE role = ?").get(slug) as unknown as { count: number };
  if (Number(inUse?.count ?? 0) > 0) throw new Error("role_in_use");
  db().prepare("DELETE FROM staff_roles WHERE slug = ?").run(slug);
}

/** En aktör får bara dela ut roller vars behörigheter aktören själv har. */
export function canGrantRole(actorPermissions: Permission[], slug: string): boolean {
  if (slug === RESERVED_ROLE) return false;
  const role = roleBySlug(slug);
  if (!role) return false;
  return role.permissions.every((permission) => actorPermissions.includes(permission));
}
