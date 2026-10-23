/**
 * Payroll & Payout Calculation Service — Egyptian Pounds (EGP)
 */
import { msToHoursDecimal, getNetDurationMs } from "./sessions";

export function calculateEmployeePayroll(employee, sessions = []) {
  const rate = Number(employee.hourlyPayRate) || 350; // Default 350 EGP/hr if not set
  const empSessions = sessions.filter((s) => s.uid === (employee.uid || employee.id));

  let totalMs = 0;
  let overtimeMs = 0;

  // Calculate day-by-day to accurately catch daily overtime (> 8h/day)
  const sessionsByDay = {};
  empSessions.forEach((s) => {
    const d = s.checkInTime?.toDate?.()
      ? s.checkInTime.toDate().toISOString().slice(0, 10)
      : "2026-10-01";
    const net = getNetDurationMs(s);
    sessionsByDay[d] = (sessionsByDay[d] || 0) + net;
  });

  const dailyThresholdMs = 8 * 3600000;
  Object.values(sessionsByDay).forEach((dayMs) => {
    totalMs += dayMs;
    if (dayMs > dailyThresholdMs) {
      overtimeMs += (dayMs - dailyThresholdMs);
    }
  });

  const regularMs = Math.max(0, totalMs - overtimeMs);

  const regularHours = msToHoursDecimal(regularMs);
  const overtimeHours = msToHoursDecimal(overtimeMs);
  const totalHours = msToHoursDecimal(totalMs);

  const regularPay = Math.round(regularHours * rate);
  const overtimePay = Math.round(overtimeHours * (rate * 1.5));
  const grossPay = regularPay + overtimePay;

  const estimatedTax = Math.round(grossPay * 0.15); // 15% estimated deduction
  const netPay = grossPay - estimatedTax;

  return {
    uid: employee.uid || employee.id,
    name: employee.displayName || employee.email,
    email: employee.email,
    rate,
    totalHours,
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    grossPay,
    estimatedTax,
    netPay,
    sessionCount: empSessions.length,
  };
}

export function exportPayrollCSV(payrollRows) {
  const headers = [
    "Employee", "Email", "Rate (EGP/hr)", "Total Hours",
    "Regular Hours", "Overtime (1.5x) Hours", "Regular Pay (EGP)",
    "Overtime Pay (EGP)", "Gross Payout (EGP)", "Estimated Deductions (15%) (EGP)", "Net Payout (EGP)"
  ];

  const rows = [
    headers,
    ...payrollRows.map((r) => [
      r.name,
      r.email,
      `${r.rate} EGP`,
      r.totalHours,
      r.regularHours,
      r.overtimeHours,
      `${r.regularPay} EGP`,
      `${r.overtimePay} EGP`,
      `${r.grossPay} EGP`,
      `${r.estimatedTax} EGP`,
      `${r.netPay} EGP`,
    ]),
  ];

  const csv = rows
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zoneclock-payroll-egp-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
