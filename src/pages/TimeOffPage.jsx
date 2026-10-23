import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getTimeOffRequests, requestTimeOff, reviewTimeOff } from "../services/timeOff";
import {
  Palmtree, Plus, CheckCircle, XCircle, Clock,
  Calendar, AlertCircle, Heart, User, Shield
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function TimeOffPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [leaveType, setLeaveType] = useState("Vacation");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getTimeOffRequests(isAdmin ? {} : { uid: user.uid });
      setRequests(data);
    } catch (err) {
      console.error("Error loading time off requests:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [user?.uid, isAdmin]);

  async function handleCreateRequest(e) {
    e.preventDefault();
    if (new Date(endDate) < new Date(startDate)) {
      alert("End date cannot be earlier than start date.");
      return;
    }
    if (!user?.uid) {
      alert("You must be logged in to request time off.");
      return;
    }
    setSubmitting(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysCount = Math.max(1, differenceInDays(end, start) + 1);

      await requestTimeOff({
        uid: user.uid,
        displayName: profile?.displayName || user.email,
        type: leaveType,
        startDate,
        endDate,
        daysCount,
        reason,
      });

      setReason("");
      setShowModal(false);
      await loadData();
    } catch (err) {
      alert("Failed to submit request: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(id, status) {
    try {
      await reviewTimeOff(id, status, profile?.displayName || user.email);
      await loadData();
    } catch (err) {
      alert("Review failed: " + err.message);
    }
  }

  // Pre-set user balances
  const balances = profile?.ptoBalance || { vacation: 14, sick: 7 };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2><Palmtree size={20} /> Time Off & Leave Requests</h2>
          <p className="muted">Request vacation, medical leave, or personal time off.</p>
        </div>
        <button
          className="btn-primary"
          style={{ width: "auto", padding: "0.5rem 1rem", fontSize: "0.85rem" }}
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} /> Request Time Off
        </button>
      </div>

      {/* PTO Balance Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <Palmtree size={24} className="text-brand" />
          <div>
            <p className="kpi-value">{balances.vacation} Days</p>
            <p className="kpi-label">Vacation Balance</p>
          </div>
        </div>
        <div className="kpi-card">
          <Heart size={24} style={{ color: "#ec4899" }} />
          <div>
            <p className="kpi-value">{balances.sick} Days</p>
            <p className="kpi-label">Sick Leave Balance</p>
          </div>
        </div>
        <div className="kpi-card">
          <Clock size={24} style={{ color: "#f59e0b" }} />
          <div>
            <p className="kpi-value">
              {requests.filter((r) => r.status === "pending").length}
            </p>
            <p className="kpi-label">Pending Requests</p>
          </div>
        </div>
      </div>

      <h3 className="section-title" style={{ marginTop: "1rem" }}>
        {isAdmin ? "All Team Leave Requests" : "My Leave History"}
      </h3>

      {loading ? (
        <div className="page-loader">
          <Palmtree className="spin" size={28} />
          <p>Loading requests…</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <Palmtree size={36} className="muted-icon" />
          <p className="muted">No leave requests found.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {isAdmin && <th>Employee</th>}
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                {isAdmin && <th>Manager Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  {isAdmin && <td><strong>{r.displayName || "Employee"}</strong></td>}
                  <td>
                    <span className={`pto-pill ${r.type.toLowerCase().replace(/\s/g, "-")}`}>
                      {r.type}
                    </span>
                  </td>
                  <td>
                    {r.startDate} <span className="muted">to</span> {r.endDate}
                  </td>
                  <td><strong>{r.daysCount} d</strong></td>
                  <td className="note-cell" title={r.reason}>{r.reason || "—"}</td>
                  <td>
                    <span className={`status-badge-pto ${r.status}`}>
                      {r.status === "approved" && <CheckCircle size={12} />}
                      {r.status === "rejected" && <XCircle size={12} />}
                      {r.status === "pending" && <Clock size={12} />}
                      {r.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      {r.status === "pending" ? (
                        <div className="pto-action-btns">
                          <button
                            className="btn-action-approve"
                            onClick={() => handleReview(r.id, "approved")}
                            title="Approve leave"
                          >
                            Approve
                          </button>
                          <button
                            className="btn-action-reject"
                            onClick={() => handleReview(r.id, "rejected")}
                            title="Reject leave"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="muted-small">Reviewed by {r.reviewedBy || "Admin"}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Request Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Request Time Off</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateRequest} className="modal-form">
              <label className="field">
                <span>Leave Type</span>
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                  <option value="Vacation">Vacation / Holiday</option>
                  <option value="Sick Leave">Sick / Medical Leave</option>
                  <option value="Personal">Personal Leave</option>
                  <option value="Bereavement">Bereavement</option>
                </select>
              </label>

              <div className="time-row">
                <label className="field">
                  <span>Start Date</span>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>End Date</span>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>

              <label className="field">
                <span>Reason / Notes (Optional)</span>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide context for your manager..."
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
