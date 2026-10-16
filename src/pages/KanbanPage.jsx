import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getTasks, createTask, updateTaskStatus, deleteTask } from "../services/tasks";
import { collection, getDocs, query, orderBy } from "../firebaseCompat";
import { db } from "../firebase";
import {
  Kanban, Plus, Clock, User, Tag, ArrowRight, ArrowLeft,
  CheckCircle, AlertCircle, Trash2, Filter
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const PROJECTS = [
  "ALL", "Development", "Design", "Marketing",
  "Support", "Management", "Meetings", "Research"
];

export default function KanbanPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState("ALL");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("Development");
  const [priority, setPriority] = useState("medium");
  const [assignedUid, setAssignedUid] = useState(user.uid);
  const [estimatedHours, setEstimatedHours] = useState(4);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [tasksData, usersSnap] = await Promise.all([
        getTasks({ project: filterProject }),
        getDocs(query(collection(db, "users"), orderBy("displayName"))),
      ]);
      setTasks(tasksData.filter((t) => !t.deleted));
      setEmployees(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading tasks:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filterProject]);

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const assignee = employees.find((emp) => (emp.uid || emp.id) === assignedUid);
      await createTask({
        title: title.trim(),
        description: description.trim(),
        project,
        priority,
        assignedUid,
        assignedName: assignee?.displayName || assignee?.email || "Unassigned",
        estimatedHours,
      });
      setTitle("");
      setDescription("");
      setShowModal(false);
      await loadData();
    } catch (err) {
      alert("Failed to create task: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(taskId, nextStatus) {
    await updateTaskStatus(taskId, nextStatus);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
    );
  }

  async function handleDelete(taskId) {
    if (!confirm("Delete this task?")) return;
    await deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  const columns = [
    { id: "todo", title: "To Do", color: "#64748b" },
    { id: "in_progress", title: "In Progress", color: "#38bdf8" },
    { id: "done", title: "Done", color: "#22c55e" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2><Kanban size={20} /> Tasks & Kanban Board</h2>
          <p className="muted">Track deliverables, assign work, and clock into tasks.</p>
        </div>
        <div className="header-actions">
          {/* Project Filter */}
          <div className="project-filter-wrap">
            <Filter size={14} className="muted" />
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="compact-select"
            >
              {PROJECTS.map((p) => (
                <option key={p} value={p}>{p === "ALL" ? "All Projects" : p}</option>
              ))}
            </select>
          </div>
          <button
            className="btn-primary"
            style={{ width: "auto", padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} /> New Task
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-loader">
          <Clock className="spin" size={28} />
          <p>Loading board…</p>
        </div>
      ) : (
        <div className="kanban-board">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="col-title-row">
                    <span className="col-indicator" style={{ backgroundColor: col.color }} />
                    <h3 className="col-title">{col.title}</h3>
                  </div>
                  <span className="col-counter">{colTasks.length}</span>
                </div>

                <div className="kanban-cards-stack">
                  {colTasks.length === 0 ? (
                    <div className="kanban-empty">No tasks in {col.title.toLowerCase()}</div>
                  ) : (
                    colTasks.map((task) => (
                      <div key={task.id} className="task-card">
                        <div className="task-card-header">
                          <span className={`priority-pill ${task.priority}`}>
                            {task.priority}
                          </span>
                          <span className="project-badge">{task.project}</span>
                        </div>

                        <h4 className="task-title">{task.title}</h4>
                        {task.description && (
                          <p className="task-desc">{task.description}</p>
                        )}

                        <div className="task-meta-row">
                          <div className="task-assignee">
                            <User size={12} />
                            <span>{task.assignedName}</span>
                          </div>
                          <div className="task-hours">
                            <Clock size={12} />
                            <span>{task.trackedHours}h / {task.estimatedHours}h</span>
                          </div>
                        </div>

                        {/* Kanban Movements */}
                        <div className="task-card-footer">
                          {col.id !== "todo" && (
                            <button
                              className="btn-move-left"
                              onClick={() => handleMove(task.id, col.id === "done" ? "in_progress" : "todo")}
                              title="Move back"
                            >
                              <ArrowLeft size={13} />
                            </button>
                          )}
                          <button
                            className="btn-trash-task"
                            onClick={() => handleDelete(task.id)}
                            title="Delete task"
                          >
                            <Trash2 size={13} />
                          </button>
                          {col.id !== "done" && (
                            <button
                              className="btn-move-right"
                              onClick={() => handleMove(task.id, col.id === "todo" ? "in_progress" : "done")}
                              title="Move forward"
                            >
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Task Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Task</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateTask} className="modal-form">
              <label className="field">
                <span>Task Title</span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Implement user dashboard charts"
                />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task details and acceptance criteria..."
                />
              </label>

              <div className="time-row">
                <label className="field">
                  <span>Project</span>
                  <select value={project} onChange={(e) => setProject(e.target.value)}>
                    {PROJECTS.filter((p) => p !== "ALL").map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Priority</span>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
              </div>

              <div className="time-row">
                <label className="field">
                  <span>Assignee</span>
                  <select value={assignedUid} onChange={(e) => setAssignedUid(e.target.value)}>
                    {employees.map((emp) => (
                      <option key={emp.uid || emp.id} value={emp.uid || emp.id}>
                        {emp.displayName || emp.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Estimated Hours</span>
                  <input
                    type="number"
                    min="1"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
