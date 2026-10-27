import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireAdmin, hashSecret } from "@/server/auth";
import { one, run } from "@/server/db";

function toNumber(value: FormDataEntryValue | null, fallback = 0): number {
  const raw = String(value ?? "").replace(",", ".");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Lägg till anställd. */
export async function POST(request: NextRequest) {
  await requireAdmin();

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const pin = String(form.get("pin") ?? "").trim();
  const rate = Math.max(0, toNumber(form.get("hourly_rate")));

  if (!name || !username || !/^\d{4,8}$/.test(pin)) {
    redirect("/admin/anstallda?flash=an-fel");
  }

  const existing = await one<{ id: number }>("SELECT id FROM employees WHERE username = ?1", [username]);
  if (existing) redirect("/admin/anstallda?flash=an-dubblett");

  const pinHash = await hashSecret(pin);
  await run(
    `INSERT INTO employees (username, name, pin_hash, hourly_rate, active) VALUES (?1, ?2, ?3, ?4, 1)`,
    [username, name, pinHash, rate],
  );

  redirect("/admin/anstallda?flash=an-ny");
}
