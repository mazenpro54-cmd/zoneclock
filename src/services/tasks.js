/**
 * Project Task Manager & Kanban Service
 * Collection: tasks/{id}
 */
import {
  collection, doc, addDoc, updateDoc, getDocs, getDoc,
  query, where, serverTimestamp,
} from "../firebaseCompat";
import { db } from "../firebase";

const TASKS = "tasks";

export async function getTasks({ project, assignedUid } = {}) {
  const constraints = [];
  if (project && project !== "ALL") constraints.push(where("project", "==", project));
  if (assignedUid) constraints.push(where("assignedUid", "==", assignedUid));
  const q = query(collection(db, TASKS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => !t.deleted);
}

export async function createTask({ title, description, project, priority = "medium", assignedUid, assignedName, estimatedHours = 0 }) {
  return addDoc(collection(db, TASKS), {
    title,
    description: description || "",
    project: project || "General",
    status: "todo", // "todo" | "in_progress" | "done"
    priority,       // "low" | "medium" | "high" | "urgent"
    assignedUid: assignedUid || null,
    assignedName: assignedName || "Unassigned",
    estimatedHours: Number(estimatedHours) || 0,
    trackedHours: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateTaskStatus(taskId, status) {
  await updateDoc(doc(db, TASKS, taskId), { status });
}

export async function updateTaskTrackedTime(taskId, deltaHours) {
  const ref = doc(db, TASKS, taskId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const current = snap.data().trackedHours || 0;
    await updateDoc(ref, { trackedHours: Math.round((current + deltaHours) * 100) / 100 });
  }
}

export async function deleteTask(taskId) {
  await updateDoc(doc(db, TASKS, taskId), { deleted: true });
}
