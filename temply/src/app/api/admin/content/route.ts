import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/admin/guard";
import { contentEntries, CONTENT_LOCALES, copyOverrides, overrideCount, resetContent, saveContentValues } from "@/lib/content";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localeFrom(value: string | null): string {
  return isLocale(value ?? undefined) ? (value as string) : "sv";
}

export async function GET(request: Request) {
  const guard = await requirePermission("content.view");
  if ("response" in guard) return guard.response;
  const url = new URL(request.url);
  const locale = localeFrom(url.searchParams.get("locale"));
  return Response.json({
    locale,
    locales: CONTENT_LOCALES,
    entries: contentEntries(locale),
    count: overrideCount(locale),
  });
}

type Body = {
  action?: "save" | "reset" | "copy";
  locale?: string;
  key?: string;
  from?: string;
  values?: Record<string, string>;
};

export async function POST(request: Request) {
  const guard = await requirePermission("content.manage");
  if ("response" in guard) return guard.response;
  const { actor } = guard;
  const body = (await request.json().catch(() => ({}))) as Body;
  const locale = localeFrom(body.locale ?? null);
  const actorTag = { id: actor.user.id, email: actor.user.email };

  if (body.action === "reset") {
    const removed = resetContent(locale, typeof body.key === "string" ? body.key : undefined);
    logAudit(actorTag, "content.reset", body.key ?? locale, `${removed} texter`);
    revalidatePath("/", "layout");
    return Response.json({ ok: true, removed, entries: contentEntries(locale), count: overrideCount(locale) });
  }

  if (body.action === "copy") {
    const from = localeFrom(body.from ?? null);
    if (!isLocale(body.locale ?? undefined)) return Response.json({ error: "unknown_locale" }, { status: 400 });
    if (from === locale) return Response.json({ error: "same_locale" }, { status: 400 });
    const copied = copyOverrides(from, locale, actor.user.email);
    logAudit(actorTag, "content.copy", `${from}->${locale}`, `${copied} texter`);
    revalidatePath("/", "layout");
    return Response.json({ ok: true, copied, entries: contentEntries(locale), count: overrideCount(locale) });
  }

  const values = body.values ?? {};
  if (!values || typeof values !== "object" || Object.keys(values).length === 0) {
    return Response.json({ error: "nothing_to_save" }, { status: 400 });
  }
  const result = saveContentValues(locale, values, actor.user.email);
  logAudit(actorTag, "content.save", locale, `${result.saved} sparade, ${result.removed} återställda`);
  revalidatePath("/", "layout");
  return Response.json({ ok: true, ...result, entries: contentEntries(locale), count: overrideCount(locale) });
}
