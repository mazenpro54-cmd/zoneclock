/**
 * Time Off & PTO / Vacation Service
 * Collection: timeOff/{id}
 */
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, serverTimestamp,
} from "../firebaseCompat";
import { db } from "../firebase";

const TIMEOFF = "timeOff";

export async function getTimeOffRequests({ uid } = {}) {
  const constraints = [];
  if (uid) constraints.push(where("uid", "==", uid));
  const q = query(collection(db, TIMEOFF), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function requestTimeOff({ uid, displayName, type, startDate, endDate, daysCount, reason }) {
  return addDoc(collection(db, TIMEOFF), {
    uid,
    displayName,
    type, // "Vacation" | "Sick Leave" | "Personal" | "Bereavement"
    startDate,
    endDate,
    daysCount: Number(daysCount) || 1,
    reason: reason || "",
    status: "pending", // "pending" | "approved" | "rejected"
    reviewedBy: null,
    createdAt: serverTimestamp(),
  });
}

export async function reviewTimeOff(id, status, reviewedBy) {
  await updateDoc(doc(db, TIMEOFF, id), {
    status, // "approved" | "rejected"
    reviewedBy,
    reviewedAt: serverTimestamp(),
  });
}
