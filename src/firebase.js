/**
 * firebase.js — auto-switches between real Firebase and the local mock.
 *
 * If VITE_FIREBASE_API_KEY is missing or still says "YOUR_API_KEY",
 * the app runs in DEMO MODE using an in-memory mock (no network needed).
 */

const USE_MOCK =
  !import.meta.env.VITE_FIREBASE_API_KEY ||
  import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY";

let auth, db, googleProvider;

if (USE_MOCK) {
  console.warn("[ZoneClock] No Firebase config found — running in DEMO MODE (in-memory).");
  const mock = await import("./firebase.mock.js");
  auth = mock.auth;
  db = mock.db;
  googleProvider = mock.googleProvider;
} else {
  const { initializeApp } = await import("firebase/app");
  const { getAuth, GoogleAuthProvider } = await import("firebase/auth");
  const { getFirestore } = await import("firebase/firestore");

  const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
}

export { auth, db, googleProvider };
