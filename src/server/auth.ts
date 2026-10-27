import { createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { all, one, run } from "./db";

export const SESSION_COOKIE = "fg_session";
const SESSION_DAYS = 30;

export type Session = {
  sub: string; // "admin" eller anställds id
  role: "admin" | "employee";
  name: string;
  username: string;
  exp: number;
};

/* ---------- lösenord / PIN ---------- */

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(plain, salt);
  return `s1$${salt}$${key.toString("hex")}`;
}

export async function verifySecret(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "s1") return false;
  const key = await scryptAsync(plain, parts[1]);
  const expected = Buffer.from(parts[2], "hex");
  if (expected.length !== key.length) return false;
  return timingSafeEqual(key, expected);
}

/* ---------- session (HMAC-signerad kakla) ---------- */

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  console.warn("[forshem] SESSION_SECRET saknas eller är kort – reservnyckel används. Sätt en hemmiljö i produktion.");
  return "forshems-gastgiveri-reservnyckel-2026-a81f";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function encodeSession(session: Session): string {
  const body = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(value: string | null | undefined): Session | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (!session.exp || session.exp < Date.now()) return null;
    if (session.role !== "admin" && session.role !== "employee") return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function setSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/?fel=logga-in&kind=admin&admin=1");
  return session;
}

export async function requireEmployee(): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== "employee") redirect("/?fel=logga-in");
  return session;
}

export function sessionExpiry(): number {
  return Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
}

/* ---------- administratör ---------- */

export type AdminRow = { id: number; username: string; password_hash: string };

/** Skapar första admin-kontot (ifrån ADMIN_USERNAME/ADMIN_PASSWORD) om ingen finns. */
export async function ensureAdmin(): Promise<void> {
  const existing = await one<AdminRow>("SELECT id, username, password_hash FROM admins LIMIT 1");
  if (existing) return;
  const username = (process.env.ADMIN_USERNAME || "admin").trim() || "admin";
  const password = process.env.ADMIN_PASSWORD || "forshem";
  const hash = await hashSecret(password);
  await run("INSERT INTO admins (username, password_hash) VALUES (?1, ?2)", [username, hash]);
}

export async function verifyAdmin(username: string, password: string): Promise<AdminRow | null> {
  await ensureAdmin();
  const admin = await one<AdminRow>("SELECT id, username, password_hash FROM admins WHERE username = ?1", [username]);
  if (!admin) return null;
  const ok = await verifySecret(password, admin.password_hash);
  return ok ? admin : null;
}

/* ---------- anställda ---------- */

export type EmployeeRow = {
  id: number;
  username: string;
  name: string;
  pin_hash: string;
  hourly_rate: number;
  active: number;
  created_at: string;
};

export async function listEmployees(includeInactive = true): Promise<EmployeeRow[]> {
  const sql = includeInactive
    ? "SELECT * FROM employees ORDER BY active DESC, name COLLATE NOCASE"
    : "SELECT * FROM employees WHERE active = 1 ORDER BY name COLLATE NOCASE";
  return all<EmployeeRow>(sql);
}

export async function findEmployee(username: string): Promise<EmployeeRow | null> {
  return one<EmployeeRow>("SELECT * FROM employees WHERE username = ?1", [username]);
}

export async function verifyEmployee(username: string, pin: string): Promise<EmployeeRow | null> {
  const employee = await findEmployee(username);
  if (!employee || !employee.active) return null;
  const ok = await verifySecret(pin, employee.pin_hash);
  return ok ? employee : null;
}
