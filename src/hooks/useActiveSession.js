/**
 * useActiveSession — keeps the user's current session in sync across app closes/restarts
 * and automatically enforces work-zone geofencing (auto check-out on zone departure).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getActiveSession,
  checkIn as fbCheckIn,
  checkOut as fbCheckOut,
  startBreak as fbStartBreak,
  endBreak as fbEndBreak,
  reviveSession,
  msToHMS,
} from "../services/sessions";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useGeolocation } from "./useGeolocation";
import { sendWebhookNotification } from "../services/webhooks";
import {
  startGeofenceWatcher,
  verifyCurrentPositionZone,
} from "../services/geofence";

const LOCAL_STORAGE_KEY = "zoneclock_active_session";

function loadCachedSession() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    return raw ? reviveSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function useActiveSession() {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const { getLocation } = useGeolocation();

  // Fast-path initialization from localStorage so check-in is never lost when closing the app
  const [session, setSession] = useState(loadCachedSession);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0); // ms since check-in (minus breaks)
  const [autoCheckoutNotice, setAutoCheckoutNotice] = useState(null);
  const [zoneStatus, setZoneStatus] = useState({ inside: true, distanceM: 0 });

  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const employeeName =
    profile?.displayName || user?.displayName || user?.email || "Employee";

  // ── Sync session with localStorage ──────────────────────────────────
  useEffect(() => {
    if (session && (session.status === "active" || session.status === "break")) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
      } catch (err) {
        console.warn("Error saving active session to localStorage:", err);
      }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [session]);

  // ── Check Out helper ────────────────────────────────────────────────
  const checkOut = useCallback(
    async (exitReason = "manual") => {
      const cur = sessionRef.current;
      if (!cur) return;
      const checkInMs = cur.checkInTime?.toMillis?.() ?? Date.now();
      const totalBreakMs = cur.totalBreakMs || 0;
      const netDuration = Math.max(0, Date.now() - checkInMs - totalBreakMs);

      await fbCheckOut(cur.id, checkInMs, exitReason, totalBreakMs);

      // Send Webhook Alert
      sendWebhookNotification(settings, {
        event: "check_out",
        employeeName,
        project: cur.project,
        duration: msToHMS(netDuration),
        exitReason,
      });

      setSession(null);
      setElapsed(0);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    },
    [employeeName, settings]
  );

  // ── Geofence Zone Verification & Auto Check-Out ─────────────────────
  const verifyAndEnforceZone = useCallback(async () => {
    const cur = sessionRef.current;
    if (!cur || cur.status !== "active") return;
    if (!settings.zoneEnforcement || settings.zoneLat == null) return;

    const check = await verifyCurrentPositionZone(
      settings.zoneLat,
      settings.zoneLng,
      settings.zoneRadiusM || 200
    );

    setZoneStatus({ inside: check.inside, distanceM: check.distanceM });

    if (!check.inside && settings.autoCheckoutOnExit !== false) {
      const reason = `Auto Check-Out: Exited Work Zone (${check.distanceM}m away)`;
      await checkOut(reason);
      setAutoCheckoutNotice(
        `You were automatically checked out because you left the assigned work zone (${check.distanceM}m away, max allowed ${
          settings.zoneRadiusM || 200
        }m).`
      );
    }
  }, [settings, checkOut]);

  // ── Load active session from database / verify zone on boot ─────────
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    getActiveSession(user.uid).then(async (dbSession) => {
      const resolved = dbSession ? reviveSession(dbSession) : loadCachedSession();
      setSession(resolved);
      sessionRef.current = resolved;
      setLoading(false);

      // Verify zone compliance upon opening/reopening the app
      if (resolved && resolved.status === "active" && settings.zoneEnforcement) {
        verifyAndEnforceZone();
      }
    });
  }, [user, settings.zoneEnforcement, verifyAndEnforceZone]);

  // ── Re-verify zone whenever tab/app is reopened or gains focus ──────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        verifyAndEnforceZone();
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [verifyAndEnforceZone]);

  // ── Continuous GPS Watcher while Clocked In ─────────────────────────
  useEffect(() => {
    if (
      !session ||
      session.status !== "active" ||
      !settings.zoneEnforcement ||
      settings.zoneLat == null
    ) {
      return;
    }

    const unwatch = startGeofenceWatcher({
      zoneLat: settings.zoneLat,
      zoneLng: settings.zoneLng,
      zoneRadiusM: settings.zoneRadiusM || 200,
      onExit: async ({ distanceM, maxAllowedM }) => {
        setZoneStatus({ inside: false, distanceM });
        if (settings.autoCheckoutOnExit !== false) {
          sendWebhookNotification(settings, {
            event: "zone_exit_breach",
            employeeName,
            project: sessionRef.current?.project,
            distanceM,
            maxAllowedM,
          });
          const reason = `Auto Check-Out: Exited Work Zone (${distanceM}m away)`;
          await checkOut(reason);
          setAutoCheckoutNotice(
            `You moved outside the work zone boundary (${distanceM}m away, limit ${maxAllowedM}m). Automatically checked out.`
          );
        }
      },
      onInside: ({ distanceM }) => {
        setZoneStatus({ inside: true, distanceM });
      },
    });

    return () => unwatch();
  }, [session?.status, settings, employeeName, checkOut]);

  // ── Live elapsed counter ─────────────────────────────────────────────
  useEffect(() => {
    if (!session || session.status === "done") return;
    const checkInMs = session.checkInTime?.toMillis?.() ?? Date.now();

    const tick = () => {
      const raw = Date.now() - checkInMs;
      const breakTime =
        session.status === "break"
          ? (session.breaks?.reduce(
              (s, b) => s + ((b.end || Date.now()) - b.start),
              0
            ) ?? 0)
          : (session.totalBreakMs ?? 0);
      setElapsed(Math.max(0, raw - breakTime));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // ── Check In ────────────────────────────────────────────────────────
  const checkIn = useCallback(
    async ({ project, note, taskId }) => {
      setAutoCheckoutNotice(null);
      const location = await getLocation();
      const ref = await fbCheckIn({
        uid: user.uid,
        displayName: employeeName,
        project,
        note,
        location,
        taskId: taskId || null,
      });
      const fresh = await getActiveSession(user.uid);
      const revived = reviveSession(fresh);
      setSession(revived);

      // Send Webhook Alert
      sendWebhookNotification(settings, {
        event: "check_in",
        employeeName,
        project,
        note,
        location,
      });

      return ref;
    },
    [user, employeeName, getLocation, settings]
  );

  // ── Start Break ─────────────────────────────────────────────────────
  const startBreak = useCallback(async () => {
    if (!session) return;
    const now = Date.now();
    const breakEntry = { start: now, end: null };
    const currentBreaks = session.breaks ?? [];
    await fbStartBreak(session.id, currentBreaks);
    setSession((s) =>
      s ? { ...s, status: "break", breaks: [...(s.breaks ?? []), breakEntry] } : null
    );

    sendWebhookNotification(settings, {
      event: "break_start",
      employeeName,
      project: session.project,
    });
  }, [session, employeeName, settings]);

  // ── End Break ───────────────────────────────────────────────────────
  const endBreak = useCallback(async () => {
    if (!session) return;
    await fbEndBreak(session.id, session.breaks ?? []);
    if (user?.uid) {
      const fresh = await getActiveSession(user.uid);
      if (fresh) {
        setSession(reviveSession(fresh));
      }
    }

    sendWebhookNotification(settings, {
      event: "break_end",
      employeeName,
      project: session?.project,
    });
  }, [session, user?.uid, employeeName, settings]);

  const clearAutoCheckoutNotice = useCallback(() => {
    setAutoCheckoutNotice(null);
  }, []);

  return {
    session,
    loading,
    elapsed,
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    autoCheckoutNotice,
    clearAutoCheckoutNotice,
    zoneStatus,
  };
}
