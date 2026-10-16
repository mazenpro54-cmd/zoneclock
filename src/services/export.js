/**
 * CSV / PDF export utilities for timesheet data.
 */

import { msToHoursDecimal, msToHMS } from "./sessions";
import { format } from "date-fns";

// ─── CSV Export ──────────────────────────────────────────────────────────────

export function exportCSV(sessions) {
  const rows = [
    ["Employee", "Project", "Date", "Check In", "Check Out", "Breaks", "Net Hours", "Note"],
    ...sessions.map((s) => {
      const inDate = s.checkInTime?.toDate?.() ?? new Date(s.checkInTime);
      const outDate = s.checkOutTime?.toDate?.() ?? null;
      return [
        s.displayName,
        s.project,
        format(inDate, "yyyy-MM-dd"),
        format(inDate, "HH:mm:ss"),
        outDate ? format(outDate, "HH:mm:ss") : "—",
        msToHMS(s.totalBreakMs),
        outDate ? msToHoursDecimal(s.durationMs - (s.totalBreakMs ?? 0)) : "—",
        s.note || "",
      ];
    }),
  ];

  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  download("zoneclock-export.csv", "text/csv", csv);
}

// ─── PDF Export (via print) ──────────────────────────────────────────────────

export function exportPDF(sessions) {
  const rows = sessions.map((s) => {
    const inDate = s.checkInTime?.toDate?.() ?? new Date(s.checkInTime);
    const outDate = s.checkOutTime?.toDate?.() ?? null;
    return `
      <tr>
        <td>${s.displayName}</td>
        <td>${s.project}</td>
        <td>${format(inDate, "yyyy-MM-dd")}</td>
        <td>${format(inDate, "HH:mm")}</td>
        <td>${outDate ? format(outDate, "HH:mm") : "—"}</td>
        <td>${msToHMS(s.totalBreakMs)}</td>
        <td>${outDate ? msToHoursDecimal(s.durationMs - (s.totalBreakMs ?? 0)) + "h" : "—"}</td>
      </tr>`;
  });

  const html = `<!DOCTYPE html>
<html><head><title>ZoneClock Timesheet</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; }
  h1 { color: #6366f1; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #6366f1; color: #fff; }
  tr:nth-child(even) { background: #f9f9fb; }
</style>
</head><body>
<h1>ZoneClock — Timesheet Export</h1>
<p>Generated: ${format(new Date(), "PPP p")}</p>
<table>
<thead>
  <tr><th>Employee</th><th>Project</th><th>Date</th><th>In</th><th>Out</th><th>Breaks</th><th>Net Hrs</th></tr>
</thead>
<tbody>${rows.join("")}</tbody>
</table>
</body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

// ─── Util ────────────────────────────────────────────────────────────────────

function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
