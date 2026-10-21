import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getAllShifts, getShiftsForUser, createShift, deleteShift } from "../services/shifts";
import { getTeams } from "../services/teams";
import { collection, getDocs, query, orderBy } from "../firebaseCompat";
import { db } from "../firebase";
import { Calendar, Clock, Plus, Trash2, User, Users } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";

export default function ShiftsPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [shifts, setShifts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state for scheduling
  const [targetUid, setTargetUid] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("");
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [shiftTitle, setShiftTitle] = useState("Regular Shift");
  const [saving, setSaving] = useState(false);

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(addDays(new Date(), 14), { weekStartsOn: 1 }), "yyyy-MM-dd");

  async function loadData() {
    setLoading(true);
    try {
      const [teamsData, usersSnap] = await Promise.all([
        getTeams(),
        getDocs(query(collection(db, "users"), orderBy("displayName"))),
      ]);
      const usersList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeams(teamsData);
      setEmployees(usersList);

      if (isAdmin) {
        const allShifts = await getAllShifts(weekStart, weekEnd);
        setShifts(allShifts);
      } else {
        const userShifts = await getShiftsForUser(user.uid, weekStart, weekEnd);
        setShifts(userShifts);
      }
    } catch (err) {
      console.error("Error loading shifts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [user, isAdmin]);

  async function handleCreateShift(e) {
    e.preventDefault();
    if (!targetUid) return;
    setSaving(true);
    try {
      await createShift({
        uid: targetUid,
        teamId: targetTeamId || null,
        date: shiftDate,
        startTime,
        endTime,
        title: shiftTitle,
        assignedBy: profile?.displayName || user.email,
      });
      setShowModal(false);
      await loadData();
    } catch (err) {
      alert("Failed to schedule shift: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to cancel this shift?")) return;
    await deleteShift(id);
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  const employeeName = (uid) => {
    const emp = employees.find((e) => (e.uid || e.id) === uid);
    return emp ? emp.displayName || emp.email : "Employee";
  };

  const teamName = (tid) => {
    const t = teams.find((item) => item.id === tid);
    return t ? t.name : null;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>
          <Calendar size={20} /> Shift Scheduling
        </h2>
        {isAdmin && (
          <button className="btn-primary" style={{ width: "auto", padding: "0.5rem 1rem", fontSize: "0.85rem" }} onClick={() => setShowModal(true)}>
            <Plus size={16} /> Schedule Shift
          </button>
        )}
      </div>

      <p className="muted" style={{ marginBottom: "1rem" }}>
        {isAdmin ? "Manage and assign team shifts across upcoming weeks." : "Your upcoming scheduled work shifts."}
      </p>

      {loading ? (
        <div className="page-loader">
          <Clock className="spin" size={28} />
          <p>Loading schedule…</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="empty-state">
          <Calendar size={36} className="muted-icon" />
          <p className="muted">No upcoming shifts scheduled for this period.</p>
        </div>
      ) : (
        <div className="shifts-list">
          {shifts.map((s) => {
            const isToday = s.date === new Date().toISOString().slice(0, 10);
            return (
              <div key={s.id} className={`shift-card ${isToday ? "today" : ""}`}>
                <div className="shift-header">
                  <div className="shift-date-badge">
                    <span>{format(new Date(s.date + "T00:00:00"), "EEE")}</span>
                    <strong>{format(new Date(s.date + "T00:00:00"), "MMM d")}</strong>
                  </div>
                  <div className="shift-info">
                    <h4>{s.title}</h4>
                    <p className="shift-time">
                      <Clock size={13} /> {s.startTime} - {s.endTime}
                    </p>
                    <div className="shift-tags">
                      {isAdmin && (
                        <span className="shift-pill user-pill">
                          <User size={12} /> {employeeName(s.uid)}
                        </span>
                      )}
                      {s.teamId && teamName(s.teamId) && (
                        <span className="shift-pill team-pill">
                          <Users size={12} /> {teamName(s.teamId)}
                        </span>
                      )}
                      {isToday && <span className="today-badge">Today</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <button className="btn-icon-danger" onClick={() => handleDelete(s.id)} title="Cancel Shift">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Shift Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule New Shift</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateShift} className="modal-form">
              <label className="field">
                <span>Employee</span>
                <select
                  required
                  value={targetUid}
                  onChange={(e) => setTargetUid(e.target.value)}
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.uid || emp.id} value={emp.uid || emp.id}>
                      {emp.displayName || emp.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Team (Optional)</span>
                <select
                  value={targetTeamId}
                  onChange={(e) => setTargetTeamId(e.target.value)}
                >
                  <option value="">No specific team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Shift Title / Type</span>
                <input
                  type="text"
                  required
                  value={shiftTitle}
                  onChange={(e) => setShiftTitle(e.target.value)}
                  placeholder="e.g. Morning Shift, Support Coverage"
                />
              </label>

              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  required
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                />
              </label>

              <div className="time-row">
                <label className="field">
                  <span>Start Time</span>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>End Time</span>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Scheduling..." : "Assign Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
