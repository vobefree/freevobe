import { logAudit } from "@/lib/audit";
import { hashPassword, startSession, validEmail, verifyPassword } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/db";
import { siteConfig } from "@/lib/settings";
import { activateStaff, staffByToken } from "@/lib/staff";
import { roleLabel } from "@/lib/admin/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const staff = staffByToken(token);
  if (!staff || staff.status !== "invited") return Response.json({ error: "invalid_token" }, { status: 404 });
  const existing = findUserByEmail(staff.email);
  return Response.json({
    invite: {
      email: staff.email,
      name: staff.name,
      role: staff.role,
      roleLabel: roleLabel(staff.role),
      existingAccount: Boolean(existing),
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    name?: string;
    password?: string;
    currentPassword?: string;
  };
  const staff = staffByToken(body.token ?? "");
  if (!staff || staff.status !== "invited") return Response.json({ error: "invalid_token" }, { status: 404 });

  const name = (body.name ?? "").trim() || staff.name || staff.email.split("@")[0];
  if (!validEmail(staff.email)) return Response.json({ error: "invalid_email" }, { status: 400 });

  const existing = findUserByEmail(staff.email);
  let userId: string;
  if (existing) {
    if (!body.currentPassword || !verifyPassword(body.currentPassword, existing.password_hash)) {
      return Response.json({ error: "needs_password" }, { status: 401 });
    }
    userId = existing.id;
  } else {
    const password = body.password ?? "";
    if (password.length < 8) return Response.json({ error: "weak_password" }, { status: 400 });
    const user = createUser({ email: staff.email, name, passwordHash: hashPassword(password), locale: "sv", trialDays: siteConfig().trialDays });
    userId = user.id;
  }

  activateStaff(staff.id, userId, name);
  await startSession(userId);
  logAudit({ id: userId, email: staff.email }, "staff.accept", staff.email, `role=${staff.role}`);
  return Response.json({ ok: true });
}
