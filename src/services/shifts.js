/**
 * Shift scheduling service
 * Collection: shifts/{shiftId} { uid, teamId, date (ISO), startTime, endTime, title, assignedBy }
 */
import {
  collection, doc, addDoc, updateDoc, getDocs, query,
  where, orderBy, serverTimestamp, Timestamp,
} from "../firebaseCompat";
import { db } from "../firebase";

const SHIFTS = "shifts";

export async function createShift({ uid, teamId, date, startTime, endTime, title, assignedBy }) {
  return addDoc(collection(db, SHIFTS), {
    uid,
    teamId: teamId || null,
    date,        // "YYYY-MM-DD"
    startTime,   // "HH:MM"
    endTime,     // "HH:MM"
    title: title || "Shift",
    assignedBy,
    createdAt: serverTimestamp(),
  });
}

export async function getAllShifts(from, to) {
  const constraints = [
    where("date", ">=", from),
    where("date", "<=", to),
    orderBy("date"),
  ];
  const snap = await getDocs(query(collection(db, SHIFTS), ...constraints));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => !s.deleted);
}

export async function getShiftsForUser(uid, from, to) {
  const constraints = [
    where("uid", "==", uid),
    where("date", ">=", from), // "YYYY-MM-DD" string comparison works
    where("date", "<=", to),
    orderBy("date"),
    orderBy("startTime"),
  ];
  const snap = await getDocs(query(collection(db, SHIFTS), ...constraints));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => !s.deleted);
}

export async function getShiftsForTeam(teamId, from, to) {
  const constraints = [
    where("teamId", "==", teamId),
    where("date", ">=", from),
    where("date", "<=", to),
    orderBy("date"),
  ];
  const snap = await getDocs(query(collection(db, SHIFTS), ...constraints));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => !s.deleted);
}

export async function deleteShift(shiftId) {
  await updateDoc(doc(db, SHIFTS, shiftId), { deleted: true });
}
