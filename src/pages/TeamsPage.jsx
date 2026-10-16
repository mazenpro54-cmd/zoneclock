import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getTeams, createTeam, addMemberToTeam, removeMemberFromTeam } from "../services/teams";
import { collection, getDocs, query, orderBy } from "../firebaseCompat";
import { db } from "../firebase";
import { Users, Plus, UserPlus, UserMinus, Shield, Briefcase, Mail } from "lucide-react";

export default function TeamsPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New team form state
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Add member dropdown selection per team
  const [selectedUserForTeam, setSelectedUserForTeam] = useState({});

  async function loadData() {
    setLoading(true);
    try {
      const [teamsData, usersSnap] = await Promise.all([
        getTeams(),
        getDocs(query(collection(db, "users"), orderBy("displayName"))),
      ]);
      setTeams(teamsData);
      setEmployees(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading teams:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      await createTeam({
        name: teamName.trim(),
        description: teamDesc.trim(),
        adminUid: user.uid,
      });
      setTeamName("");
      setTeamDesc("");
      setShowModal(false);
      await loadData();
    } catch (err) {
      alert("Failed to create team: " + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleAddMember(teamId) {
    const targetUid = selectedUserForTeam[teamId];
    if (!targetUid) return;
    await addMemberToTeam(teamId, targetUid);
    setSelectedUserForTeam((prev) => ({ ...prev, [teamId]: "" }));
    await loadData();
  }

  async function handleRemoveMember(teamId, uid) {
    if (!confirm("Remove this member from the team?")) return;
    await removeMemberFromTeam(teamId, uid);
    await loadData();
  }

  const getMemberDetails = (uid) => {
    return employees.find((e) => (e.uid || e.id) === uid) || { displayName: "User", email: uid };
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>
          <Users size={20} /> Teams & Departments
        </h2>
        {isAdmin && (
          <button
            className="btn-primary"
            style={{ width: "auto", padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} /> New Team
          </button>
        )}
      </div>

      <p className="muted" style={{ marginBottom: "1.25rem" }}>
        Organize employees by department, project squad, or branch office.
      </p>

      {loading ? (
        <div className="page-loader">
          <Briefcase className="spin" size={28} />
          <p>Loading teams…</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="empty-state">
          <Users size={36} className="muted-icon" />
          <p className="muted">No teams created yet.</p>
        </div>
      ) : (
        <div className="teams-grid">
          {teams.map((t) => {
            const memberUids = t.memberUids || [];
            const nonMembers = employees.filter((e) => !memberUids.includes(e.uid || e.id));

            return (
              <div key={t.id} className="team-card">
                <div className="team-card-header">
                  <div>
                    <h3 className="team-title">{t.name}</h3>
                    {t.description && <p className="team-desc">{t.description}</p>}
                  </div>
                  <span className="member-count-badge">
                    {memberUids.length} {memberUids.length === 1 ? "member" : "members"}
                  </span>
                </div>

                <div className="team-members-list">
                  <h5 className="sub-label">Members</h5>
                  {memberUids.length === 0 ? (
                    <p className="muted-small">No members in this team yet.</p>
                  ) : (
                    memberUids.map((uid) => {
                      const m = getMemberDetails(uid);
                      return (
                        <div key={uid} className="member-row">
                          <div className="member-avatar">
                            {(m.displayName || m.email || "U")[0].toUpperCase()}
                          </div>
                          <div className="member-meta">
                            <span className="member-name">{m.displayName || m.email}</span>
                            <span className="member-email">{m.email}</span>
                          </div>
                          {isAdmin && (
                            <button
                              className="btn-icon-subtle"
                              onClick={() => handleRemoveMember(t.id, uid)}
                              title="Remove member"
                            >
                              <UserMinus size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {isAdmin && nonMembers.length > 0 && (
                  <div className="add-member-bar">
                    <select
                      value={selectedUserForTeam[t.id] || ""}
                      onChange={(e) =>
                        setSelectedUserForTeam((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      className="compact-select"
                    >
                      <option value="">Add employee...</option>
                      {nonMembers.map((emp) => (
                        <option key={emp.uid || emp.id} value={emp.uid || emp.id}>
                          {emp.displayName || emp.email}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-sm"
                      onClick={() => handleAddMember(t.id)}
                      disabled={!selectedUserForTeam[t.id]}
                    >
                      <UserPlus size={14} /> Add
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Team Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Department / Team</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateTeam} className="modal-form">
              <label className="field">
                <span>Team Name</span>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Mobile Engineering, Customer Care"
                />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  placeholder="What is this team responsible for?"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? "Creating..." : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
