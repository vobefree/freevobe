import PrintButton from "@/components/PrintButton";
import { buildMonthReport } from "@/server/reports";
import { currentMonth, fmtClock, fmtHours, fmtSEK, formatDate, formatNumber, monthLabel, today } from "@/server/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utskrift – månadsrapport" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Utskriftsklar totalrapport: alla anställda, alla arbetade dagar,
 * timmar och ersättning – klart att skriva ut och signera.
 */
export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const params = await searchParams;
  const month = params.m && MONTH_RE.test(params.m) ? params.m : currentMonth();
  const report = await buildMonthReport(month);
  const printed = today();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="script">Utskrift</span>
          <h1>Total rapport – {monthLabel(month)}</h1>
          <div className="muted small">Alla arbetade dagar, timmar och ersättning för månaden.</div>
        </div>
        <div className="actions">
          <PrintButton label="Skriv ut" />
        </div>
      </div>

      <div className="print-header">
        <img src="/logo.png" alt="Forshems Gästgiveri" />
        <div className="print-title">
          <div className="t">Månadsrapport – {monthLabel(month)}</div>
          <div className="s">Alla arbetade dagar · utskriven {formatDate(printed, { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
      </div>

      {report.employees.map((employee) => (
        <section className="card report-section" key={employee.id}>
          <div className="card-head">
            <div>
              <h2>{employee.name}</h2>
              <div className="small muted">
                {employee.username} · timlön {employee.rate.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} kr
              </div>
            </div>
            <div className="right">
              <div style={{ fontSize: 20, fontWeight: 300 }}>{fmtHours(employee.hours)} tim</div>
              <div className="small muted">{fmtSEK(employee.amount)}</div>
            </div>
          </div>

          {employee.days.length === 0 ? (
            <div className="empty">Inga inklockningar denna månad.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Incheckad</th>
                  <th>Utcheckad</th>
                  <th className="num">Timmar</th>
                  <th className="num">Belopp</th>
                </tr>
              </thead>
              <tbody>
                {employee.days.map((day) => (
                  <tr key={day.entryId}>
                    <td className="nowrap">{formatNumber(day.date)}</td>
                    <td>{fmtClock(day.inTime)}</td>
                    <td>{day.outTime ? fmtClock(day.outTime) : "pågår"}</td>
                    <td className="num">{day.open ? "–" : fmtHours(day.hours)}</td>
                    <td className="num">{day.open ? "–" : fmtSEK(day.hours * employee.rate)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Summa {employee.days.length} dagar</td>
                  <td className="num">{fmtHours(employee.hours)}</td>
                  <td className="num">{fmtSEK(employee.amount)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>
      ))}

      <section className="card report-section">
        <div className="card-head">
          <h2>Totalt för månaden</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Anställd</th>
              <th className="num">Dagar</th>
              <th className="num">Timmar</th>
              <th className="num">Ersättning</th>
            </tr>
          </thead>
          <tbody>
            {report.employees
              .filter((employee) => employee.days.length > 0)
              .map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td className="num">{employee.days.length}</td>
                  <td className="num">{fmtHours(employee.hours)}</td>
                  <td className="num">{fmtSEK(employee.amount)}</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Totalt</td>
              <td className="num">{report.totals.workedDays}</td>
              <td className="num">{fmtHours(report.totals.hours)}</td>
              <td className="num">{fmtSEK(report.totals.amount)}</td>
            </tr>
          </tfoot>
        </table>
        {report.totals.openPunches > 0 ? (
          <p className="small" style={{ marginTop: 10 }}>
            * {report.totals.openPunches} pågående inklockning(ar) ingår inte i summan.
          </p>
        ) : null}
      </section>

      <div className="signature">
        <div className="line">Arbetsledarens underskrift</div>
        <div className="line">Anställds underskrift</div>
      </div>
    </div>
  );
}
