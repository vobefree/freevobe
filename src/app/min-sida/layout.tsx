import { requireEmployee } from "@/server/auth";
import Footer from "@/components/Footer";
import TopBar from "@/components/TopBar";

export const metadata = { title: "Min sida" };

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await requireEmployee();
  return (
    <>
      <TopBar
        brandHref="/min-sida"
        sublabel="Inklockning"
        user={{ name: session.name, role: "employee" }}
        nav={[{ href: "/min-sida", label: "Mina pass" }]}
      />
      <main className="page">
        <div className="shell">{children}</div>
        <div className="shell">
          <Footer adminLink />
        </div>
      </main>
    </>
  );
}
