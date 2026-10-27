import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  findEmployee,
  sessionExpiry,
  setSession,
  verifyAdmin,
  verifySecret,
} from "@/server/auth";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "employee");
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!username || !password) redirect("/?fel=fel&kind=admin&admin=1");

  if (kind === "admin") {
    const admin = await verifyAdmin(username, password);
    if (!admin) {
      await wait(400);
      redirect("/?fel=fel&kind=admin&admin=1");
    }
    await setSession({
      sub: `admin:${admin.id}`,
      role: "admin",
      name: admin.username,
      username: admin.username,
      exp: sessionExpiry(),
    });
    redirect("/admin");
  }

  const employee = await findEmployee(username);
  if (!employee) {
    await wait(400);
    redirect("/?fel=fel&kind=employee");
  }
  if (!employee.active) redirect("/?fel=stangd&kind=employee");
  const ok = await verifySecret(password, employee.pin_hash);
  if (!ok) {
    await wait(400);
    redirect("/?fel=fel&kind=employee");
  }
  await setSession({
    sub: `emp:${employee.id}`,
    role: "employee",
    name: employee.name,
    username: employee.username,
    exp: sessionExpiry(),
  });
  redirect("/min-sida");
}
