import Elapsed from "@/components/Elapsed";
import Flash from "@/components/Flash";
import LiveClock from "@/components/LiveClock";
import { requireEmployee, type EmployeeRow } from "@/server/auth";
import { one } from "@/server/db";
import { openPunch, punchesForMonth, shiftsBetween } from "@/server/reports";
import {
  currentMonth,
  formatDate,
  formatDateLong,
  fmtClock,
  fmtDuration,
  fmtHours,
  fmtSEK,
  formatNumber,
  hoursBetween,
  monthLabel,
  round2,
  today,
} from "@/server/time";

export const dynamic = "force-dynamic";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const params = await searchParams;
  const session = await requireEmployee();
  const employeeId = Number(String(session.sub).replace("emp:", ""));
  const month = currentMonth();
  const date = today();

  const [me, open, punches, upcoming] = await Promise.all([
    one<EmployeeRow>("SELECT * FROM employees WHERE id = ?1", [employeeId]),
    openPunch(employeeId),
    punchesForMonth(employeeId, month),
    shiftsBetween(date, addDays(date, 45), employeeId),
  ]);

  const worked = punches.filter((p) => p.clock_out);
  const monthHours = round2(
    worked.reduce((sum, p) => sum + hoursBetween(p.clock_in, p.clock_out as string), 0),
  );
  const firstName = (me?.name ?? session.name).split(" ")[0];

  return (
    <div className="stack">
      <div className="welcome-band" style={{ backgroundImage: "url('/photos/exterior.jpg')" }}>
        <div>
          <span className="script">Hej {firstName}!</span>
          <h1>{formatDateLong(date)}</h1>
          <div className="muted small">
            Klockan är <LiveClock />
          </div>
        </div>
        <div className="actions">
          <span className={`badge ${open ? "on" : "neutral"}`}>
            {open ? `Incheckad ${open.in_time}` : "Inte inklockad"}
          </span>
        </div>
      </div>

      <Flash code={params.flash} />

      <div className="grid-2">
        <section className="card clock-card">
          {open ? (
            <>
              <div className="clock-label">Incheckad kl.</div>
              <div className="clock-status">{open.in_time}</div>
              <div className="clock-elapsed">
                <Elapsed from={open.clock_in} prefix="Har jobbat i" />
              </div>
              <div className="clock-actions">
                <form method="post" action="/api/clock">
                  <input type="hidden" name="kind" value="out" />
                  <button className="btn big" type="submit">
                    Checka ut
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <div className="clock-label">Välkommen till arbetet</div>
              <div className="clock-status">Redo</div>
              <div className="muted small">Checka in när du kommer – och checka ut när du slutar.</div>
              <div className="clock-actions">
                <form method="post" action="/api/clock">
                  <input type="hidden" name="kind" value="in" />
                  <button className="btn big clock-in" type="submit">
                    Checka in
                  </button>
                </form>
              </div>
            </>
          )}
        </section>

        <div className="stack">
          <div className="grid-2">
            <div className="stat">
              <div className="label">Mina timmar {monthLabel(month)}</div>
              <div className="value">{fmtHours(monthHours)}</div>
              <div className="small muted">{worked.length} arbetade dagar</div>
            </div>
            <div className="stat">
              <div className="label">Utbetalning</div>
              <div className="value">{fmtSEK(round2(monthHours * (me?.hourly_rate ?? 0)))}</div>
              <div className="small muted">
                à {fmtHours(me?.hourly_rate ?? 0)} kr/tim
              </div>
            </div>
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Kommande pass</h2>
              <span className="small muted">{upcoming.length} st</span>
            </div>
            {upcoming.length === 0 ? (
              <div className="empty">Inga schemalagda pass just nu.</div>
            ) : (
              <ul className="list">
                {upcoming.slice(0, 8).map((shift) => (
                  <li key={shift.id}>
                    <span>
                      <strong>{formatDate(shift.date)}</strong>
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
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Mina arbetade dagar – {monthLabel(month)}</h2>
          <span className="small muted">timmarna räknas automatiskt</span>
        </div>
        {punches.length === 0 ? (
          <div className="empty">Du har ännu inte klockat in denna månad.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>In</th>
                  <th>Ut</th>
                  <th className="num">Timmar</th>
                </tr>
              </thead>
              <tbody>
                {punches.map((punch) => {
                  const hours = punch.clock_out ? round2(hoursBetween(punch.clock_in, punch.clock_out)) : 0;
                  return (
                    <tr key={punch.id}>
                      <td className="nowrap">{formatNumber(punch.in_date)}</td>
                      <td>{fmtClock(punch.in_time)}</td>
                      <td>
                        {punch.out_time ? (
                          fmtClock(punch.out_time)
                        ) : (
                          <span className="badge off">Pågår</span>
                        )}
                      </td>
                      <td className="num">{punch.clock_out ? fmtHours(hours) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Summa {worked.length} dagar</td>
                  <td className="num">{fmtHours(monthHours)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
