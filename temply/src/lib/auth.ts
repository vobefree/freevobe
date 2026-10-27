import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSession, deleteSession, markSessionVerified, sessionById, userForSession, type UserRow } from "./db";

export const SESSION_COOKIE = "temply_session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export async function startSession(userId: string): Promise<void> {
  const session = createSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function sessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/** Sant när sessionen har bekräftats med tvåfaktorskod. */
export async function sessionVerified(): Promise<boolean> {
  const token = await sessionToken();
  if (!token) return false;
  return Boolean(sessionById(token)?.mfa_at);
}

export async function confirmSession(): Promise<void> {
  const token = await sessionToken();
  if (token) markSessionVerified(token);
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = userForSession(token);
  // Inaktiverade konton tappar åtkomst direkt, även med giltig session.
  if (user && user.disabled) return null;
  return user;
}

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  locale: string;
  shopifyShop: string | null;
  shopifyConnected: boolean;
};

export function publicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    shopifyShop: user.shopify_shop,
    shopifyConnected: Boolean(user.shopify_shop && user.shopify_token),
  };
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
