/**
 * firebaseCompat.js — re-exports Firebase functions from either
 * the real SDK or the mock, depending on whether credentials exist.
 *
 * All other files import from here instead of "firebase/auth" directly.
 */

import * as mock from "./firebase.mock.js";
import * as realAuth from "firebase/auth";
import * as realFirestore from "firebase/firestore";

const USE_MOCK =
  !import.meta.env.VITE_FIREBASE_API_KEY ||
  import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY";

const compat = USE_MOCK ? mock : { ...realAuth, ...realFirestore };

export const isMockAuth = USE_MOCK;
export const mockSetUserPassword = mock.mockSetUserPassword;

export const {
  // Auth
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
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
