import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getClients, createClient, updateClient, archiveClient } from "../services/clients";
import { getSessions, msToHoursDecimal } from "../services/sessions";
import {
  Briefcase, Plus, Coins, Clock, Users, Building, Mail,
  TrendingUp, CheckCircle, AlertCircle, Trash2
} from "lucide-react";

const PROJECTS_LIST = [
  "General", "Development", "Design", "Marketing",
  "Support", "Management", "Meetings", "Research"
];

export default function ClientsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [hourlyRate, setHourlyRate] = useState(650);
  const [budgetHours, setBudgetHours] = useState(100);
  const [selectedProjects, setSelectedProjects] = useState(["Development"]);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [clientsData, sessionsData] = await Promise.all([
        getClients(),
        getSessions(),
      ]);
      setClients(clientsData);
      setSessions(sessionsData);
    } catch (err) {
      console.error("Error loading clients:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateClient(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createClient({
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        hourlyRate: Number(hourlyRate),
        budgetHours: Number(budgetHours),
        currency: "EGP",
        projects: selectedProjects,
      });
      setName("");
      setCompany("");
      setEmail("");
      setShowModal(false);
      await loadData();
    } catch (err) {
      alert("Failed to create client: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id) {
    if (!confirm("Are you sure you want to archive this client?")) return;
    await archiveClient(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  }

  function toggleProject(proj) {
    setSelectedProjects((prev) =>
      prev.includes(proj) ? prev.filter((p) => p !== proj) : [...prev, proj]
    );
  }

  // Calculate actual hours spent on each client's linked projects
  const getClientHours = (clientProjects = []) => {
    const matched = sessions.filter((s) => clientProjects.includes(s.project));
    const totalMs = matched.reduce(
      (sum, s) => sum + Math.max(0, (s.durationMs ?? 0) - (s.totalBreakMs ?? 0)),
      0
    );
    return msToHoursDecimal(totalMs);
  };

  // Aggregate totals
  const totalBudget = clients.reduce((sum, c) => sum + (Number(c.budgetHours) || 0), 0);
  const totalBillableValue = clients.reduce((sum, c) => {
    const hours = getClientHours(c.projects);
    return sum + hours * (Number(c.hourlyRate) || 0);
  }, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2><Briefcase size={20} /> Client & Customer Management</h2>
          <p className="muted">Track client budgets, project assignments, and billable amounts in Egyptian Pounds (EGP).</p>
        </div>
        {isAdmin && (
          <button
            className="btn-primary"
            style={{ width: "auto", padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} /> Add Client
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <Building size={24} />
          <div>
            <p className="kpi-value">{clients.length}</p>
            <p className="kpi-label">Active Clients</p>
          </div>
        </div>
        <div className="kpi-card">
          <Clock size={24} />
          <div>
            <p className="kpi-value">{totalBudget}h</p>
            <p className="kpi-label">Total Budgeted Hours</p>
          </div>
        </div>
        <div className="kpi-card">
          <Coins size={24} />
          <div>
            <p className="kpi-value">{totalBillableValue.toLocaleString()} <span style={{ fontSize: "0.9rem" }}>EGP</span></p>
            <p className="kpi-label">Total Billable Value</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="page-loader">
          <Briefcase className="spin" size={28} />
          <p>Loading clients & accounts…</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <Briefcase size={36} className="muted-icon" />
          <p className="muted">No clients added yet. Click "Add Client" to get started.</p>
        </div>
      ) : (
        <div className="clients-grid">
          {clients.map((client) => {
            const consumedHours = getClientHours(client.projects || []);
            const budget = Number(client.budgetHours) || 1;
            const rate = Number(client.hourlyRate) || 0;
            const percent = Math.min(100, Math.round((consumedHours / budget) * 100));
            const isOverBudget = consumedHours > budget;
            const billable = Math.round(consumedHours * rate);

            return (
              <div key={client.id} className="client-card">
                <div className="client-card-header">
                  <div>
                    <h3 className="client-name">{client.name}</h3>
                    {client.company && <p className="client-company">{client.company}</p>}
                  </div>
                  <div className="client-rate-badge">
                    <Coins size={13} />
                    <strong>{rate} EGP</strong>/hr
                  </div>
                </div>

                {client.email && (
                  <div className="client-email-row">
                    <Mail size={13} /> <span>{client.email}</span>
                  </div>
                )}

                {/* Progress bar */}
                <div className="budget-progress-section">
                  <div className="budget-labels">
                    <span>
                      Hours: <strong>{consumedHours}h</strong> / {budget}h
                    </span>
                    <span className={isOverBudget ? "text-danger" : "text-brand"}>
                      {percent}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${isOverBudget ? "overbudget" : ""}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="client-financials-row">
                  <div>
                    <span className="tiny-label">Accrued Billable</span>
                    <h4 className="billable-amount">{billable.toLocaleString()} EGP</h4>
                  </div>
                  <div>
                    <span className="tiny-label">Status</span>
                    <span className="status-pill-ok">Active</span>
                  </div>
                </div>

                {/* Linked Projects */}
                <div className="client-projects-tags">
                  <span className="tiny-label" style={{ display: "block", width: "100%", marginBottom: "4px" }}>
                    Assigned Projects:
                  </span>
                  {(client.projects || []).map((p) => (
                    <span key={p} className="project-badge">{p}</span>
                  ))}
                </div>

                {isAdmin && (
                  <div className="client-card-footer">
                    <button
                      className="btn-icon-danger"
                      onClick={() => handleArchive(client.id)}
                      title="Archive Client"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Client Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Client</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateClient} className="modal-form">
              <label className="field">
                <span>Client / Contact Name</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ahmed Hassan"
                />
              </label>

              <label className="field">
                <span>Company Name</span>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Nile Innovations"
                />
              </label>

              <label className="field">
                <span>Billing Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@company.com"
                />
              </label>

              <div className="time-row">
                <label className="field">
                  <span>Hourly Rate (EGP/hr)</span>
                  <input
                    type="number"
                    required
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Budget Hours</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={budgetHours}
                    onChange={(e) => setBudgetHours(e.target.value)}
                  />
                </label>
              </div>

              <div className="field">
                <span>Assign Projects</span>
                <div className="project-chips-selector">
                  {PROJECTS_LIST.map((proj) => {
                    const isSelected = selectedProjects.includes(proj);
                    return (
                      <button
                        key={proj}
                        type="button"
                        className={`chip-button ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleProject(proj)}
                      >
                        {proj}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
