/**
 * firebaseCompat.js — re-exports Firebase functions from either
 * the real SDK or the mock, depending on whether credentials exist.
 *
 * All other files import from here instead of "firebase/auth" directly.
 */

const USE_MOCK =
  !import.meta.env.VITE_FIREBASE_API_KEY ||
  import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY";

let compat;

if (USE_MOCK) {
  compat = await import("./firebase.mock.js");
} else {
  const authModule = await import("firebase/auth");
  const firestoreModule = await import("firebase/firestore");
  compat = { ...authModule, ...firestoreModule };
}

export const {
  // Auth
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  // Firestore
  doc,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
  arrayUnion,
  arrayRemove,
} = compat;
