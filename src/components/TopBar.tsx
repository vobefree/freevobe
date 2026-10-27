"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/**
 * Gemensam topprad: logotypen till vänster, navigation + utloggning till höger.
 * Aktiv menypunkt markeras utifrån nuvarande adress.
 */
export default function TopBar({
  brandHref,
  user,
  nav,
  sublabel,
}: {
  brandHref: string;
  user: { name: string; role: string };
  nav: NavItem[];
  sublabel: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="topbar no-print">
      <div className="shell topbar-inner">
        <Link href={brandHref} className="brand">
          <img src="/logo.png" alt="Forshems Gästgiveri" />
          <span className="brand-sub">{sublabel}</span>
        </Link>
        <nav className="nav">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? "active" : undefined}>
              {item.label}
            </Link>
          ))}
          <span className="who">{user.name}</span>
          <form method="post" action="/api/logout">
            <button className="btn secondary" type="submit">
              Logga ut
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
