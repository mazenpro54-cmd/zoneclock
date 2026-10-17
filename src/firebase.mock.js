/**
 * Mock Firebase — used when no real Firebase credentials are configured.
 * Simulates auth + Firestore in-memory so you can test the full UI locally.
 */

// ─── LocalStorage Persistence ────────────────────────────────────────────────
const STORAGE_PREFIX = "zoneclock_mock_";

function _loadStorage(key, fallback) {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_PREFIX + key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function _saveStorage(key, data) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
    }
  } catch (err) {
    console.warn("Storage save error for " + key, err);
  }
}

export function _reviveTs(val) {
  if (!val) return val;
  if (Array.isArray(val)) return val.map(_reviveTs);
  if (typeof val !== "object") return val;
  const out = { ...val };
  for (const [k, v] of Object.entries(out)) {
    if (v && typeof v === "object") {
      if (typeof v._ms === "number" || typeof v.seconds === "number") {
        const ms = v._ms || v.seconds * 1000;
        out[k] = {
          _ms: ms,
          seconds: ms / 1000,
          toMillis: () => ms,
          toDate: () => new Date(ms),
        };
      } else {
        out[k] = _reviveTs(v);
      }
    }
  }
  return out;
}

let _user = _loadStorage("user", null);
let _authListeners = [];

function _makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function _now() {
  const ms = Date.now();
  return {
    _ms: ms,
    seconds: ms / 1000,
    toDate: () => new Date(ms),
    toMillis: () => ms,
  };
}

function _tsDaysAgo(days, hours = 9) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hours, 0, 0, 0);
  const ms = d.getTime();
  return {
    _ms: ms,
    seconds: ms / 1000,
    toDate: () => d,
    toMillis: () => ms,
  };
}

const _docs = {
  // Pre-seeded Admin account for Mazen
  "users/mazen-admin": {
    uid: "mazen-admin",
    email: "mazenpro54@gmail.com",
    displayName: "Mazen",
    role: "admin",
    hourlyPayRate: 650,
    ptoBalance: { vacation: 14, sick: 7 },
    createdAt: _now(),
  },
  "users/demo-emp1": {
    uid: "demo-emp1",
    email: "alex@zoneclock.app",
    displayName: "Alex Rivera",
    role: "employee",
    hourlyPayRate: 450,
    ptoBalance: { vacation: 10, sick: 5 },
    createdAt: _now(),
  },
  "users/demo-emp2": {
    uid: "demo-emp2",
    email: "jordan@zoneclock.app",
    displayName: "Jordan Lee",
    role: "employee",
    hourlyPayRate: 350,
    ptoBalance: { vacation: 12, sick: 6 },
    createdAt: _now(),
  }
};

const _clients = [
  {
    id: "client-acme",
    name: "Acme Global Corp",
    company: "Acme Enterprises",
    email: "billing@acme.com",
    hourlyRate: 850,
    budgetHours: 120,
    currency: "EGP",
    projects: ["Development", "Meetings"],
    status: "active",
    createdAt: _now(),
  },
  {
    id: "client-strata",
    name: "Strata Labs",
    company: "Strata Interactive",
    email: "ops@stratalabs.io",
    hourlyRate: 950,
    budgetHours: 80,
    currency: "EGP",
    projects: ["Design", "Research"],
    status: "active",
    createdAt: _now(),
  },
  {
    id: "client-vortex",
    name: "Vortex Media",
    company: "Vortex Media LLC",
    email: "accounts@vortex.media",
    hourlyRate: 700,
    budgetHours: 50,
    currency: "EGP",
    projects: ["Marketing", "Support"],
    status: "active",
    createdAt: _now(),
  }
];

const _teams = [
  {
    id: "team-eng",
    name: "Engineering",
    description: "Frontend, Backend & Mobile developers",
    memberUids: ["mazen-admin", "demo-emp1"],
    adminUid: "mazen-admin",
    createdAt: _now(),
  },
  {
    id: "team-design",
    name: "Design & Product",
    description: "UI/UX, Branding and Research",
    memberUids: ["demo-emp1", "demo-emp2"],
    adminUid: "mazen-admin",
    createdAt: _now(),
  }
];

const _shifts = [
  {
    id: "shift-1",
    uid: "demo-emp1",
    teamId: "team-eng",
    date: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "17:00",
    title: "Core Development Shift",
    assignedBy: "Mazen",
    createdAt: _now(),
  },
  {
    id: "shift-2",
    uid: "demo-emp2",
    teamId: "team-design",
    date: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: "18:00",
    title: "Sprint Review & UI Shift",
    assignedBy: "Mazen",
    createdAt: _now(),
  }
];

const _timeOff = [
  {
    id: "to-1",
    uid: "demo-emp1",
    displayName: "Alex Rivera",
    type: "Vacation",
    startDate: "2026-10-14",
    endDate: "2026-10-16",
    daysCount: 3,
    reason: "Autumn family holiday and recharge",
    status: "approved",
    reviewedBy: "Mazen",
    createdAt: _now(),
  },
  {
    id: "to-2",
    uid: "demo-emp2",
    displayName: "Jordan Lee",
    type: "Sick Leave",
    startDate: "2026-10-20",
    endDate: "2026-10-21",
    daysCount: 2,
    reason: "Doctor consultation and rest",
    status: "pending",
    reviewedBy: null,
    createdAt: _now(),
  }
];

const _tasks = [
  {
    id: "task-1",
    title: "Implement Slack & Discord Webhooks",
    description: "Send automated check-in and overtime alerts to company communication channels.",
    project: "Development",
    status: "in_progress", // "todo" | "in_progress" | "done"
    priority: "high", // "low" | "medium" | "high" | "urgent"
    assignedUid: "mazen-admin",
    assignedName: "Mazen",
    estimatedHours: 6,
    trackedHours: 3.5,
    createdAt: _now(),
  },
  {
    id: "task-2",
    title: "Redesign Mobile Navigation Shell",
    description: "Ensure touch targets meet WCAG standards on iOS Safari and Android Chrome.",
    project: "Design",
    status: "todo",
    priority: "medium",
    assignedUid: "demo-emp1",
    assignedName: "Alex Rivera",
    estimatedHours: 4,
    trackedHours: 0,
    createdAt: _now(),
  },
  {
    id: "task-3",
    title: "Customer Escalation Runbook",
    description: "Document incident response steps for tier-2 enterprise clients.",
    project: "Support",
    status: "done",
    priority: "low",
    assignedUid: "demo-emp2",
    assignedName: "Jordan Lee",
    estimatedHours: 5,
    trackedHours: 4.8,
    createdAt: _now(),
  },
  {
    id: "task-4",
    title: "Payroll Overtime Calculation Multipliers",
    description: "Support 1.5x pay rates for hours exceeding weekly standard limits.",
    project: "Development",
    status: "todo",
    priority: "urgent",
    assignedUid: "mazen-admin",
    assignedName: "Mazen",
    estimatedHours: 3,
    trackedHours: 1.2,
    createdAt: _now(),
  }
];

// Pre-seeded sessions for rich analytics, payroll, and live map
const _initialSessions = [
  {
    id: "sess-1",
    uid: "mazen-admin",
    displayName: "Mazen",
    project: "Development",
    taskId: "task-1",
    note: "Built Client Management & Live GPS map modules",
    status: "done",
    location: { lat: 30.0444, lng: 31.2357, accuracy: 12 },
    checkInTime: _tsDaysAgo(0, 9),
    checkOutTime: _tsDaysAgo(0, 16),
    durationMs: 7 * 3600000,
    totalBreakMs: 45 * 60000,
    breaks: [{ start: Date.now() - 4 * 3600000, end: Date.now() - 3.25 * 3600000 }],
  },
  {
    id: "sess-2",
    uid: "demo-emp1",
    displayName: "Alex Rivera",
    project: "Design",
    taskId: "task-2",
    note: "Design system refresh and responsive testing",
    status: "done",
    location: { lat: 30.0510, lng: 31.2420, accuracy: 18 },
    checkInTime: _tsDaysAgo(1, 10),
    checkOutTime: _tsDaysAgo(1, 17),
    durationMs: 7 * 3600000,
    totalBreakMs: 30 * 60000,
    breaks: [{ start: Date.now() - 24 * 3600000, end: Date.now() - 23.5 * 3600000 }],
  },
  {
    id: "sess-3",
    uid: "demo-emp2",
    displayName: "Jordan Lee",
    project: "Support",
    taskId: "task-3",
    note: "Customer onboarding & support queue review",
    status: "done",
    location: { lat: 30.0380, lng: 31.2290, accuracy: 25 },
    checkInTime: _tsDaysAgo(2, 8),
    checkOutTime: _tsDaysAgo(2, 16),
    durationMs: 8 * 3600000,
    totalBreakMs: 60 * 60000,
    breaks: [],
  },
  {
    id: "sess-4",
    uid: "mazen-admin",
    displayName: "Mazen",
    project: "Development",
    taskId: "task-4",
    note: "Architecture & Firebase Firestore security hardening",
    status: "done",
    location: { lat: 30.0444, lng: 31.2357, accuracy: 15 },
    checkInTime: _tsDaysAgo(3, 9),
    checkOutTime: _tsDaysAgo(3, 17),
    durationMs: 8 * 3600000,
    totalBreakMs: 30 * 60000,
    breaks: [],
  },
  {
    id: "sess-5",
    uid: "demo-emp1",
    displayName: "Alex Rivera",
    project: "Marketing",
    note: "Landing page copy and promotional assets",
    status: "done",
    location: { lat: 30.0520, lng: 31.2450, accuracy: 20 },
    checkInTime: _tsDaysAgo(4, 9),
    checkOutTime: _tsDaysAgo(4, 15),
    durationMs: 6 * 3600000,
    totalBreakMs: 20 * 60000,
    breaks: [],
  }
];

const _storedSessions = _loadStorage("sessions", null);
const _sessions = _storedSessions ? _reviveTs(_storedSessions) : [..._initialSessions];

function _saveSessions() {
  _saveStorage("sessions", _sessions);
}

function _notify() {
  _saveStorage("user", _user);
  if (auth) auth.currentUser = _user;
  _authListeners.forEach((cb) => cb(_user));
}

// ─── Mock Auth ───────────────────────────────────────────────────────────────
export const auth = {
  currentUser: _user,
};

export const googleProvider = {};

export function onAuthStateChanged(auth, cb) {
  _authListeners.push(cb);
  cb(_user);
  return () => { _authListeners = _authListeners.filter((x) => x !== cb); };
}

export async function signInWithPopup() {
  _user = {
    uid: "mazen-admin",
    email: "mazenpro54@gmail.com",
    displayName: "Mazen",
    photoURL: null,
  };
  auth.currentUser = _user;
  _notify();
  return { user: _user };
}

async function _sha256(str) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return str;
}

export async function signInWithEmailAndPassword(auth, email, password) {
  const normEmail = (email || "").trim().toLowerCase();

  if (normEmail === "mazenpro54@gmail.com") {
    const hash = await _sha256(password);
    if (hash !== "0e0487c11812b75307481e441cd74b0502555f7d6f6328cc476faa452df84731") {
      throw new Error("Invalid administrative credentials.");
    }
    _user = {
      uid: "mazen-admin",
      email: "mazenpro54@gmail.com",
      displayName: "Mazen",
      photoURL: null,
    };
    auth.currentUser = _user;
    _notify();
    return { user: _user };
  }

  if (password.length < 6) throw new Error("Password must be at least 6 characters.");
  const uid = "demo-" + normEmail.replace(/\W/g, "");
  _user = {
    uid,
    email: normEmail,
    displayName: normEmail.split("@")[0],
    photoURL: null,
  };
  auth.currentUser = _user;
  _notify();
  return { user: _user };
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function updateProfile(user, { displayName }) {
  if (_user) _user.displayName = displayName;
}

export async function signOut() {
  _user = null;
  auth.currentUser = null;
  _notify();
}

// ─── Mock Firestore ───────────────────────────────────────────────────────────
export const db = {};

export function serverTimestamp() { return _now(); }
export function Timestamp() {}
Timestamp.fromDate = (d) => ({ toDate: () => d, toMillis: () => d.getTime() });

export function arrayUnion(...elements) {
  return { _op: "arrayUnion", elements };
}

export function arrayRemove(...elements) {
  return { _op: "arrayRemove", elements };
}

export function doc(db, col, id) {
  return { _col: col, _id: id, _key: `${col}/${id}` };
}

export function collection(db, col) {
  return { _col: col };
}

export async function getDoc(ref) {
  let data = _docs[ref._key];
  if (!data) {
    if (ref._col === "teams") data = _teams.find((t) => t.id === ref._id);
    else if (ref._col === "shifts") data = _shifts.find((s) => s.id === ref._id);
    else if (ref._col === "sessions") data = _sessions.find((s) => s.id === ref._id);
    else if (ref._col === "clients") data = _clients.find((c) => c.id === ref._id);
    else if (ref._col === "timeOff") data = _timeOff.find((t) => t.id === ref._id);
    else if (ref._col === "tasks") data = _tasks.find((t) => t.id === ref._id);
  }
  return {
    exists: () => !!data,
    data: () => data,
    id: ref._id,
  };
}

export async function setDoc(ref, data) {
  _docs[ref._key] = { ...data };
}

export async function updateDoc(ref, patch) {
  const current = _docs[ref._key] || {};
  const updated = { ...current };

  for (const [key, val] of Object.entries(patch)) {
    if (val && val._op === "arrayUnion") {
      const arr = Array.isArray(updated[key]) ? [...updated[key]] : [];
      val.elements.forEach((el) => {
        if (!arr.includes(el)) arr.push(el);
      });
      updated[key] = arr;
    } else if (val && val._op === "arrayRemove") {
      const arr = Array.isArray(updated[key]) ? [...updated[key]] : [];
      updated[key] = arr.filter((el) => !val.elements.includes(el));
    } else {
      updated[key] = val;
    }
  }

  _docs[ref._key] = updated;

  if (ref._col === "sessions") {
    const idx = _sessions.findIndex((s) => s.id === ref._id);
    if (idx >= 0) _sessions[idx] = { ..._sessions[idx], ...updated };
    _saveSessions();
  } else if (ref._col === "teams") {
    const idx = _teams.findIndex((t) => t.id === ref._id);
    if (idx >= 0) _teams[idx] = { ..._teams[idx], ...updated };
  } else if (ref._col === "shifts") {
    const idx = _shifts.findIndex((s) => s.id === ref._id);
    if (idx >= 0) _shifts[idx] = { ..._shifts[idx], ...updated };
  } else if (ref._col === "clients") {
    const idx = _clients.findIndex((c) => c.id === ref._id);
    if (idx >= 0) _clients[idx] = { ..._clients[idx], ...updated };
  } else if (ref._col === "timeOff") {
    const idx = _timeOff.findIndex((t) => t.id === ref._id);
    if (idx >= 0) _timeOff[idx] = { ..._timeOff[idx], ...updated };
  } else if (ref._col === "tasks") {
    const idx = _tasks.findIndex((t) => t.id === ref._id);
    if (idx >= 0) _tasks[idx] = { ..._tasks[idx], ...updated };
  }
}

export async function addDoc(colRef, data) {
  const id = _makeId();
  const created = _now();
  const docData = { ...data, id, createdAt: created };

  if (colRef._col === "sessions") {
    docData.checkInTime = docData.checkInTime || created;
    _sessions.unshift(docData);
    _saveSessions();
  } else if (colRef._col === "teams") {
    _teams.push(docData);
  } else if (colRef._col === "shifts") {
    _shifts.push(docData);
  } else if (colRef._col === "clients") {
    _clients.push(docData);
  } else if (colRef._col === "timeOff") {
    _timeOff.push(docData);
  } else if (colRef._col === "tasks") {
    _tasks.push(docData);
  }

  _docs[`${colRef._col}/${id}`] = docData;
  return { id };
}

export async function getDocs(q) {
  let results = [];
  if (q._col === "sessions") {
    results = [..._sessions];
    if (q._uid) results = results.filter((s) => s.uid === q._uid);
    if (q._statuses) results = results.filter((s) => q._statuses.includes(s.status));
    if (q._from) results = results.filter((s) => s.checkInTime?.toMillis?.() >= q._from.getTime());
    if (q._to) results = results.filter((s) => s.checkInTime?.toMillis?.() <= q._to.getTime());
    results.sort((a, b) => (b.checkInTime?.toMillis?.() || 0) - (a.checkInTime?.toMillis?.() || 0));
    if (q._limit) results = results.slice(0, q._limit);
  } else if (q._col === "users") {
    results = Object.entries(_docs)
      .filter(([k]) => k.startsWith("users/"))
      .map(([k, v]) => ({ id: k.split("/")[1], ...v }));
  } else if (q._col === "teams") {
    results = _teams.filter((t) => !t.archived);
    if (q._memberUid) {
      results = results.filter((t) => t.memberUids && t.memberUids.includes(q._memberUid));
    }
    results.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (q._col === "shifts") {
    results = _shifts.filter((s) => !s.deleted);
    if (q._uid) results = results.filter((s) => s.uid === q._uid);
    if (q._teamId) results = results.filter((s) => s.teamId === q._teamId);
    if (q._fromDate) results = results.filter((s) => s.date >= q._fromDate);
    if (q._toDate) results = results.filter((s) => s.date <= q._toDate);
    results.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.startTime || "").localeCompare(b.startTime || ""));
  } else if (q._col === "clients") {
    results = _clients.filter((c) => !c.archived);
    results.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (q._col === "timeOff") {
    results = [..._timeOff];
    if (q._uid) results = results.filter((t) => t.uid === q._uid);
    results.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  } else if (q._col === "tasks") {
    results = [..._tasks];
    if (q._project) results = results.filter((t) => t.project === q._project);
    if (q._status) results = results.filter((t) => t.status === q._status);
    if (q._assignedUid) results = results.filter((t) => t.assignedUid === q._assignedUid);
    results.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }

  return {
    empty: results.length === 0,
    docs: results.map((r) => ({
      id: r.id,
      data: () => r,
      exists: () => true,
    })),
  };
}

// ─── Mock query builder ───────────────────────────────────────────────────────
export function query(colRef, ...constraints) {
  const q = { _col: colRef._col };
  constraints.forEach((c) => Object.assign(q, c));
  return q;
}

export function where(field, op, val) {
  if (field === "uid") return { _uid: val };
  if (field === "assignedUid") return { _assignedUid: val };
  if (field === "project") return { _project: val };
  if (field === "teamId") return { _teamId: val };
  if (field === "memberUids" && op === "array-contains") return { _memberUid: val };
  if (field === "date" && op === ">=") return { _fromDate: val };
  if (field === "date" && op === "<=") return { _toDate: val };
  if (field === "status") {
    if (op === "in") return { _statuses: val };
    return { _status: val, _statuses: [val] };
  }
  if (field === "checkInTime" && op === ">=") return { _from: val instanceof Date ? val : val.toDate?.() };
  if (field === "checkInTime" && op === "<=") return { _to: val instanceof Date ? val : val.toDate?.() };
  return {};
}

export function orderBy() { return {}; }
export function limit(n) { return { _limit: n }; }
