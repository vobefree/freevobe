import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { run } from "@/server/db";

/** Ta bort anställd (även dess pass och tidsstämplar). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) redirect("/admin/anstallda?flash=an-fel");

  await run("DELETE FROM time_entries WHERE employee_id = ?1", [id]);
  await run("DELETE FROM shifts WHERE employee_id = ?1", [id]);
  await run("DELETE FROM employees WHERE id = ?1", [id]);

  redirect("/admin/anstallda?flash=an-bort");
}
