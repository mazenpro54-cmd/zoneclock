import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
} from "../firebaseCompat";
import { db } from "../firebase";

const SESSIONS = "sessions";

export function reviveSession(session) {
  if (!session) return null;
  const s = { ...session };
  if (s.checkInTime) {
    const ms =
      typeof s.checkInTime?.toMillis === "function"
        ? s.checkInTime.toMillis()
        : s.checkInTime?._ms ||
          (s.checkInTime?.seconds ? s.checkInTime.seconds * 1000 : null) ||
          (typeof s.checkInTime === "number" ? s.checkInTime : Date.now());
    s.checkInTime = {
      _ms: ms,
      seconds: ms / 1000,
      toMillis: () => ms,
      toDate: () => new Date(ms),
    };
  }
  return s;
}

export async function checkIn({ uid, displayName, project, note, location, taskId }) {
  const nowMs = Date.now();
  const ts = {
    _ms: nowMs,
    seconds: nowMs / 1000,
    toMillis: () => nowMs,
    toDate: () => new Date(nowMs),
  };
  return addDoc(collection(db, SESSIONS), {
    uid,
    displayName,
    project: project || "General",
    note: note || "",
    location: location || null,
    taskId: taskId || null,
    checkInTime: ts,
    checkOutTime: null,
    breaks: [],
    status: "active",
    totalBreakMs: 0,
    durationMs: null,
  });
}

export async function checkOut(sessionId, checkInTimeMs, exitReason = "manual", totalBreakMs = 0) {
  const now = Date.now();
  const rawDurationMs = Math.max(0, now - (checkInTimeMs || now));
  const netDurationMs = Math.max(0, rawDurationMs - (totalBreakMs || 0));
  const ts = {
    _ms: now,
    seconds: now / 1000,
    toMillis: () => now,
    toDate: () => new Date(now),
  };
  await updateDoc(doc(db, SESSIONS, sessionId), {
    checkOutTime: ts,
    durationMs: netDurationMs,
    grossDurationMs: rawDurationMs,
    totalBreakMs: totalBreakMs || 0,
    status: "done",
    exitReason,
  });
}

export async function startBreak(sessionId, currentBreaks) {
  const breakEntry = { start: Date.now(), end: null };
  await updateDoc(doc(db, SESSIONS, sessionId), {
    breaks: [...currentBreaks, breakEntry],
    status: "break",
  });
}

export async function endBreak(sessionId, currentBreaks) {
  const updated = currentBreaks.map((b, i) =>
    i === currentBreaks.length - 1 ? { ...b, end: Date.now() } : b
  );
  const totalBreakMs = updated.reduce(
    (sum, b) => sum + ((b.end || Date.now()) - b.start),
    0
  );
  await updateDoc(doc(db, SESSIONS, sessionId), {
    breaks: updated,
    totalBreakMs,
    status: "active",
  });
}

export async function getActiveSession(uid) {
  const q = query(
    collection(db, SESSIONS),
    where("uid", "==", uid),
    where("status", "in", ["active", "break"]),
    orderBy("checkInTime", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getSessions({ uid, from, to } = {}) {
  const constraints = [orderBy("checkInTime", "desc")];
  if (uid) constraints.unshift(where("uid", "==", uid));
  if (from) constraints.unshift(where("checkInTime", ">=", Timestamp.fromDate(from)));
  if (to)   constraints.unshift(where("checkInTime", "<=", Timestamp.fromDate(to)));
  const q = query(collection(db, SESSIONS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function msToHMS(ms) {
  if (!ms || ms < 0) return "0h 0m 0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export function msToHoursDecimal(ms) {
  if (!ms) return 0;
  return Math.round((ms / 3600000) * 100) / 100;
}

/**
 * Returns net work duration in milliseconds.
 * If grossDurationMs exists, durationMs already reflects net duration (breaks deducted).
 * For legacy sessions lacking grossDurationMs, subtracts totalBreakMs from durationMs.
 */
export function getNetDurationMs(session) {
  if (!session) return 0;
  if (session.grossDurationMs != null) {
    return Math.max(0, session.durationMs ?? 0);
  }
  return Math.max(0, (session.durationMs ?? 0) - (session.totalBreakMs ?? 0));
}
