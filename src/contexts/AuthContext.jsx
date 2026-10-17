import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider, db } from "../firebase";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  sendPasswordResetEmail,
  updatePassword,
  isMockAuth,
  mockSetUserPassword,
} from "../firebaseCompat";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function ensureUserDoc(firebaseUser, extra = {}) {
    const ref = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(ref);
    const isAdmin = firebaseUser.email?.toLowerCase() === "mazenpro54@gmail.com";
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || extra.displayName || (isAdmin ? "Mazen" : ""),
        photoURL: firebaseUser.photoURL || "",
        role: isAdmin ? "admin" : "employee",
        createdAt: serverTimestamp(),
        ...extra,
      });
    } else if (isAdmin && snap.data()?.role !== "admin") {
      await updateDoc(ref, { role: "admin" });
    }
    const updated = await getDoc(ref);
    setProfile(updated.data());
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        await ensureUserDoc(fbUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(result.user);
  }

  async function loginWithEmail(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function registerWithEmail(email, password, displayName) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await ensureUserDoc(result.user, { displayName });
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  async function changePassword(newPassword) {
    if (!auth.currentUser) throw new Error("No active session found. Please sign in first.");
    return updatePassword(auth.currentUser, newPassword);
  }

  async function adminResetUserPassword(targetEmail, targetUid, newPassword) {
    if (profile?.role !== "admin") {
      throw new Error("Unauthorized: Only administrators can reset employee passwords.");
    }
    if (isMockAuth && mockSetUserPassword) {
      await mockSetUserPassword(targetEmail, newPassword);
    } else {
      await sendPasswordResetEmail(auth, targetEmail);
    }
    if (targetUid) {
      try {
        await updateDoc(doc(db, "users", targetUid), {
          passwordLastResetAt: serverTimestamp(),
          passwordResetBy: profile.email || "admin",
        });
      } catch (err) {
        console.warn("Could not write password reset timestamp:", err);
      }
    }
    return true;
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        changePassword,
        adminResetUserPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
