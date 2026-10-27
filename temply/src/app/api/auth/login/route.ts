import { NextResponse } from "next/server";
import { startSession, verifyPassword } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = (body?.email ?? "").trim();
  const password = body?.password ?? "";
  if (!email || !password) return NextResponse.json({ error: "required" }, { status: 400 });

  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
  if (user.disabled) {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }
  await startSession(user.id);
  return NextResponse.json({ ok: true });
}
