"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavId, Permission } from "@/lib/admin/permissions";

type Props = {
  base: string;
  items: { id: AdminNavId; label: string; href: string; permission: Permission }[];
  roleLabel: string;
  email: string;
};

export function AdminNav({ base, items, roleLabel, email }: Props) {
  const pathname = usePathname();
  return (
    <nav className="adm-nav" aria-label="Adminpanelen">
      <span className="adm-nav__identity">
        <b>{roleLabel}</b>
        <small>{email}</small>
      </span>
      <div className="adm-nav__links">
        {items.map((item) => {
          const href = `${base}${item.href}`;
          const active = item.href === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link key={item.id} className={`adm-nav__link${active ? " is-active" : ""}`} href={href}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
