import { notFound } from "next/navigation";
import "@/app/admin.css";
import "@/app/admin-panels.css";
import { isLocale } from "@/lib/theme/types";
import { StaffJoin } from "@/components/admin/StaffJoin";

export const dynamic = "force-dynamic";
export const metadata = { title: "ThemeFold · Personal", robots: { index: false, follow: false } };

export default async function StaffJoinPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  return <StaffJoin token={token} locale={locale} />;
}
