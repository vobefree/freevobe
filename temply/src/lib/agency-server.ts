import { getCurrentUser } from "@/lib/auth";
import { ensureAgency } from "@/lib/agency";
import type { AgencyRow, UserRow } from "@/lib/db";

export type AgencySession = { user: UserRow; agency: AgencyRow };

export async function requireAgency(): Promise<AgencySession | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { user, agency: ensureAgency(user) };
}

export function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
