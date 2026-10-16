import { useState, useEffect } from "react";
import { getSessions, msToHMS, msToHoursDecimal } from "../services/sessions";
import { exportCSV, exportPDF } from "../services/export";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { formatInTZ, formatDateInTZ } from "../services/timezone";
import { startOfWeek, endOfWeek, startOfDay, endOfDay, subDays } from "date-fns";
import { Download, FileText, Calendar, Clock, Globe, Filter } from "lucide-react";

const RANGES = [
  { label: "Today", fn: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Yesterday", fn: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: "This Week", fn: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: "Last 30 Days", fn: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
];

export default function TimesheetPage() {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const isAdmin = profile?.role === "admin";

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(0); // index into RANGES
  const [selectedProject, setSelectedProject] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    const { from, to } = RANGES[range].fn();
    getSessions({ uid: isAdmin ? undefined : user.uid, from, to })
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [range, user.uid, isAdmin]);

  // Unique projects from current session data
  const projects = ["ALL", ...new Set(sessions.map((s) => s.project || "General"))];

  const filteredSessions = selectedProject === "ALL"
    ? sessions
    : sessions.filter((s) => (s.project || "General") === selectedProject);

  const totalMs = filteredSessions.reduce((sum, s) => {
    const net = (s.durationMs ?? 0) - (s.totalBreakMs ?? 0);
    return sum + Math.max(0, net);
  }, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>
            <Calendar size={20} /> Timesheets
          </h2>
          <div className="tz-indicator">
            <Globe size={12} /> Times displayed in: <strong>{settings.timezone}</strong>
          </div>
        </div>
        <div className="header-actions">
          {/* Date range tabs */}
          <div className="range-tabs">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                className={`range-tab ${i === range ? "active" : ""}`}
                onClick={() => setRange(i)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Export */}
          <button className="btn-outline" onClick={() => exportCSV(filteredSessions)} title="Export CSV">
            <Download size={14} /> CSV
          </button>
          <button className="btn-outline" onClick={() => exportPDF(filteredSessions)} title="Export PDF">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Summary bar & Project Filter */}
      <div className="filter-summary-row">
        <div className="summary-bar" style={{ margin: 0 }}>
          <div className="summary-chip">
            <Clock size={14} /> Total Net: <strong>{msToHMS(totalMs)}</strong>
          </div>
          <div className="summary-chip">
            Sessions: <strong>{filteredSessions.length}</strong>
          </div>
        </div>

        {projects.length > 2 && (
          <div className="project-filter-wrap">
            <Filter size={13} className="muted" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="compact-select"
            >
              {projects.map((p) => (
                <option key={p} value={p}>{p === "ALL" ? "All Projects" : p}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: "1.5rem" }}>Loading timesheet sessions…</p>
      ) : filteredSessions.length === 0 ? (
        <div className="empty-state">
          <Calendar size={36} className="muted-icon" />
          <p className="muted">No work sessions recorded for this timeframe.</p>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: "1rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                {isAdmin && <th>Employee</th>}
                <th>Project</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Breaks</th>
                <th>Net Hours</th>
                <th>Activity Note</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((s) => {
                const inDate = s.checkInTime;
                const outDate = s.checkOutTime;
                const net = msToHoursDecimal((s.durationMs ?? 0) - (s.totalBreakMs ?? 0));
                return (
                  <tr key={s.id}>
                    {isAdmin && <td>{s.displayName}</td>}
                    <td>
                      <span className="project-badge">{s.project || "General"}</span>
                    </td>
                    <td>{formatDateInTZ(inDate, settings.timezone)}</td>
                    <td>{formatInTZ(inDate, settings.timezone)}</td>
                    <td>
                      {outDate ? (
                        formatInTZ(outDate, settings.timezone)
                      ) : (
                        <span className="active-tag">Active</span>
                      )}
                    </td>
                    <td>{msToHMS(s.totalBreakMs)}</td>
                    <td>{outDate ? <strong>{net}h</strong> : "—"}</td>
                    <td className="note-cell" title={s.note || ""}>
                      {s.note ? s.note : <span className="muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
