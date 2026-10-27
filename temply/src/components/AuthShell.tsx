import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/theme/types";
import { Brand } from "./marketing/Brand";

export function AuthShell({ locale, dict, title, subtitle, children }: { locale: Locale; dict: Dict; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <Brand href={`/${locale}`} />
        <div>
          <p className="auth-aside__quote">“{dict.landing.easyTitle}”</p>
          <p className="auth-aside__small">{dict.landing.footerTag}</p>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "rgba(253,250,242,.6)", flexWrap: "wrap" }}>
          <span>3 {dict.landing.s3l}</span>
          <span>·</span>
          <span>{dict.landing.s2v} {dict.landing.s2l}</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div style={{ marginBottom: 26, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Brand href={`/${locale}`} />
            <Link href={`/${locale}`} style={{ fontSize: 11.5, color: "var(--sub)", textDecoration: "underline" }}>
              {dict.common.back}
            </Link>
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
