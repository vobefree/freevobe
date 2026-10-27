import { all, one } from "./db";
import { hoursBetween, round2 } from "./time";
import type { EmployeeRow } from "./auth";

export type ReportDay = {
  entryId: number;
  date: string;
  inTime: string;
  outTime: string | null;
  hours: number;
  open: boolean;
};

export type ReportEmployee = {
  id: number;
  name: string;
  username: string;
  rate: number;
  days: ReportDay[];
  hours: number;
  amount: number;
};

export type MonthReport = {
  month: string;
  employees: ReportEmployee[];
  totals: {
    employees: number;
    workedDays: number;
    hours: number;
    amount: number;
    openPunches: number;
  };
};

type EntryRow = {
  employee_id: number;
  entry_id: number;
  in_date: string;
  in_time: string;
  out_time: string | null;
  clock_in: string;
  clock_out: string | null;
};

/**
 * Månadsrapport: räknar ut antal timmar (och ersättning) automatiskt
 * utifrån anställdas inklockningar, dag för dag.
 */
export async function buildMonthReport(month: string): Promise<MonthReport> {
  const employees = await listReportEmployees();
  const entries = await all<EntryRow>(
    `SELECT t.employee_id, t.id AS entry_id, t.in_date, t.in_time, t.out_time, t.clock_in, t.clock_out
       FROM time_entries t
      WHERE t.in_date LIKE ?1
      ORDER BY t.in_date, t.in_time`,
    [`${month}-%`],
  );

  const byEmployee = new Map<number, ReportEmployee>();
  for (const employee of employees) {
    byEmployee.set(employee.id, {
      id: employee.id,
      name: employee.name,
      username: employee.username,
      rate: employee.hourly_rate,
      days: [],
      hours: 0,
      amount: 0,
    });
  }

  let workedDays = 0;
  let openPunches = 0;

  for (const entry of entries) {
    const target = byEmployee.get(entry.employee_id);
    if (!target) continue;
    const open = !entry.clock_out;
    const hours = open ? 0 : round2(hoursBetween(entry.clock_in, entry.clock_out as string));
    if (open) openPunches += 1;
    else workedDays += 1;
    target.days.push({
      entryId: entry.entry_id,
      date: entry.in_date,
      inTime: entry.in_time,
      outTime: entry.out_time,
      hours,
      open,
    });
    target.hours = round2(target.hours + hours);
    target.amount = round2(target.hours * target.rate);
  }

  const report: MonthReport = {
    month,
    employees: employees.map((e) => byEmployee.get(e.id) as ReportEmployee),
    totals: { employees: employees.length, workedDays, hours: 0, amount: 0, openPunches },
  };

  for (const employee of report.employees) {
    report.totals.hours = round2(report.totals.hours + employee.hours);
    report.totals.amount = round2(report.totals.amount + employee.amount);
  }

  return report;
}

async function listReportEmployees(): Promise<EmployeeRow[]> {
  return all<EmployeeRow>("SELECT * FROM employees ORDER BY name COLLATE NOCASE");
}

export type TodayStatus = {
  id: number;
  name: string;
  clockIn: string;
  inTime: string;
  hours: number;
};

/** Vem är inklockad just nu? */
export async function whoIsClockedIn(): Promise<TodayStatus[]> {
  const rows = await all<{
    id: number;
    name: string;
    clock_in: string;
    in_time: string;
  }>(
    `SELECT e.id, e.name, t.clock_in, t.in_time
       FROM time_entries t
       JOIN employees e ON e.id = t.employee_id
      WHERE t.clock_out IS NULL
      ORDER BY t.clock_in`,
  );
  const now = new Date().toISOString();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    clockIn: r.in_time,
    inTime: r.in_time,
    hours: round2(hoursBetween(r.clock_in, now)),
  }));
}

export type ShiftRow = {
  id: number;
  employee_id: number;
  date: string;
  start_time: string;
  end_time: string;
  note: string | null;
  name?: string;
  hourly_rate?: number;
};

export async function shiftsForMonth(month: string): Promise<ShiftRow[]> {
  return all<ShiftRow>(
    `SELECT s.*, e.name, e.hourly_rate
       FROM shifts s
       JOIN employees e ON e.id = s.employee_id
      WHERE s.date LIKE ?1
      ORDER BY s.date, s.start_time, e.name COLLATE NOCASE`,
    [`${month}-%`],
  );
}

export async function shiftsBetween(from: string, to: string, employeeId?: number): Promise<ShiftRow[]> {
  if (employeeId) {
    return all<ShiftRow>(
      `SELECT s.*, e.name, e.hourly_rate
         FROM shifts s JOIN employees e ON e.id = s.employee_id
        WHERE s.employee_id = ?1 AND s.date >= ?2 AND s.date <= ?3
        ORDER BY s.date, s.start_time`,
      [employeeId, from, to],
    );
  }
  return all<ShiftRow>(
    `SELECT s.*, e.name, e.hourly_rate
       FROM shifts s JOIN employees e ON e.id = s.employee_id
      WHERE s.date >= ?1 AND s.date <= ?2
      ORDER BY s.date, s.start_time`,
    [from, to],
  );
}

export type PunchRow = {
  id: number;
  employee_id: number;
  clock_in: string;
  clock_out: string | null;
  in_date: string;
  in_time: string;
  out_date: string | null;
  out_time: string | null;
};

export async function openPunch(employeeId: number): Promise<PunchRow | null> {
  return one<PunchRow>(
    "SELECT * FROM time_entries WHERE employee_id = ?1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1",
    [employeeId],
  );
}

export async function punchesForMonth(employeeId: number, month: string): Promise<PunchRow[]> {
  return all<PunchRow>(
    "SELECT * FROM time_entries WHERE employee_id = ?1 AND in_date LIKE ?2 ORDER BY in_date DESC, in_time DESC",
    [employeeId, `${month}-%`],
  );
}
