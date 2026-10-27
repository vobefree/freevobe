import Link from "next/link";
import Flash from "@/components/Flash";
import { DeleteShift } from "@/components/ConfirmSubmit";
import { listEmployees } from "@/server/auth";
import { shiftsForMonth } from "@/server/reports";
import {
  currentMonth,
  formatDate,
  monthGrid,
  monthLabel,
  shiftMonth,
  today,
} from "@/server/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schema" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DOW = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];

export default async function SchemaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; flash?: string }>;
}) {
  const params = await searchParams;
  const month = params.month && MONTH_RE.test(params.month) ? params.month : currentMonth();
  const [shifts, employees] = await Promise.all([shiftsForMonth(month), listEmployees(false)]);

  const byDay = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const list = byDay.get(shift.date) ?? [];
    list.push(shift);
    byDay.set(shift.date, list);
  }

  const grid = monthGrid(month);
  const date = today();
  const defaultDate = date.startsWith(month) ? date : `${month}-01`;
  const daysWithShifts = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="script">Vem jobbar när?</span>
          <h1>Schema</h1>
          <div className="muted small">Schemalägg pass på timme – anställda ser dem direkt efter inlogg.</div>
        </div>
        <div className="actions month-nav">
          <Link className="btn secondary" href={`/admin/schema?month=${shiftMonth(month, -1)}`}>
            ‹ Föregående
          </Link>
          <span className="m">{monthLabel(month)}</span>
          <Link className="btn secondary" href={`/admin/schema?month=${shiftMonth(month, 1)}`}>
            Nästa ›
          </Link>
        </div>
      </div>

      <Flash code={params.flash} />

      <section className="card">
        <div className="card-head">
          <h2>Lägg ett pass</h2>
          <span className="small muted">{shifts.length} pass denna månad</span>
        </div>
        {employees.length === 0 ? (
          <div className="empty">
            Du behöver först lägga till en anställd –{" "}
            <Link href="/admin/anstallda">gör det här</Link>.
          </div>
        ) : (
          <form method="post" action="/api/admin/shifts">
            <div className="form-grid">
              <div className="field wide">
                <label htmlFor="employee_id">Anställd</label>
                <select id="employee_id" name="employee_id" required>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.username})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="date">Datum</label>
                <input id="date" name="date" type="date" defaultValue={defaultDate} required />
              </div>
              <div className="field">
                <label htmlFor="start_time">Start</label>
                <input id="start_time" name="start_time" type="time" defaultValue="09:00" required />
              </div>
              <div className="field">
                <label htmlFor="end_time">Slut</label>
                <input id="end_time" name="end_time" type="time" defaultValue="15:00" required />
              </div>
              <div className="field">
                <label htmlFor="note">Anteckning (valfritt)</label>
                <input id="note" name="note" placeholder="t.ex. middagssittning" />
              </div>
              <div className="field" style={{ justifyContent: "flex-end" }}>
                <button className="btn" type="submit">
                  Schemalägg
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{monthLabel(month)}</h2>
          <Link className="small" href={`/admin/rapporter?m=${month}`}>
            Till rapporten
          </Link>
        </div>

        <div className="calendar">
          {DOW.map((day) => (
            <div className="dow" key={day}>
              {day}
            </div>
          ))}
          {grid.flatMap((week, weekIndex) =>
            week.map((day, dayIndex) => {
              if (!day) {
                return <div className="day is-empty" key={`${weekIndex}-${dayIndex}`} />;
              }
              const dayShifts = byDay.get(day) ?? [];
              return (
                <div className={`day${day === date ? " today" : ""}`} key={day}>
                  <span className="daynum">{Number(day.slice(8))}</span>
                  {dayShifts.map((shift) => (
                    <div className="shift-chip" key={shift.id}>
                      <span className="name">{shift.name}</span>
                      <span className="time">
                        {shift.start_time}–{shift.end_time}
                      </span>
                      <DeleteShift id={shift.id} />
                    </div>
                  ))}
                </div>
              );
            }),
          )}
        </div>

        {shifts.length > 0 ? (
          <div className="mobile-shifts">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Anställd</th>
                    <th>Tid</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {daysWithShifts.flatMap(([day, dayShifts]) =>
                    dayShifts.map((shift, index) => (
                      <tr key={shift.id}>
                        <td>{index === 0 ? formatDate(day) : ""}</td>
                        <td>{shift.name}</td>
                        <td className="nowrap">
                          {shift.start_time}–{shift.end_time}
                        </td>
                        <td className="right">
                          <DeleteShift id={shift.id} />
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {shifts.length === 0 ? (
          <div className="empty">Inga pass schemalagda {monthLabel(month)} ännu.</div>
        ) : null}
      </section>
    </div>
  );
}
