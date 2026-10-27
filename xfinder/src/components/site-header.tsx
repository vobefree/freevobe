import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/ai", label: "Öva med AI" },
  { href: "/kompanjor", label: "Hitta kompanjon" },
  { href: "/status", label: "Systemstatus" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            X
          </span>
          <span className="text-base font-semibold tracking-tight">Xfinder</span>
          <Badge variant="muted" className="hidden sm:inline-flex">
            arbetsnamn
          </Badge>
        </Link>

        <nav aria-label="Huvudmeny" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <Button asChild size="sm">
          <Link href="/logga-in">Logga in</Link>
        </Button>
      </div>
    </header>
  );
}
