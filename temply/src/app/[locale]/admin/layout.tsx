import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import "@/app/admin.css";
import "@/app/admin-panels.css";
import { getCurrentUser, sessionVerified } from "@/lib/auth";
import { lockSecondsLeft, mfaRequired, mfaState } from "@/lib/admin/mfa";
import { getInsightsStrings } from "@/lib/i18n/insights";
import { isLocale } from "@/lib/theme/types";
import { NAV } from "@/lib/admin/permissions";
import { identityFor } from "@/lib/staff";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminLoginGate } from "@/components/admin/AdminLoginGate";
import { Brand } from "@/components/marketing/Brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "ThemeFold · Control", robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const mfaOn = mfaRequired();
  const user = await getCurrentUser();

  // Egen inloggning för panelen: e-post, lösenord och kod från autentiseraren.
  if (!user) {
    if (mfaOn) {
      return <AdminLoginGate signedIn={false} email={null} roleLabel={null} enrolled={false} recoveryLeft={0} lockSeconds={0} locale={locale} />;
    }
    redirect(`/${locale}/login`);
  }

  const identity = identityFor(user);
  const strings = getInsightsStrings(locale);

  if (!identity) {
    return (
      <div className="adm adm--locked">
        <div className="adm-lock">
          <h1>{strings.adminNoAccess}</h1>
          <p>{strings.adminNoAccessBody}</p>
          <Link className="adm-btn" href={`/${locale}/dashboard`}>
            {strings.adminBack}
          </Link>
        </div>
      </div>
    );
  }

  // Tvåfaktorskod krävs innan panelen visas, även för en inloggad ägare.
  if (mfaOn && !(await sessionVerified())) {
    const state = mfaState(user.id);
    return (
      <AdminLoginGate
        signedIn
        email={user.email}
        roleLabel={identity.roleLabel}
        enrolled={state.enrolled}
        recoveryLeft={state.recoveryLeft}
        lockSeconds={lockSecondsLeft(user.id)}
        locale={locale}
      />
    );
  }

  const items = NAV.filter((item) => identity.permissions.includes(item.permission));
  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-brand">
          <Brand href={`/${locale}`} />
          <span className="adm-brand__tag">{strings.adminControl}</span>
        </div>
        <div className="adm-top__right">
          <span className="adm-secure">{mfaOn ? "Tvåfaktor · på" : "Tvåfaktor · av"}</span>
          <Link className="adm-btn adm-btn--ghost" href={`/${locale}/dashboard`}>
            {strings.adminBack}
          </Link>
        </div>
      </header>
      <AdminNav base={`/${locale}/admin`} items={items} roleLabel={identity.roleLabel} email={user.email} />
      {children}
    </div>
  );
}
