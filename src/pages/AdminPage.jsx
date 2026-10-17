import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "../firebaseCompat";
import { db } from "../firebase";
import { getSessions, msToHoursDecimal } from "../services/sessions";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Users, Clock, TrendingUp, Shield, MapPin, Briefcase, BarChart2, KeyRound, Check, RefreshCw, X, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import CheckInMap from "../components/CheckInMap";
import { Link } from "react-router-dom";

export default function AdminPage() {
  const { profile, adminResetUserPassword, resetPassword } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [weekSessions, setWeekSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Password reset modal state
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [modalPassword, setModalPassword] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalError, setModalError] = useState("");

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

  function openResetModal(emp) {
    setSelectedEmp(emp);
    setModalPassword("ZoneClock@" + Math.floor(1000 + Math.random() * 9000) + "!");
    setModalSuccess("");
    setModalError("");
  }

  function generatePassword() {
    setModalPassword("ZoneClock@" + Math.floor(1000 + Math.random() * 9000) + "!");
  }

  async function handleAdminSetPassword(e) {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");
    if (!modalPassword || modalPassword.length < 6) {
      setModalError("Password must be at least 6 characters.");
      return;
    }
    setModalLoading(true);
    try {
      await adminResetUserPassword(selectedEmp.email, selectedEmp.id, modalPassword);
      setModalSuccess(`Password for ${selectedEmp.displayName || selectedEmp.email} set to: ${modalPassword}`);
    } catch (err) {
      setModalError(err.message || "Failed to set password.");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleAdminSendEmail() {
    setModalError("");
    setModalSuccess("");
    setModalLoading(true);
    try {
      await resetPassword(selectedEmp.email);
      setModalSuccess(`Password reset email sent to ${selectedEmp.email}.`);
    } catch (err) {
      setModalError(err.message || "Failed to send reset email.");
    } finally {
      setModalLoading(false);
    }
  }

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
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                      className="btn-sm"
                      onClick={() => toggleRole(emp)}
                      title="Toggle admin role"
                    >
                      {emp.role === "admin" ? "Remove Admin" : "Make Admin"}
                    </button>
                    <button
                      className="btn-sm btn-outline"
                      onClick={() => openResetModal(emp)}
                      title="Reset employee password"
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <KeyRound size={12} /> Reset Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Password Reset Modal */}
      {selectedEmp && (
        <div className="modal-overlay" onClick={() => setSelectedEmp(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={18} style={{ color: "var(--accent)" }} />
                Reset User Password
              </h3>
              <button className="close-btn" onClick={() => setSelectedEmp(null)}>×</button>
            </div>

            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Reset or set a new password for <strong>{selectedEmp.displayName || "Employee"}</strong> ({selectedEmp.email}).
            </p>

            <form onSubmit={handleAdminSetPassword} className="modal-form">
              <label className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>New Password</span>
                  <button
                    type="button"
                    onClick={generatePassword}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: 0
                    }}
                  >
                    <RefreshCw size={11} /> Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                  placeholder="ZoneClock@2026!"
                />
              </label>

              {modalError && <p className="error-msg">{modalError}</p>}
              {modalSuccess && (
                <div style={{
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#10b981",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <Check size={16} />
                  <span>{modalSuccess}</span>
                </div>
              )}

              <div className="modal-actions" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="submit"
                  disabled={modalLoading || !modalPassword}
                  className="btn-primary"
                  style={{ width: "100%" }}
                >
                  <KeyRound size={15} />
                  {modalLoading ? "Saving…" : "Set New Password"}
                </button>

                <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                  <button
                    type="button"
                    disabled={modalLoading}
                    onClick={handleAdminSendEmail}
                    className="btn-outline"
                    style={{ flex: 1, fontSize: "0.8rem" }}
                  >
                    Send Reset Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEmp(null)}
                    className="btn-outline"
                    style={{ flex: 1, fontSize: "0.8rem" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
