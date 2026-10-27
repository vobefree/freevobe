/**
 * Roller och behörigheter för adminpanelen. Ren modul – importeras av både server och klient.
 *
 * De inbyggda rollerna nedan seedas i `staff_roles` vid första anslutningen och kan
 * därefter redigeras i panelen. Nya roller skapas i databasen med valfri kombination
 * av behörigheter, så panelen kan växa med teamet utan kodändringar.
 */

export const STAFF_ROLES = ["owner", "admin", "finance", "support", "developer"] as const;
/** Rollnamn är en slug i `staff_roles` – inbyggd eller egen. */
export type StaffRole = string;

export const PERMISSIONS = [
  "overview.view",
  "economy.view",
  "economy.manage",
  "users.view",
  "users.manage",
  "inbox.view",
  "inbox.manage",
  "staff.view",
  "staff.manage",
  "keys.view",
  "keys.manage",
  "projects.view",
  "content.view",
  "content.manage",
  "system.view",
  "system.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_GROUPS: { id: string; label: string; description: string }[] = [
  { id: "overview", label: "Översikt", description: "Nyckeltal, intäktstakt och senaste händelser." },
  { id: "economy", label: "Ekonomi", description: "Intäkter, abonnemang, konvertering och betalningar." },
  { id: "users", label: "Användare", description: "Konton, planer, provperioder och kontostatus." },
  { id: "inbox", label: "Inkorg", description: "Meddelanden som skickas via kontaktformuläret." },
  { id: "staff", label: "Personal & roller", description: "Anställda, inbjudningar och rollmatrisen." },
  { id: "keys", label: "API-nycklar", description: "Nycklar och inställningar för tjänsterna." },
  { id: "projects", label: "Projekt", description: "Alla teman i systemet och deras hälsa." },
  { id: "content", label: "Innehåll", description: "All text på sajten, per språk." },
  { id: "system", label: "System", description: "Drift, sajtregler och tjänstestatus." },
  { id: "audit", label: "Logg", description: "Spår av varje ändring i panelen." },
];

export const PERMISSION_META: Record<Permission, { label: string; description: string; group: string }> = {
  "overview.view": { label: "Se översikt", description: "Öppna panelens startsida med nyckeltal.", group: "overview" },
  "economy.view": { label: "Se ekonomi", description: "Intäkter, abonnemang och betalningslista.", group: "economy" },
  "economy.manage": { label: "Hantera ekonomi", description: "Exportera underlag och justera prenumerationsläge.", group: "economy" },
  "users.view": { label: "Se användare", description: "Söka konton och läsa kontodetaljer.", group: "users" },
  "users.manage": { label: "Hantera användare", description: "Byta plan, förlänga prov, återställa lösenord, stänga av.", group: "users" },
  "inbox.view": { label: "Se inkorg", description: "Läsa meddelanden från kontaktformuläret.", group: "inbox" },
  "inbox.manage": { label: "Hantera inkorg", description: "Markera som klar och ta bort meddelanden.", group: "inbox" },
  "staff.view": { label: "Se personal", description: "Läsa teamet och rollmatrisen.", group: "staff" },
  "staff.manage": { label: "Hantera personal", description: "Bjuda in, byta roll, stänga av och ta bort personal.", group: "staff" },
  "keys.view": { label: "Se nycklar", description: "Se vilka nycklar som är satta (aldrig värden).", group: "keys" },
  "keys.manage": { label: "Hantera nycklar", description: "Lägga in och rotera API-nycklar.", group: "keys" },
  "projects.view": { label: "Se projekt", description: "Alla kunders teman och deras hälsa.", group: "projects" },
  "content.view": { label: "Se innehåll", description: "Läsa alla texter på sajten per språk.", group: "content" },
  "content.manage": { label: "Redigera innehåll", description: "Ändra, återställa och kopiera texter mellan språk.", group: "content" },
  "system.view": { label: "Se system", description: "Driftstatus, databasstatistik och sajtregler.", group: "system" },
  "system.manage": { label: "Hantera system", description: "Registrering, provperiod, supportadress och meddelanden.", group: "system" },
  "audit.view": { label: "Se logg", description: "Alla åtgärder med aktör och mål.", group: "audit" },
};

const ALL: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ALL,
  admin: ALL.filter((permission) => permission !== "keys.manage" && permission !== "system.manage"),
  finance: ["overview.view", "economy.view", "economy.manage", "users.view", "projects.view", "inbox.view", "audit.view"],
  support: ["overview.view", "users.view", "users.manage", "projects.view", "inbox.view", "inbox.manage", "audit.view"],
  developer: ["overview.view", "keys.view", "system.view", "system.manage", "projects.view", "inbox.view", "audit.view"],
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Ägare",
  admin: "Admin",
  finance: "Ekonomi",
  support: "Support",
  developer: "Utvecklare",
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Full kontroll, inklusive API-nycklar och systeminställningar.",
  admin: "Allt utom att rotera API-nycklar och ändra systemflaggor.",
  finance: "Ekonomi, betalningar, användarlista och logg – läs och hantera.",
  support: "Användare, inkorg och projekt – utan ekonomi och nycklar.",
  developer: "Nycklar (läs), systemstatus, flaggor och projekt.",
};

export type RoleDefinition = {
  slug: string;
  label: string;
  description: string;
  permissions: Permission[];
  /** Inbyggd roll: kan inte tas bort, men behörigheterna kan justeras. */
  system: boolean;
};

/** Inbyggda roller som seedas i databasen. `owner` är alltid låst till alla behörigheter. */
export const BUILTIN_ROLES: RoleDefinition[] = STAFF_ROLES.map((slug) => ({
  slug,
  label: ROLE_LABELS[slug],
  description: ROLE_DESCRIPTIONS[slug],
  permissions: ROLE_PERMISSIONS[slug],
  system: true,
}));

/** Rollen `owner` kan aldrig delas ut – den kommer från ADMIN_EMAILS. */
export const RESERVED_ROLE = "owner";

export type AdminNavId =
  | "overview"
  | "economy"
  | "accounting"
  | "users"
  | "inbox"
  | "staff"
  | "keys"
  | "projects"
  | "content"
  | "system"
  | "audit";

export const NAV: { id: AdminNavId; label: string; href: string; permission: Permission }[] = [
  { id: "overview", label: "Översikt", href: "", permission: "overview.view" },
  { id: "economy", label: "Ekonomi", href: "/economy", permission: "economy.view" },
  { id: "accounting", label: "Bokföring", href: "/accounting", permission: "economy.view" },
  { id: "users", label: "Användare", href: "/users", permission: "users.view" },
  { id: "inbox", label: "Inkorg", href: "/inbox", permission: "inbox.view" },
  { id: "staff", label: "Personal", href: "/staff", permission: "staff.view" },
  { id: "keys", label: "API-nycklar", href: "/keys", permission: "keys.view" },
  { id: "projects", label: "Projekt", href: "/projects", permission: "projects.view" },
  { id: "content", label: "Innehåll", href: "/content", permission: "content.view" },
  { id: "system", label: "System", href: "/system", permission: "system.view" },
  { id: "audit", label: "Logg", href: "/audit", permission: "audit.view" },
];
