import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import { getSession } from "@/server/auth";

export const metadata = { title: "Inloggning – Forshems Gästgiveri" };

const MESSAGES: Record<string, { text: string; kind: "error" | "ok" }> = {
  "logga-in": { text: "Du måste logga in för att komma åt den sidan.", kind: "error" },
  fel: { text: "Fel användarnamn eller lösenord. Försök igen.", kind: "error" },
  av: { text: "Du är utloggad.", kind: "ok" },
  stangd: { text: "Kontot är avstängt. Kontakta arbetsledaren.", kind: "error" },
};

const PHOTOS = [
  { src: "/photos/exterior.jpg", alt: "Forshems Gästgivaregård" },
  { src: "/photos/interior.jpg", alt: "Gästgivaregårdens matsalar" },
  { src: "/photos/mat.jpg", alt: "Matsyr i köket" },
  { src: "/photos/trädgård.jpg", alt: "Gården runt gästgivaregården" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fel?: string; kind?: string; admin?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(session.role === "admin" ? "/admin" : "/min-sida");

  const params = await searchParams;
  const notice = params.fel ? MESSAGES[params.fel] : undefined;
  const adminMode = params.admin === "1" || params.kind === "admin";

  return (
    <main className="login-screen">
      <div className="login-bg" aria-hidden>
        {PHOTOS.map((photo, i) => (
          <img key={photo.src} src={photo.src} alt="" style={{ animationDelay: `${i * 6}s` }} />
        ))}
        <div className="login-bg-caption">
          <span className="script">Välkommen till</span>
          <strong>Forshems Gästgivaregård</strong>
          <em>anno 1564</em>
        </div>
      </div>

      <div className="login-panel">
        <img className="login-logo" src="/logo.png" alt="Forshems Gästgiveri" />
        <div className="login-tag">Inklockning · Schema · Timrapporter</div>

        {notice ? <div className={`notice ${notice.kind === "ok" ? "ok" : "error"}`}>{notice.text}</div> : null}

        <section className="login-form">
          {adminMode ? (
            <>
              <h2>Administration</h2>
              <div className="sub">Lägg till anställda, schemalägg pass och se månadsrapporter.</div>
              <form method="post" action="/api/login">
                <input type="hidden" name="kind" value="admin" />
                <div className="field">
                  <label htmlFor="adm-user">Användarnamn</label>
                  <input id="adm-user" name="username" autoComplete="username" required autoFocus />
                </div>
                <div className="field">
                  <label htmlFor="adm-pass">Lösenord</label>
                  <input
                    id="adm-pass"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <button className="btn block" type="submit">
                  Logga in
                </button>
              </form>
              <div className="login-back">
                <a href="/">← Till anställds inloggning</a>
              </div>
            </>
          ) : (
            <>
              <h2>Anställd</h2>
              <div className="sub">Se dina pass och checka in och ut när du kommer och slutar.</div>
              <form method="post" action="/api/login">
                <input type="hidden" name="kind" value="employee" />
                <div className="field">
                  <label htmlFor="emp-user">Användarnamn</label>
                  <input id="emp-user" name="username" autoComplete="username" required autoFocus />
                </div>
                <div className="field">
                  <label htmlFor="emp-pin">PIN-kod</label>
                  <input
                    id="emp-pin"
                    name="password"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    required
                  />
                  <span className="hint">Fråga chefen om du inte har ditt PIN.</span>
                </div>
                <button className="btn block" type="submit">
                  Logga in
                </button>
              </form>
            </>
          )}
        </section>

        <p className="small muted login-note">
          Systemet används enbart av gästgivaregårdens personal.
        </p>
        <Footer adminLink />
      </div>
    </main>
  );
}
