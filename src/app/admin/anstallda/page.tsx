import Link from "next/link";
import Flash from "@/components/Flash";
import { DeleteEmployee } from "@/components/ConfirmSubmit";
import { listEmployees } from "@/server/auth";
import { fmtRate } from "@/server/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Anställda" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; ny?: string }>;
}) {
  const params = await searchParams;
  const employees = await listEmployees(true);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="script">Personalen</span>
          <h1>Anställda</h1>
          <div className="muted small">Lägg till, ta bort och sätt timlön för de som jobbar på timme.</div>
        </div>
      </div>

      <Flash code={params.flash} />

      <section className="card" id="ny">
        <div className="card-head">
          <h2>Lägg till anställd</h2>
        </div>
        <form method="post" action="/api/admin/employees">
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="name">Namn</label>
              <input id="name" name="name" placeholder="För- och efternamn" required />
            </div>
            <div className="field">
              <label htmlFor="username">Användarnamn</label>
              <input id="username" name="username" placeholder="t.ex. anna" required autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="pin">PIN-kod</label>
              <input
                id="pin"
                name="pin"
                inputMode="numeric"
                pattern="\d{4,8}"
                placeholder="4–8 siffror"
                required
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="hourly_rate">Timlön (kr)</label>
              <input
                id="hourly_rate"
                name="hourly_rate"
                inputMode="decimal"
                placeholder="t.ex. 145,50"
                required
                autoComplete="off"
              />
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <button className="btn" type="submit">
                Lägg till
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Alla anställda</h2>
          <span className="small muted">{employees.length} st</span>
        </div>

        {employees.length === 0 ? (
          <div className="empty">Inga anställda ännu – lägg till din förste medarbetare ovan.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Användarnamn</th>
                  <th className="num">Timlön</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.name}</strong>
                    </td>
                    <td>{employee.username}</td>
                    <td className="num">{fmtRate(employee.hourly_rate)}</td>
                    <td>
                      {employee.active ? (
                        <span className="badge on">Aktiv</span>
                      ) : (
                        <span className="badge neutral">Inaktiv</span>
                      )}
                    </td>
                    <td className="right nowrap">
                      <Link className="btn-link" href={`/admin/anstallda/${employee.id}`}>
                        Ändra
                      </Link>
                      <span className="muted"> · </span>
                      <DeleteEmployee id={employee.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
