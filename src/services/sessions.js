import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
} from "../firebaseCompat";
import { db } from "../firebase";

const SESSIONS = "sessions";

export async function checkIn({ uid, displayName, project, note, location }) {
  return addDoc(collection(db, SESSIONS), {
    uid,
    displayName,
    project: project || "General",
    note: note || "",
    location: location || null,
    checkInTime: serverTimestamp(),
    checkOutTime: null,
    breaks: [],
    status: "active",
    totalBreakMs: 0,
    durationMs: null,
  });
}

export async function checkOut(sessionId, checkInTimeMs) {
  const now = Date.now();
  await updateDoc(doc(db, SESSIONS, sessionId), {
    checkOutTime: serverTimestamp(),
    durationMs: now - checkInTimeMs,
    status: "done",
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
