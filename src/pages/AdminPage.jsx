import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "../firebaseCompat";
import { db } from "../firebase";
import { getSessions, msToHoursDecimal } from "../services/sessions";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Users, Clock, TrendingUp, Shield, MapPin, Briefcase, BarChart2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import CheckInMap from "../components/CheckInMap";
import { Link } from "react-router-dom";

export default function AdminPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [weekSessions, setWeekSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  if (profile?.role !== "admin") {
    return (
      <div className="page centered">
        <Shield size={48} className="muted-icon" />
        <h2>Access Denied</h2>
        <p className="muted">You need admin privileges to view this page.</p>
      </div>
    );
  }

  useEffect(() => {
    async function load() {
      const usersSnap = await getDocs(query(collection(db, "users"), orderBy("displayName")));
      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEmployees(users);

      const from = startOfWeek(new Date(), { weekStartsOn: 1 });
      const to = endOfWeek(new Date(), { weekStartsOn: 1 });
      const sessions = await getSessions({ from, to });
      setWeekSessions(sessions);
      setLoading(false);
    }
    load();
  }, []);

  // Aggregate hours per user this week
  const hoursMap = weekSessions.reduce((acc, s) => {
    const net = Math.max(0, (s.durationMs ?? 0) - (s.totalBreakMs ?? 0));
    acc[s.uid] = (acc[s.uid] || 0) + net;
    return acc;
  }, {});

  async function toggleRole(emp) {
    const newRole = emp.role === "admin" ? "employee" : "admin";
    await updateDoc(doc(db, "users", emp.id), { role: newRole });
    setEmployees((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, role: newRole } : e))
    );
  }

  if (loading) return <div className="page-loader"><Clock className="spin" size={32} /></div>;

  const totalWeekMs = Object.values(hoursMap).reduce((a, b) => a + b, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2><TrendingUp size={20} /> Admin Control Center</h2>
          <p className="muted">Team oversight, live location map, and employee permissions.</p>
        </div>
        <div className="header-actions">
          <Link to="/payroll" className="btn-outline">
            <TrendingUp size={15} /> Payroll
          </Link>
          <Link to="/timeoff" className="btn-outline">
            <Users size={15} /> Time Off
          </Link>
          <Link to="/analytics" className="btn-outline">
            <BarChart2 size={15} /> Analytics
          </Link>
          <Link to="/clients" className="btn-outline">
            <Briefcase size={15} /> Clients
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <Users size={24} />
          <div>
            <p className="kpi-value">{employees.length}</p>
            <p className="kpi-label">Total Employees</p>
          </div>
        </div>
        <div className="kpi-card">
          <Clock size={24} />
          <div>
            <p className="kpi-value">{msToHoursDecimal(totalWeekMs)}h</p>
            <p className="kpi-label">Team Hours This Week</p>
          </div>
        </div>
        <div className="kpi-card">
          <TrendingUp size={24} />
          <div>
            <p className="kpi-value">{weekSessions.length}</p>
            <p className="kpi-label">Sessions This Week</p>
          </div>
        </div>
      </div>

      {/* Live Check-in GPS Map */}
      <div style={{ marginBottom: "1.75rem" }}>
        <CheckInMap sessions={weekSessions} height="360px" />
      </div>

      {/* Employee Management Table */}
      <h3 className="section-title">Team Roster & Roles</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Hrs This Week</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td><strong>{emp.displayName || "—"}</strong></td>
                <td>{emp.email}</td>
                <td>
                  <span className={`role-badge ${emp.role}`}>{emp.role}</span>
                </td>
                <td>
                  <strong>{msToHoursDecimal(hoursMap[emp.uid || emp.id] || 0)}h</strong>
                </td>
                <td>
                  <button
                    className="btn-sm"
                    onClick={() => toggleRole(emp)}
                    title="Toggle admin role"
                  >
                    {emp.role === "admin" ? "Remove Admin" : "Make Admin"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
