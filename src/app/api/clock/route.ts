import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireEmployee, setSession, sessionExpiry, getSession } from "@/server/auth";
import { run } from "@/server/db";
import { openPunch } from "@/server/reports";
import { nowClock, nowISO, today } from "@/server/time";

/** Checka in / checka ut för inloggad anställd. */
export async function POST(request: NextRequest) {
  const session = await requireEmployee();
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");

  const employeeId = Number(String(session.sub).replace("emp:", ""));
  if (!Number.isInteger(employeeId) || employeeId <= 0) redirect("/min-sida?flash=fel");

  const open = await openPunch(employeeId);

  if (kind === "in") {
    if (open) redirect("/min-sida?flash=redan");
    await run(
      `INSERT INTO time_entries (employee_id, clock_in, in_date, in_time) VALUES (?1, ?2, ?3, ?4)`,
      [employeeId, nowISO(), today(), nowClock()],
    );
    // håll sessionen vidare
    await setSession({ ...session, exp: sessionExpiry() });
    redirect("/min-sida?flash=in");
  }

  if (kind === "out") {
    if (!open) redirect("/min-sida?flash=ej-in");
    await run(
      `UPDATE time_entries
          SET clock_out = ?1, out_date = ?2, out_time = ?3
        WHERE id = ?4 AND clock_out IS NULL`,
      [nowISO(), today(), nowClock(), open.id],
    );
    await setSession({ ...session, exp: sessionExpiry() });
    redirect("/min-sida?flash=out");
  }

  redirect("/min-sida?flash=fel");
}

export async function GET() {
  const session = await getSession();
  if (session?.role === "employee") redirect("/min-sida");
  redirect("/");
}
