import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/admin/guard";
import {
  clearFailures,
  clearPasswordFailures,
  confirmEnrolment,
  lockSecondsLeft,
  mfaRequired,
  mfaState,
  passwordLockSeconds,
  registerFailure,
  registerPasswordFailure,
  resetMfa,
  startEnrolment,
  verifyCode,
} from "@/lib/admin/mfa";
import { confirmSession, getCurrentUser, hashPassword, sessionVerified, startSession, verifyPassword } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";
import { identityFor } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: string; email?: string; password?: string; code?: string };

export async function GET() {
  const user = await getCurrentUser();
  const identity = identityFor(user);
  if (!user || !identity) return Response.json({ signedIn: false, state: null });
  return Response.json({
    signedIn: true,
    verified: await sessionVerified(),
    email: user.email,
    role: identity.roleLabel,
    state: mfaState(user.id),
    lockSeconds: lockSecondsLeft(user.id),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const action = body.action ?? "";

  /* --- Steg 1: e-post och lösenord. Skapar en session som ännu inte är verifierad. --- */
  if (action === "password") {
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) return Response.json({ error: "required" }, { status: 400 });
    const passwordLock = passwordLockSeconds(email);
    if (passwordLock > 0) {
      return Response.json({ error: "locked", lockSeconds: passwordLock }, { status: 429 });
    }
    const user = findUserByEmail(email);
    if (!user || user.disabled || !verifyPassword(password, user.password_hash)) {
      registerPasswordFailure(email);
      return Response.json({ error: "bad_credentials" }, { status: 401 });
    }
    const identity = identityFor(user);
    if (!identity) return Response.json({ error: "not_staff" }, { status: 403 });
    clearPasswordFailures(email);
    await startSession(user.id);
    const state = mfaState(user.id);
    logAudit({ id: user.id, email: user.email }, "admin.login", user.email, state.enrolled ? "mfa_challenge" : "mfa_enrol");
    return Response.json({ ok: true, needsEnrolment: !state.enrolled });
  }

  /* --- Övriga steg kräver en session med personalroll. --- */
  const user = await getCurrentUser();
  const identity = identityFor(user);
  if (!user || !identity) return Response.json({ error: "forbidden" }, { status: 403 });

  if (action === "enrol") {
    const locked = lockSecondsLeft(user.id);
    if (locked > 0) return Response.json({ error: "locked", lockSeconds: locked }, { status: 429 });
    if (mfaState(user.id).enrolled) return Response.json({ error: "already_enrolled" }, { status: 400 });
    const enrolment = startEnrolment(user);
    logAudit({ id: user.id, email: user.email }, "mfa.enrol_start", user.email);
    return Response.json({ ok: true, secret: enrolment.secret, formatted: enrolment.formatted, uri: enrolment.uri });
  }

  if (action === "confirm") {
    const result = confirmEnrolment(user, (body.code ?? "").trim());
    if (!result.ok) {
      const lockLeft = registerFailure(user.id);
      logAudit({ id: user.id, email: user.email }, "mfa.enrol_failed", user.email, result.error);
      return Response.json({ error: result.error, lockSeconds: lockLeft }, { status: 400 });
    }
    clearFailures(user.id);
    await confirmSession();
    logAudit({ id: user.id, email: user.email }, "mfa.enrolled", user.email);
    return Response.json({ ok: true, recoveryCodes: result.recoveryCodes });
  }

  if (action === "verify") {
    const result = verifyCode(user, body.code ?? "");
    if (!result.ok) {
      const status = result.error === "locked" ? 429 : 401;
      if (result.error === "locked") logAudit({ id: user.id, email: user.email }, "mfa.locked", user.email);
      else logAudit({ id: user.id, email: user.email }, "mfa.failed", user.email);
      return Response.json({ error: result.error, lockSeconds: result.lockSeconds }, { status });
    }
    await confirmSession();
    logAudit({ id: user.id, email: user.email }, result.recoveryUsed ? "mfa.recovery_used" : "mfa.verified", user.email);
    return Response.json({ ok: true, recoveryUsed: result.recoveryUsed });
  }

  if (action === "reset") {
    if (!identity.owner) return Response.json({ error: "owner_only" }, { status: 403 });
    if (mfaRequired() && !(await sessionVerified())) return Response.json({ error: "mfa_required" }, { status: 403 });
    const guard = await requirePermission("staff.manage");
    if ("response" in guard) return guard.response;
    // Nollställer även mfa_at på alla sessioner, så att den gamla faktorn inte
    // fortsätter räknas som verifierad någonstans.
    resetMfa(user.id);
    logAudit({ id: user.id, email: user.email }, "mfa.reset", user.email);
    return Response.json({ ok: true });
  }

  if (action === "change-password") {
    if (!(await sessionVerified()) && mfaRequired()) return Response.json({ error: "mfa_required" }, { status: 403 });
    const next = body.password ?? "";
    if (next.length < 12) return Response.json({ error: "weak_password" }, { status: 400 });
    const { db } = await import("@/lib/db");
    db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), user.id);
    logAudit({ id: user.id, email: user.email }, "admin.password_changed", user.email);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "unknown_action" }, { status: 400 });
}
