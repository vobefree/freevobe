import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { clearSession } from "@/server/auth";

export async function POST(_request: NextRequest) {
  await clearSession();
  redirect("/?fel=av");
}
