import { headers } from "next/headers";
import PrintButton from "@/components/PrintButton";
import { requireAdmin } from "@/server/auth";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";
export const metadata = { title: "QR-kod" };

/** Systemets adress: APP_URL om satt, annars härledd från anropet. */
async function systemUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Utskriftsklar QR-kod att hänga på väggen där stämpelklockan stod:
 * personalen skannar med kameran och landar direkt på inloggningen.
 */
export default async function QrPage() {
  await requireAdmin();
  const url = `${await systemUrl()}/`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 512,
    errorCorrectionLevel: "M",
    color: { dark: "#2f2b26ff", light: "#00000000" },
  });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="script">QR-kod</span>
          <h1>Skanna för att checka in</h1>
          <div className="muted small">
            Skriv ut, laminera och häng på väggen där stämpelklockan stod. Personalen skannar med
            mobilens kamera och landar direkt på inloggningen.
          </div>
        </div>
        <div className="actions">
          <PrintButton label="Skriv ut" />
        </div>
      </div>

      <section className="card qr-sheet">
        <img className="qr-logo" src="/logo.png" alt="Forshems Gästgiveri" />
        <div className="qr-title">Inklockning</div>
        <div className="qr-lead">Skanna med kameran och logga in med ditt användarnamn och PIN.</div>
        <div className="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="qr-url">{url}</div>
        <div className="qr-foot">Forshems Gästgiveri – anno 1564</div>
      </section>
    </div>
  );
}
