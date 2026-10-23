import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getSessions, msToHoursDecimal, msToHMS, getNetDurationMs } from "../services/sessions";
import { format, subDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import {
  BarChart2, PieChart, TrendingUp, Clock, Calendar,
  Award, Zap, CheckCircle2, Users
} from "lucide-react";

export default function AnalyticsPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = subDays(new Date(), 7);
      const to = new Date();
      const data = await getSessions({
        uid: isAdmin ? undefined : user?.uid,
        from,
        to,
      });
      setSessions(data);
      setLoading(false);
    }
    load();
  }, [user?.uid, isAdmin]);

  // 1. Group hours by last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const daySessions = sessions.filter((s) => {
      const sDate = s.checkInTime?.toDate?.() || new Date(s.checkInTime);
      return isSameDay(sDate, d);
    });
    const totalMs = daySessions.reduce(
      (sum, s) => sum + getNetDurationMs(s),
      0
    );
    return {
      date: d,
      label: format(d, "EEE"),
      fullDate: format(d, "MMM d"),
      hours: msToHoursDecimal(totalMs),
      count: daySessions.length,
    };
  });

  const maxDayHours = Math.max(...days.map((d) => d.hours), 8);

  // 2. Project breakdown
  const projectMap = sessions.reduce((acc, s) => {
    const p = s.project || "General";
    const netMs = getNetDurationMs(s);
    acc[p] = (acc[p] || 0) + netMs;
    return acc;
  }, {});

  const totalAllMs = Object.values(projectMap).reduce((a, b) => a + b, 0);

  const projectColors = {
    Development: "#6366f1",
    Design: "#ec4899",
    Marketing: "#f59e0b",
    Support: "#10b981",
    Management: "#8b5cf6",
    Meetings: "#06b6d4",
    Research: "#3b82f6",
    General: "#64748b",
  };

  const projectBreakdown = Object.entries(projectMap).map(([name, ms]) => {
    const hours = msToHoursDecimal(ms);
    const percent = totalAllMs > 0 ? Math.round((ms / totalAllMs) * 100) : 0;
    return { name, hours, percent, color: projectColors[name] || "#6366f1" };
  });

  // 3. Employee breakdown (for Admins)
  const employeeMap = sessions.reduce((acc, s) => {
    const name = s.displayName || "Employee";
    const netMs = Math.max(0, (s.durationMs ?? 0) - (s.totalBreakMs ?? 0));
    acc[name] = (acc[name] || 0) + netMs;
    return acc;
  }, {});

  const employeeRank = Object.entries(employeeMap)
    .map(([name, ms]) => ({ name, hours: msToHoursDecimal(ms) }))
    .sort((a, b) => b.hours - a.hours);

  // KPIs
  const totalWeekHours = msToHoursDecimal(totalAllMs);
  const avgDailyHours = Math.round((totalWeekHours / 7) * 10) / 10;
  const topProject = projectBreakdown[0]?.name || "Development";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2><BarChart2 size={20} /> Performance & Visual Analytics</h2>
          <p className="muted">Weekly workload distribution, daily hours, and project breakdown.</p>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <Clock size={24} />
          <div>
            <p className="kpi-value">{totalWeekHours}h</p>
            <p className="kpi-label">7-Day Total Hours</p>
          </div>
        </div>
        <div className="kpi-card">
          <Zap size={24} />
          <div>
            <p className="kpi-value">{avgDailyHours}h</p>
            <p className="kpi-label">Average / Day</p>
          </div>
        </div>
        <div className="kpi-card">
          <Award size={24} />
          <div>
            <p className="kpi-value" style={{ fontSize: "1.1rem" }}>{topProject}</p>
            <p className="kpi-label">Top Focused Project</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="page-loader">
          <Clock className="spin" size={28} />
          <p>Compiling analytics…</p>
        </div>
      ) : (
        <div className="analytics-grid">
          {/* Bar Chart: Daily Hours */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div>
                <h3 className="chart-title">Daily Hours (Past 7 Days)</h3>
                <p className="muted-small">Interactive daily breakdown</p>
              </div>
              <span className="badge-pill">Last 7 Days</span>
            </div>

            <div className="bar-chart-container">
              <div className="bar-chart-bars">
                {days.map((d, idx) => {
                  const heightPercent = Math.max(6, Math.round((d.hours / maxDayHours) * 100));
                  const isHovered = hoveredBar === idx;
                  const isToday = isSameDay(d.date, new Date());

                  return (
                    <div
                      key={d.label + idx}
                      className="bar-col"
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {isHovered && (
                        <div className="bar-tooltip">
                          <strong>{d.hours}h</strong>
                          <span>{d.fullDate}</span>
                          <span>{d.count} sessions</span>
                        </div>
                      )}
                      <div className="bar-track">
                        <div
                          className={`bar-fill ${isToday ? "today-bar" : ""}`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className={`bar-label ${isToday ? "today-label" : ""}`}>
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Project Distribution */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div>
                <h3 className="chart-title">Project Time Breakdown</h3>
                <p className="muted-small">Allocation across work streams</p>
              </div>
            </div>

            {projectBreakdown.length === 0 ? (
              <p className="muted" style={{ padding: "1rem" }}>No session data recorded.</p>
            ) : (
              <div className="project-distribution-wrap">
                {/* Horizontal multi-color bar */}
                <div className="stacked-progress-bar">
                  {projectBreakdown.map((p) => (
                    <div
                      key={p.name}
                      className="stacked-slice"
                      style={{ width: `${p.percent}%`, backgroundColor: p.color }}
                      title={`${p.name}: ${p.percent}%`}
                    />
                  ))}
                </div>

                <div className="project-legend-list">
                  {projectBreakdown.map((p) => (
                    <div key={p.name} className="project-legend-item">
                      <div className="legend-indicator" style={{ backgroundColor: p.color }} />
                      <div className="legend-info">
                        <span className="legend-name">{p.name}</span>
                        <span className="legend-hours">{p.hours}h</span>
                      </div>
                      <span className="legend-percent">{p.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Employee Leaderboard */}
          {isAdmin && employeeRank.length > 0 && (
            <div className="chart-card full-width-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Team Leaderboard</h3>
                  <p className="muted-small">Hours logged by team members this week</p>
                </div>
                <Users size={18} className="text-brand" />
              </div>

              <div className="leaderboard-list">
                {employeeRank.map((emp, rank) => {
                  const maxHours = employeeRank[0]?.hours || 1;
                  const percent = Math.round((emp.hours / maxHours) * 100);

                  return (
                    <div key={emp.name} className="leaderboard-row">
                      <span className="rank-num">#{rank + 1}</span>
                      <div className="leaderboard-name-col">
                        <span className="leaderboard-name">{emp.name}</span>
                        <div className="leaderboard-track">
                          <div className="leaderboard-fill" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                      <strong className="leaderboard-hours">{emp.hours}h</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
