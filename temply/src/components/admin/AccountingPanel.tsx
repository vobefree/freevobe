"use client";

import { useCallback, useEffect, useState } from "react";
import type { Period, VatReport } from "@/lib/accounting/bookings";

type Props = {
  initialPeriod: Period;
  initialReport: VatReport;
  config: {
    companyName: string;
    orgNumber: string;
    vatNumber: string;
    pricesInclVat: boolean;
    vatRate: number;
    stripeVat: "reverse" | "none";
    stripeFeePercent: number;
  };
  canExport: boolean;
};

type Payload = { period: Period; report: VatReport };

function money(value: number): string {
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function monthLabel(month: string): string {
  const [year, index] = month.split("-");
  const names = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${names[Number(index) - 1] ?? index} ${year.slice(2)}`;
}

function thisMonth(): Period {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: first.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

function lastMonth(): Period {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

function thisYear(): Period {
  const year = new Date().getFullYear();
  const today = new Date();
  return { from: `${year}-01-01`, to: today.toISOString().slice(0, 10) };
}

export function AccountingPanel({ initialPeriod, initialReport, config, canExport }: Props) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [report, setReport] = useState<VatReport>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/economy/accounting?format=json&from=${range.from}&to=${range.to}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Kunde inte hämta underlaget.");
        return;
      }
      const json = (await res.json()) as Payload;
      setReport(json.report);
    } catch {
      setError("Nätverket svarade inte.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (period.from > period.to) return;
    void load(period);
  }, [period, load]);

  const link = (format: string) => `/api/admin/economy/accounting?format=${format}&from=${period.from}&to=${period.to}`;
  const months = report.months;
  const companyReady = Boolean(config.orgNumber.trim());

  return (
    <section className="adm-section ac">
      <div className="adm-section__head">
        <div>
          <h2>Bokföring</h2>
          <p>
            Underlag för svensk redovisning: SIE4 till Fortnox, Visma, Bokio eller Björn Lundén, momsrapport med Skatteverkets rutor och en
            verifikationslista för arkivet.
          </p>
        </div>
        <div className="adm-row">
          <a className={`adm-btn${canExport ? "" : " is-disabled"}`} href={link("sie4")} aria-disabled={!canExport}>
            SIE4
          </a>
          <a className="adm-btn adm-btn--ghost" href={link("verifikat")}>
            Verifikationer
          </a>
          <a className="adm-btn adm-btn--ghost" href={link("moms")}>
            Momsrapport
          </a>
          <a className="adm-btn adm-btn--ghost" href={link("underlag")}>
            Underlag
          </a>
        </div>
      </div>

      <div className="ac-period">
        <label className="adm-field">
          <span>Från</span>
          <input
            className="adm-input"
            type="date"
            value={period.from}
            onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))}
          />
        </label>
        <label className="adm-field">
          <span>Till</span>
          <input
            className="adm-input"
            type="date"
            value={period.to}
            onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
        <div className="adm-row">
          <button className="adm-chip" type="button" onClick={() => setPeriod(thisMonth())}>
            Denna månad
          </button>
          <button className="adm-chip" type="button" onClick={() => setPeriod(lastMonth())}>
            Förra månaden
          </button>
          <button className="adm-chip" type="button" onClick={() => setPeriod(thisYear())}>
            I år
          </button>
        </div>
        <span className="cn-spacer" />
        {loading && <span className="adm-empty">Räknar…</span>}
      </div>

      {error && <div className="adm-toast adm-toast--error">{error}</div>}

      {report.missingRates.length > 0 && (
        <div className="adm-toast adm-toast--error">
          Saknar växelkurs för {report.missingRates.join(", ")} – de betalningarna kan inte räknas om till SEK. Lägg in kursen under
          API-nycklar → Bokföring.
        </div>
      )}

      {!companyReady && (
        <div className="adm-toast">
          Fyll i organisationsnummer och företagsnamn under API-nycklar → Bokföring innan du importerar SIE-filen i bokföringsprogrammet.
        </div>
      )}

      <div className="adm-kpis">
        <div className="adm-kpi">
          <span>Försäljning brutto</span>
          <b>{money(report.totals.salesGrossSek)} kr</b>
          <small>{report.totals.payments} betalningar i perioden</small>
        </div>
        <div className="adm-kpi">
          <span>Netto exkl. moms</span>
          <b>{money(report.totals.salesNetSek)} kr</b>
          <small>{report.totals.exportNetSek > 0 ? `${money(report.totals.exportNetSek)} kr utanför Sverige` : "svensk moms på allt"}</small>
        </div>
        <div className="adm-kpi">
          <span>Utgående moms</span>
          <b>{money(report.totals.salesVatSek)} kr</b>
          <small>{config.pricesInclVat ? "priser inkl. moms" : "priser exkl. moms"}</small>
        </div>
        <div className="adm-kpi">
          <span>Stripe-avgifter</span>
          <b>{money(report.totals.feeNetSek)} kr</b>
          <small>
            {config.stripeVat === "reverse"
              ? `+ ${money(report.totals.feeVatSek)} kr moms med omvänd skattskyldighet`
              : "ingen moms på avgiften"}
          </small>
        </div>
        <div className="adm-kpi">
          <span>Moms att betala</span>
          <b>{money(report.totals.vatToPay)} kr</b>
          <small>ruta 49 för perioden</small>
        </div>
      </div>

      <div className="adm-panel">
        <div className="adm-panel__head">
          <span>Momsrapport</span>
          <small>
            {period.from} – {period.to}
          </small>
        </div>
        <div className="ac-table-wrap">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Ruta</th>
                {months.map((month) => (
                  <th key={month.month}>{monthLabel(month.month)}</th>
                ))}
                <th>Period</th>
              </tr>
            </thead>
            <tbody>
              {report.boxes.map((box, index) => (
                <tr key={box.code}>
                  <th scope="row">
                    <b>{box.code}</b>
                    <span>{box.label}</span>
                  </th>
                  {months.map((month) => (
                    <td key={month.month}>{money(month.boxes[index]?.value ?? 0)}</td>
                  ))}
                  <td className="ac-total">{money(box.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-grid adm-grid--two">
        <div className="adm-panel">
          <div className="adm-panel__head">
            <span>Så bokförs det</span>
            <small>automatiskt</small>
          </div>
          <div className="ac-note">
            <b>Försäljning</b>
            <p>
              Debet {config.stripeVat === "reverse" ? "1580 fordran hos Stripe" : "1930"} med bruttobeloppet, kredit 3041 försäljning och 2611
              utgående moms 25 %. Priser som visas för konsument är inklusive moms, så momsen räknas ut som 20 % av bruttobeloppet (25/125).
            </p>
          </div>
          <div className="ac-note">
            <b>Stripe-avgiften</b>
            <p>
              {config.stripeVat === "reverse"
                ? "Stripe Payments Europe (Irland) fakturerar utan irländsk moms. Avgiften bokförs som inköp av tjänst från annat EU-land med omvänd skattskyldighet: debet 4535 och 2645, kredit 2614, så ruta 21, 30 och 48 tar ut varandra."
                : "Avgiften bokförs som bankkostnad på 6570 utan moms."}
            </p>
          </div>
          <div className="ac-note">
            <b>Betalningar utanför Sverige</b>
            <p>
              Valutor som är satta till 0 % moms bokförs som export på 3045 och redovisas i ruta 40. Under OSS-tröskeln (99 680 kr) får
              svensk moms användas för EU-konsumenter – ändra momsen per valuta om du väljer OSS i stället.
            </p>
          </div>
        </div>

        <div className="adm-panel">
          <div className="adm-panel__head">
            <span>Underlaget</span>
            <small>{config.companyName}</small>
          </div>
          <div className="adm-rowitem">
            <span>Momssats i Sverige</span>
            <b>{config.vatRate} %</b>
          </div>
          <div className="adm-rowitem">
            <span>Stripe-avgift</span>
            <b>{config.stripeFeePercent} % + fast avgift</b>
          </div>
          <div className="adm-rowitem">
            <span>Priser</span>
            <b>{config.pricesInclVat ? "inklusive moms" : "exklusive moms"}</b>
          </div>
          <div className="adm-rowitem">
            <span>Momsregistrering</span>
            <b>{config.vatNumber || "saknas"}</b>
          </div>
          <div className="adm-rowitem">
            <span>Betalningar</span>
            <b>{report.totals.payments}</b>
            <small>{report.totals.refunds} återbetalningar</small>
          </div>
          <p className="ac-legend">
            SIE-filen innehåller kontoplan, ingående och utgående balans samt alla verifikationer för perioden. Varje verifikation har
            serie och löpnummer, så den kan importeras direkt utan att numreringen krockar. Filen är i ren ASCII med PC8-deklaration och
            öppnas därför även i äldre program.
          </p>
        </div>
      </div>
    </section>
  );
}
