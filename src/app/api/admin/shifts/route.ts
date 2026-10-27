import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { one, run } from "@/server/db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Schema lägg ett pass. */
export async function POST(request: NextRequest) {
  await requireAdmin();

  const form = await request.formData();
  const employeeId = Number(form.get("employee_id"));
  const date = String(form.get("date") ?? "");
  const start = String(form.get("start_time") ?? "");
  const end = String(form.get("end_time") ?? "");
  const note = String(form.get("note") ?? "").trim() || null;

  if (!Number.isInteger(employeeId) || employeeId <= 0 || !DATE_RE.test(date) || !TIME_RE.test(start) || !TIME_RE.test(end)) {
    redirect(`/admin/schema?flash=pass-fel&${new URLSearchParams({ month: date.slice(0, 7) || "" })}`);
  }

  const employee = await one<{ id: number }>("SELECT id FROM employees WHERE id = ?1", [employeeId]);
  if (!employee) redirect("/admin/schema?flash=pass-fel");

  await run(
    `INSERT INTO shifts (employee_id, date, start_time, end_time, note) VALUES (?1, ?2, ?3, ?4, ?5)`,
    [employeeId, date, start, end, note],
  );

  redirect(`/admin/schema?flash=pass-ny&month=${date.slice(0, 7)}`);
}
