/**
 * Client & Customer Management Service
 * Collection: clients/{clientId}
 */
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, orderBy, serverTimestamp,
} from "../firebaseCompat";
import { db } from "../firebase";

const CLIENTS = "clients";

export async function getClients() {
  const q = query(collection(db, CLIENTS), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createClient({ name, company, email, hourlyRate, budgetHours, currency = "EGP", projects = [] }) {
  return addDoc(collection(db, CLIENTS), {
    name,
    company: company || "",
    email: email || "",
    hourlyRate: Number(hourlyRate) || 0,
    budgetHours: Number(budgetHours) || 0,
    currency,
    projects: Array.isArray(projects) ? projects : [projects],
    status: "active",
    createdAt: serverTimestamp(),
  });
}

export async function updateClient(clientId, patch) {
  await updateDoc(doc(db, CLIENTS, clientId), patch);
}

export async function archiveClient(clientId) {
  await updateDoc(doc(db, CLIENTS, clientId), { archived: true });
}
