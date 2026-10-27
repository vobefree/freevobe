import Link from "next/link";
import Flash from "@/components/Flash";
import { listEmployees } from "@/server/auth";
import { buildMonthReport, shiftsBetween, whoIsClockedIn } from "@/server/reports";
import { currentMonth, formatDate, formatDateLong, fmtDuration, fmtHours, fmtSEK, monthLabel, nowClock, today } from "@/server/time";

export const dynamic = "force-dynamic";

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const params = await searchParams;
  const date = today();
  const month = currentMonth();

  const [clockedIn, todaysShifts, report, employees] = await Promise.all([
    whoIsClockedIn(),
    shiftsBetween(date, date),
    buildMonthReport(month),
    listEmployees(false),
  ]);

  const openPunches = report.totals.openPunches;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="script">God dag</span>
          <h1>Översikt</h1>
          <div className="muted small">{formatDateLong(date)} · klockan {nowClock()}</div>
        </div>
        <div className="row actions">
          <Link className="btn secondary" href="/admin/schema">
            Schemalägg pass
          </Link>
          <Link className="btn" href="/admin/rapporter">
            Månadsrapport
          </Link>
        </div>
      </div>

      <Flash code={params.flash} />

      <div className="grid-3">
        <div className="stat">
          <div className="label">Incheckade nu</div>
          <div className="value">{clockedIn.length}</div>
        </div>
        <div className="stat">
          <div className="label">Pass idag</div>
          <div className="value">{todaysShifts.length}</div>
        </div>
        <div className="stat">
          <div className="label">Timmar {monthLabel(month).toLowerCase()}</div>
          <div className="value">{fmtHours(report.totals.hours)}</div>
          <div className="small muted">{fmtSEK(report.totals.amount)} i ersättning</div>
        </div>
      </div>

      {openPunches > 0 ? (
        <div className="notice error">
          {openPunches} inklockning{openPunches === 1 ? "" : "ar"} saknar utcheckning och räknas ännu inte in
          i rapporten. Be den anställda checka ut från sin sida.
        </div>
      ) : null}

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Incheckade nu</h2>
            <span className="badge on">{clockedIn.length} på plats</span>
          </div>
          {clockedIn.length === 0 ? (
            <div className="empty">Ingen är inklockad just nu.</div>
          ) : (
            <ul className="list">
              {clockedIn.map((person) => (
                <li key={person.id}>
                  <span>
                    <strong>{person.name}</strong>
                    <span className="muted small"> · incheckad {person.clockIn}</span>
                  </span>
                  <span className="when">{fmtDuration(person.hours)} på jobbet</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Pass idag</h2>
            <Link className="small" href={`/admin/schema?month=${month}`}>
              Öppna schemat
            </Link>
          </div>
          {todaysShifts.length === 0 ? (
            <div className="empty">Inga pass schemalagda denna dag.</div>
          ) : (
            <ul className="list">
              {todaysShifts.map((shift) => (
                <li key={shift.id}>
                  <span>
                    <strong>{shift.name}</strong>
                    {shift.note ? <span className="muted small"> · {shift.note}</span> : null}
                  </span>
                  <span className="when">
                    {shift.start_time}–{shift.end_time}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Snabbt</h2>
          <span className="small muted">{employees.length} anställda i systemet</span>
        </div>
        <div className="row">
          <Link className="btn secondary" href="/admin/anstallda">
            Hantera anställda
          </Link>
          <Link className="btn secondary" href="/admin/anstallda?ny=1">
            Lägg till anställd
          </Link>
          <Link className="btn secondary" href={`/admin/rapporter?m=${month}`}>
            Timrapporter
          </Link>
        </div>
      </section>
    </div>
  );
}
