import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { hashSecret, requireAdmin } from "@/server/auth";
import { one, run } from "@/server/db";

function toNumber(value: FormDataEntryValue | null, fallback = 0): number {
  const raw = String(value ?? "").replace(",", ".");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Uppdatera anställd (namn, användarnamn, timlön, PIN, aktiv). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) redirect("/admin/anstallda?flash=an-fel");

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const pin = String(form.get("pin") ?? "").trim();
  const rate = Math.max(0, toNumber(form.get("hourly_rate")));
  const active = String(form.get("active") ?? "1") === "1" ? 1 : 0;

  if (!name || !username) redirect(`/admin/anstallda/${id}?flash=an-fel`);

  const clash = await one<{ id: number }>("SELECT id FROM employees WHERE username = ?1 AND id <> ?2", [
    username,
    id,
  ]);
  if (clash) redirect(`/admin/anstallda/${id}?flash=an-dubblett`);

  await run(
    `UPDATE employees SET name = ?1, username = ?2, hourly_rate = ?3, active = ?4 WHERE id = ?5`,
    [name, username, rate, active, id],
  );

  if (pin) {
    if (!/^\d{4,8}$/.test(pin)) redirect(`/admin/anstallda/${id}?flash=an-pin`);
    await run(`UPDATE employees SET pin_hash = ?1 WHERE id = ?2`, [await hashSecret(pin), id]);
  }

  redirect("/admin/anstallda?flash=an-oppd");
}
