/**
 * Teams / Departments service
 * Collection: teams/{teamId}  { name, description, memberUids[], adminUid, createdAt }
 */
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, serverTimestamp, getDoc, arrayUnion, arrayRemove,
} from "../firebaseCompat";
import { db } from "../firebase";

const TEAMS = "teams";

export async function createTeam({ name, description, adminUid }) {
  return addDoc(collection(db, TEAMS), {
    name,
    description: description || "",
    memberUids: [adminUid],
    adminUid,
    createdAt: serverTimestamp(),
  });
}

export async function getTeams() {
  const snap = await getDocs(query(collection(db, TEAMS), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUserTeams(uid) {
  const q = query(collection(db, TEAMS), where("memberUids", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addMemberToTeam(teamId, uid) {
  await updateDoc(doc(db, TEAMS, teamId), { memberUids: arrayUnion(uid) });
}

export async function removeMemberFromTeam(teamId, uid) {
  await updateDoc(doc(db, TEAMS, teamId), { memberUids: arrayRemove(uid) });
}

export async function deleteTeam(teamId) {
  // soft-delete: set archived flag
  await updateDoc(doc(db, TEAMS, teamId), { archived: true });
}
