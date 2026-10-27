import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth";
import { one, run } from "@/server/db";
import type { ShiftRow } from "@/server/reports";

/** Ta bort ett schemalagt pass. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) redirect("/admin/schema?flash=pass-fel");

  const shift = await one<ShiftRow>("SELECT id, date FROM shifts WHERE id = ?1", [id]);
  if (shift) await run("DELETE FROM shifts WHERE id = ?1", [id]);

  const month = shift?.date?.slice(0, 7) ?? "";
  redirect(`/admin/schema?flash=pass-bort${month ? `&month=${month}` : ""}`);
}
