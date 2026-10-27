import Link from "next/link";
import { notFound } from "next/navigation";
import Flash from "@/components/Flash";
import { one, all } from "@/server/db";
import type { EmployeeRow } from "@/server/auth";
import type { PunchRow } from "@/server/reports";
import { fmtHours, fmtRate, fmtSEK, formatNumber, fmtClock, hoursBetween, round2 } from "@/server/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ändra anställd" };

export default async function EditEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  const { id: idParam } = await params;
  const { flash } = await searchParams;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const employee = await one<EmployeeRow>("SELECT * FROM employees WHERE id = ?1", [id]);
  if (!employee) notFound();

  const punches = await all<PunchRow>(
    "SELECT * FROM time_entries WHERE employee_id = ?1 ORDER BY clock_in DESC LIMIT 14",
    [id],
  );

  const totalMonth = punches.reduce((sum, punch) => {
    if (!punch.clock_out) return sum;
    return sum + hoursBetween(punch.clock_in, punch.clock_out);
  }, 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="script">{employee.name}</span>
          <h1>Ändra anställd</h1>
        </div>
        <div className="actions">
          <Link className="btn secondary" href="/admin/anstallda">
            Tillbaka
          </Link>
        </div>
      </div>

      <Flash code={flash} />

      <section className="card">
        <form method="post" action={`/api/admin/employees/${employee.id}`}>
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="name">Namn</label>
              <input id="name" name="name" defaultValue={employee.name} required />
            </div>
            <div className="field">
              <label htmlFor="username">Användarnamn</label>
              <input id="username" name="username" defaultValue={employee.username} required autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="hourly_rate">Timlön (kr)</label>
              <input
                id="hourly_rate"
                name="hourly_rate"
                inputMode="decimal"
                defaultValue={String(employee.hourly_rate).replace(".", ",")}
                required
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="pin">Nytt PIN (valfritt)</label>
              <input
                id="pin"
                name="pin"
                inputMode="numeric"
                pattern="\d{4,8}"
                placeholder="Lämna tomt för att behålla"
                autoComplete="off"
              />
              <span className="hint">4–8 siffror. Lämna tomt om PIN-koden ska vara som den är.</span>
            </div>
            <div className="field">
              <label htmlFor="active">Status</label>
              <select id="active" name="active" defaultValue={employee.active ? "1" : "0"}>
                <option value="1">Aktiv – får logga in</option>
                <option value="0">Inaktiv – avstängd</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <button className="btn" type="submit">
                Spara
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Senaste inklockningar</h2>
          <span className="small muted">
            {punches.length === 0 ? "inga ännu" : `${fmtHours(round2(totalMonth))} tim senaste 14 posterna`}
          </span>
        </div>
        {punches.length === 0 ? (
          <div className="empty">Hittade inga inklockningar ännu.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>In</th>
                  <th>Ut</th>
                  <th className="num">Timmar</th>
                  <th className="num">Belopp</th>
                </tr>
              </thead>
              <tbody>
                {punches.map((punch) => {
                  const hours = punch.clock_out ? round2(hoursBetween(punch.clock_in, punch.clock_out)) : 0;
                  return (
                    <tr key={punch.id}>
                      <td>{formatNumber(punch.in_date)}</td>
                      <td>{fmtClock(punch.in_time)}</td>
                      <td>{punch.out_time ? fmtClock(punch.out_time) : <span className="badge off">Pågår</span>}</td>
                      <td className="num">{punch.clock_out ? fmtHours(hours) : "–"}</td>
                      <td className="num">{punch.clock_out ? fmtSEK(hours * employee.hourly_rate) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <Link className="btn secondary" href={`/admin/rapporter`}>
            Till rapporterna
          </Link>
          <span className="small muted">Timlön: {fmtRate(employee.hourly_rate)}</span>
        </div>
      </section>
    </div>
  );
}
