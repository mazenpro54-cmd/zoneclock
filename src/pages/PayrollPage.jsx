import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getSessions } from "../services/sessions";
import { calculateEmployeePayroll, exportPayrollCSV } from "../services/payroll";
import { collection, getDocs, query, orderBy } from "../firebaseCompat";
import { db } from "../firebase";
import {
  Coins, Download, Clock, TrendingUp, Users,
  CheckCircle, FileText, Calendar, Shield
} from "lucide-react";
import { startOfWeek, endOfWeek, subDays, startOfMonth, endOfMonth } from "date-fns";

const RANGES = [
  { label: "This Week", fn: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: "Last 14 Days", fn: () => ({ from: subDays(new Date(), 14), to: new Date() }) },
  { label: "This Month", fn: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
];

export default function PayrollPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [employees, setEmployees] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeIndex, setRangeIndex] = useState(0);
  const [paidStatus, setPaidStatus] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { from, to } = RANGES[rangeIndex].fn();
        const [usersSnap, sessionsData] = await Promise.all([
          getDocs(query(collection(db, "users"), orderBy("displayName"))),
          getSessions({ from, to }),
        ]);
        const usersList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEmployees(usersList);
        setSessions(sessionsData);
      } catch (err) {
        console.error("Error loading payroll data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [rangeIndex]);

  if (!isAdmin) {
    return (
      <div className="page centered">
        <Shield size={48} className="muted-icon" />
        <h2>Access Restricted</h2>
        <p className="muted">Only managers and admins can access the payroll console.</p>
      </div>
    );
  }

  // Calculate payroll rows for all employees
  const payrollRows = employees.map((emp) =>
    calculateEmployeePayroll(emp, sessions)
  );

  const totalGross = payrollRows.reduce((sum, r) => sum + r.grossPay, 0);
  const totalNet = payrollRows.reduce((sum, r) => sum + r.netPay, 0);
  const totalOvertimeHours = payrollRows.reduce((sum, r) => sum + r.overtimeHours, 0);

  function togglePaid(uid) {
    setPaidStatus((prev) => ({ ...prev, [uid]: !prev[uid] }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2><Coins size={20} /> Payroll & Payouts (EGP)</h2>
          <p className="muted">Calculates regular pay, 1.5x overtime hours, and net disbursement in Egyptian Pounds (EGP).</p>
        </div>
        <div className="header-actions">
          <div className="range-tabs">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                className={`range-tab ${i === rangeIndex ? "active" : ""}`}
                onClick={() => setRangeIndex(i)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            className="btn-outline"
            onClick={() => exportPayrollCSV(payrollRows)}
            title="Export Payroll CSV"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <Coins size={24} className="text-brand" />
          <div>
            <p className="kpi-value">{totalGross.toLocaleString()} <span style={{ fontSize: "0.9rem" }}>EGP</span></p>
            <p className="kpi-label">Gross Team Payroll</p>
          </div>
        </div>
        <div className="kpi-card">
          <Clock size={24} style={{ color: "#f59e0b" }} />
          <div>
            <p className="kpi-value">{totalOvertimeHours}h</p>
            <p className="kpi-label">Overtime Hours (1.5x)</p>
          </div>
        </div>
        <div className="kpi-card">
          <TrendingUp size={24} style={{ color: "#10b981" }} />
          <div>
            <p className="kpi-value">{totalNet.toLocaleString()} <span style={{ fontSize: "0.9rem" }}>EGP</span></p>
            <p className="kpi-label">Estimated Net Payout</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="page-loader">
          <Coins className="spin" size={28} />
          <p>Calculating payroll in EGP…</p>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: "1rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Rate</th>
                <th>Reg. Hours</th>
                <th>Overtime (1.5x)</th>
                <th>Gross Pay</th>
                <th>Taxes (15%)</th>
                <th>Net Payout</th>
                <th>Payout Status</th>
              </tr>
            </thead>
            <tbody>
              {payrollRows.map((r) => {
                const isPaid = !!paidStatus[r.uid];
                return (
                  <tr key={r.uid}>
                    <td>
                      <div>
                        <strong>{r.name}</strong>
                        <div className="muted-small">{r.email}</div>
                      </div>
                    </td>
                    <td><strong>{r.rate} EGP</strong>/hr</td>
                    <td>{r.regularHours}h ({r.regularPay.toLocaleString()} EGP)</td>
                    <td>
                      {r.overtimeHours > 0 ? (
                        <span className="overtime-tag">
                          {r.overtimeHours}h ({r.overtimePay.toLocaleString()} EGP)
                        </span>
                      ) : (
                        <span className="muted">0h</span>
                      )}
                    </td>
                    <td><strong>{r.grossPay.toLocaleString()} EGP</strong></td>
                    <td className="muted">-{r.estimatedTax.toLocaleString()} EGP</td>
                    <td>
                      <strong className="text-brand" style={{ fontSize: "1rem" }}>
                        {r.netPay.toLocaleString()} EGP
                      </strong>
                    </td>
                    <td>
                      <button
                        className={`status-pill-btn ${isPaid ? "paid" : "pending"}`}
                        onClick={() => togglePaid(r.uid)}
                      >
                        {isPaid ? "✓ Paid" : "Mark as Paid"}
                      </button>
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
