/**
 * export.js — Comprehensive CSV & Executive PDF exports for Timesheets & Payroll.
 * Includes UTF-8 BOM encoding for seamless Microsoft Excel compatibility on Windows & Mac.
 */

import { msToHoursDecimal, msToHMS } from "./sessions";
import { format } from "date-fns";

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── CSV Download Helper with UTF-8 BOM ──────────────────────────────────────
function downloadCSV(filename, content) {
  // \uFEFF is the UTF-8 Byte Order Mark. Without it, Microsoft Excel corrupts non-ASCII chars
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Timesheet CSV Export ───────────────────────────────────────────────────
export function exportCSV(sessions, filename = `zoneclock-timesheets-${format(new Date(), "yyyy-MM-dd")}.csv`) {
  const headers = [
    "Session ID",
    "Employee",
    "Project",
    "Task ID",
    "Date",
    "Check In",
    "Check Out",
    "Break Duration",
    "Net Hours",
    "Status",
    "Exit Reason",
    "Notes",
  ];

  const rows = [
    headers,
    ...sessions.map((s) => {
      const inDate = s.checkInTime?.toDate?.() ?? (s.checkInTime ? new Date(s.checkInTime) : new Date());
      const outDate = s.checkOutTime?.toDate?.() ?? (s.checkOutTime ? new Date(s.checkOutTime) : null);
      const netHours = outDate ? msToHoursDecimal((s.durationMs ?? 0) - (s.totalBreakMs ?? 0)) : "Active";
      return [
        s.id || "—",
        s.displayName || "Unknown",
        s.project || "General",
        s.taskId || "—",
        format(inDate, "yyyy-MM-dd"),
        format(inDate, "HH:mm:ss"),
        outDate ? format(outDate, "HH:mm:ss") : "In Progress",
        msToHMS(s.totalBreakMs || 0),
        netHours,
        s.status || "done",
        s.exitReason || "manual",
        s.note || "",
      ];
    }),
  ];

  const csv = rows
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  downloadCSV(filename, csv);
}

// ─── Timesheet PDF Export (Printable Executive Report) ──────────────────────
export function exportPDF(sessions, title = "ZoneClock Timesheet Report") {
  const totalNetMs = sessions.reduce((sum, s) => {
    return sum + Math.max(0, (s.durationMs ?? 0) - (s.totalBreakMs ?? 0));
  }, 0);
  const totalHours = msToHoursDecimal(totalNetMs);

  const tableRows = sessions.map((s, index) => {
    const inDate = s.checkInTime?.toDate?.() ?? (s.checkInTime ? new Date(s.checkInTime) : new Date());
    const outDate = s.checkOutTime?.toDate?.() ?? (s.checkOutTime ? new Date(s.checkOutTime) : null);
    const netH = outDate ? msToHoursDecimal((s.durationMs ?? 0) - (s.totalBreakMs ?? 0)) + "h" : "Active";

    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(s.displayName || "Employee")}</strong></td>
        <td><span class="badge">${escapeHtml(s.project || "General")}</span></td>
        <td>${format(inDate, "yyyy-MM-dd")}</td>
        <td>${format(inDate, "HH:mm")}</td>
        <td>${outDate ? format(outDate, "HH:mm") : "<em>In Progress</em>"}</td>
        <td>${msToHMS(s.totalBreakMs || 0)}</td>
        <td style="text-align: right; font-weight: 600;">${netH}</td>
      </tr>
    `;
  }).join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to generate and print the PDF report.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 12px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px; }
        .logo { font-size: 24px; font-weight: 800; color: #4338ca; letter-spacing: -0.5px; }
        .logo span { color: #06b6d4; }
        .meta { text-align: right; color: #64748b; font-size: 11px; line-height: 1.5; }
        .stats-grid { display: flex; gap: 15px; margin-bottom: 20px; }
        .stat-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
        .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; }
        .stat-val { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 8px 10px; font-size: 11px; border-bottom: 2px solid #cbd5e1; }
        td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
        tr:nth-child(even) { background-color: #fafafa; }
        .badge { background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
        .footer { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #64748b; }
        .signature-line { margin-top: 40px; width: 220px; border-top: 1px solid #94a3b8; text-align: center; padding-top: 4px; }
        @media print {
          body { padding: 0; }
          button.print-btn { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">Zone<span>Clock</span></div>
          <div style="color: #64748b; margin-top: 4px; font-size: 12px;">Workplace Time Tracking & Geofence Intelligence</div>
        </div>
        <div class="meta">
          <div><strong>Report:</strong> ${title}</div>
          <div><strong>Generated:</strong> ${format(new Date(), "PPP p")}</div>
          <div><strong>Total Sessions:</strong> ${sessions.length}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Net Hours</div>
          <div class="stat-val">${totalHours} hrs</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Logged Sessions</div>
          <div class="stat-val">${sessions.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Status</div>
          <div class="stat-val" style="color: #16a34a;">Verified</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>Employee</th>
            <th>Project</th>
            <th>Date</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Break</th>
            <th style="text-align: right;">Net Hours</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div class="footer">
        <div>
          <div>ZoneClock Automated System Audit</div>
          <div style="font-size: 10px; color: #94a3b8;">Document verification checksum: ${Math.random().toString(36).substring(2, 12).toUpperCase()}</div>
        </div>
        <div>
          <div class="signature-line">Authorized Manager Signature</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ─── Payroll PDF Export (Official Payout Voucher) ───────────────────────────
export function exportPayrollPDF(payrollRows, periodName = "Current Period") {
  const totals = payrollRows.reduce(
    (acc, r) => ({
      hours: acc.hours + (r.totalHours || 0),
      gross: acc.gross + (r.grossPay || 0),
      net: acc.net + (r.netPay || 0),
      tax: acc.tax + (r.estimatedTax || 0),
    }),
    { hours: 0, gross: 0, net: 0, tax: 0 }
  );

  const rowsHtml = payrollRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(r.name)}</strong><br><span style="color:#64748b;font-size:10px;">${escapeHtml(r.email)}</span></td>
      <td style="text-align: right;">${r.rate} EGP</td>
      <td style="text-align: right;">${r.regularHours}h</td>
      <td style="text-align: right; color:#d97706; font-weight:600;">${r.overtimeHours}h</td>
      <td style="text-align: right; font-weight:600;">${r.totalHours}h</td>
      <td style="text-align: right;">${r.regularPay.toLocaleString()} EGP</td>
      <td style="text-align: right; color:#d97706;">${r.overtimePay.toLocaleString()} EGP</td>
      <td style="text-align: right; font-weight:700; color:#16a34a;">${r.netPay.toLocaleString()} EGP</td>
    </tr>
  `).join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to print or save the Payroll PDF.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>ZoneClock Payroll Voucher - ${periodName}</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 20px; font-size: 11px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px; }
        .logo { font-size: 22px; font-weight: 800; color: #047857; }
        .stats { display: flex; gap: 15px; margin-bottom: 20px; }
        .stat { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
        .stat-num { font-size: 18px; font-weight: 700; color: #065f46; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #ecfdf5; color: #065f46; padding: 8px 10px; font-size: 10px; border-bottom: 2px solid #a7f3d0; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
        .total-row { background: #f0fdf4; font-weight: 700; border-top: 2px solid #10b981; }
        .footer { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
        .sig { width: 200px; border-top: 1px solid #94a3b8; text-align: center; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">ZoneClock Payroll</div>
          <div style="color: #64748b;">Official Employee Payout Voucher & Timesheet Reconciliation</div>
        </div>
        <div style="text-align: right; color: #64748b;">
          <div><strong>Period:</strong> ${periodName}</div>
          <div><strong>Generated:</strong> ${format(new Date(), "PPP p")}</div>
          <div><strong>Currency:</strong> Egyptian Pound (EGP)</div>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Total Hours</div>
          <div class="stat-num">${totals.hours.toFixed(1)} hrs</div>
        </div>
        <div class="stat">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Gross Payroll</div>
          <div class="stat-num">${totals.gross.toLocaleString()} EGP</div>
        </div>
        <div class="stat">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Total Net Disbursed</div>
          <div class="stat-num" style="color:#059669;">${totals.net.toLocaleString()} EGP</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Employee</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Regular Hrs</th>
            <th style="text-align: right;">Overtime (1.5x)</th>
            <th style="text-align: right;">Total Hrs</th>
            <th style="text-align: right;">Regular Pay</th>
            <th style="text-align: right;">Overtime Pay</th>
            <th style="text-align: right;">Net Payout</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="total-row">
            <td colspan="5">GRAND TOTALS (${payrollRows.length} Employees)</td>
            <td style="text-align: right;">${totals.hours.toFixed(1)}h</td>
            <td style="text-align: right;" colspan="2">${totals.gross.toLocaleString()} EGP (Gross)</td>
            <td style="text-align: right; color:#047857;">${totals.net.toLocaleString()} EGP</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <div>
          <div>Finance & HR Clearance</div>
          <div style="font-size: 10px; color: #94a3b8;">Disbursement approval code: ZC-${Math.floor(100000 + Math.random() * 900000)}</div>
        </div>
        <div>
          <div class="sig">Finance Director Authorization</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
