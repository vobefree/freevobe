import { requirePermission } from "@/lib/admin/guard";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requirePermission("projects.view");
  if ("response" in guard) return guard.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  const like = `%${q}%`;
  const rows = (q
    ? db()
        .prepare(
          `SELECT p.id, p.name, p.updated_at AS updatedAt, p.last_published_at AS publishedAt, p.shopify_theme_id AS themeId,
             u.email AS email, u.name AS owner, u.locale,
             (SELECT score FROM theme_health h WHERE h.project_id = p.id ORDER BY h.created_at DESC LIMIT 1) AS health
           FROM projects p JOIN users u ON u.id = p.user_id
           WHERE p.name LIKE ? OR u.email LIKE ? ORDER BY p.updated_at DESC LIMIT ?`,
        )
        .all(like, like, limit)
    : db()
        .prepare(
          `SELECT p.id, p.name, p.updated_at AS updatedAt, p.last_published_at AS publishedAt, p.shopify_theme_id AS themeId,
             u.email AS email, u.name AS owner, u.locale,
             (SELECT score FROM theme_health h WHERE h.project_id = p.id ORDER BY h.created_at DESC LIMIT 1) AS health
           FROM projects p JOIN users u ON u.id = p.user_id ORDER BY p.updated_at DESC LIMIT ?`,
        )
        .all(limit)) as unknown as {
    id: string;
    name: string;
    updatedAt: string;
    publishedAt: string | null;
    themeId: string | null;
    email: string;
    owner: string;
    locale: string;
    health: number | null;
  }[];

  return Response.json({
    projects: rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      updatedAt: String(row.updatedAt),
      publishedAt: row.publishedAt ? String(row.publishedAt) : null,
      themeId: row.themeId ? String(row.themeId) : null,
      email: String(row.email),
      owner: String(row.owner),
      locale: String(row.locale),
      health: row.health === null ? null : Number(row.health),
    })),
  });
}
