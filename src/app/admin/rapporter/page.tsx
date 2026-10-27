import Link from "next/link";
import Flash from "@/components/Flash";
import { buildMonthReport } from "@/server/reports";
import {
  currentMonth,
  fmtClock,
  fmtHours,
  fmtSEK,
  formatNumber,
  monthLabel,
  shiftMonth,
} from "@/server/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timrapporter" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; flash?: string }>;
}) {
  const params = await searchParams;
  const month = params.m && MONTH_RE.test(params.m) ? params.m : currentMonth();
  const report = await buildMonthReport(month);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="script">Månadens timmar</span>
          <h1>Timrapport – {monthLabel(month)}</h1>
          <div className="muted small">
            Timmarna räknas automatiskt ut av varje anställds in- och utcheckningar.
          </div>
        </div>
        <div className="actions row">
          <div className="month-nav">
            <Link className="btn secondary" href={`/admin/rapporter?m=${shiftMonth(month, -1)}`}>
              ‹
            </Link>
            <Link className="btn secondary" href={`/admin/rapporter`}>
              Denna månad
            </Link>
            <Link className="btn secondary" href={`/admin/rapporter?m=${shiftMonth(month, 1)}`}>
              ›
            </Link>
          </div>
          <Link className="btn" href={`/admin/rapporter/utskrift?m=${month}`}>
            Skriv ut total rapport
          </Link>
        </div>
      </div>

      <Flash code={params.flash} />

      {report.totals.openPunches > 0 ? (
        <div className="notice error">
          {report.totals.openPunches} inklockning{report.totals.openPunches === 1 ? "" : "ar"} saknar
          utcheckning och ingår inte i summan. Låt den anställda checka ut först.
        </div>
      ) : null}

      <div className="grid-3">
        <div className="stat">
          <div className="label">Totalt arbetade timmar</div>
          <div className="value">{fmtHours(report.totals.hours)}</div>
        </div>
        <div className="stat">
          <div className="label">Total ersättning</div>
          <div className="value">{fmtSEK(report.totals.amount)}</div>
        </div>
        <div className="stat">
          <div className="label">Arbetade dagar</div>
          <div className="value">{report.totals.workedDays}</div>
          <div className="small muted">fördelat på {report.totals.employees} anställda</div>
        </div>
      </div>

      {report.employees.map((employee) => (
        <section className="card" key={employee.id}>
          <div className="card-head">
            <div>
              <h2>{employee.name}</h2>
              <div className="small muted">
                {employee.username} · timlön {employee.rate.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} kr
              </div>
            </div>
            <div className="right">
              <div style={{ fontSize: 22, fontWeight: 300 }}>{fmtHours(employee.hours)} tim</div>
              <div className="small muted">{fmtSEK(employee.amount)}</div>
            </div>
          </div>

          {employee.days.length === 0 ? (
            <div className="empty">Inga inklockningar denna månad.</div>
          ) : (
            <div className="table-wrap">
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
                      <td>
                        {day.outTime ? (
                          fmtClock(day.outTime)
                        ) : (
                          <span className="badge off">Pågår</span>
                        )}
                      </td>
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
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
