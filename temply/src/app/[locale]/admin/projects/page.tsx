import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { isLocale } from "@/lib/theme/types";
import { ProjectsPanel } from "@/components/admin/ProjectsPanel";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await guardAdminPage(locale, "projects.view"))) return null;
  return <ProjectsPanel />;
}
