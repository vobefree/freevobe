import { requireAdmin } from "@/server/auth";
import Footer from "@/components/Footer";
import TopBar from "@/components/TopBar";

export const metadata = { title: "Administration" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <>
      <TopBar
        brandHref="/admin"
        sublabel="Administration"
        user={{ name: session.name, role: "admin" }}
        nav={[
          { href: "/admin", label: "Översikt" },
          { href: "/admin/anstallda", label: "Anställda" },
          { href: "/admin/schema", label: "Schema" },
          { href: "/admin/rapporter", label: "Rapporter" },
          { href: "/admin/qrkod", label: "QR-kod" },
        ]}
      />
      <main className="page">
        <div className="shell">{children}</div>
        <div className="shell">
          <Footer />
        </div>
      </main>
    </>
  );
}
