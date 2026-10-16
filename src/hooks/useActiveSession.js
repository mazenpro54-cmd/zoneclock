/**
 * useActiveSession — keeps the user's current session in sync and
 * provides check-in / check-out / break helpers with webhook notifications.
 */
import { useState, useEffect, useCallback } from "react";
import {
  getActiveSession,
  checkIn as fbCheckIn,
  checkOut as fbCheckOut,
  startBreak as fbStartBreak,
  endBreak as fbEndBreak,
  msToHMS,
} from "../services/sessions";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useGeolocation } from "./useGeolocation";
import { sendWebhookNotification } from "../services/webhooks";

export function useActiveSession() {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const { getLocation } = useGeolocation();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0); // ms since check-in (minus breaks)

  const employeeName = profile?.displayName || user?.displayName || user?.email || "Employee";

  // ── Load active session on mount ────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getActiveSession(user.uid).then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, [user]);

  // ── Live elapsed counter ─────────────────────────────────────────────
  useEffect(() => {
    if (!session || session.status === "done") return;
    const checkInMs = session.checkInTime?.toMillis?.() ?? Date.now();

    const tick = () => {
      const raw = Date.now() - checkInMs;
      const breakTime = session.status === "break"
        ? (session.breaks?.reduce((s, b) => s + ((b.end || Date.now()) - b.start), 0) ?? 0)
        : (session.totalBreakMs ?? 0);
      setElapsed(Math.max(0, raw - breakTime));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // ── Check In ────────────────────────────────────────────────────────
  const checkIn = useCallback(async ({ project, note, taskId }) => {
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
    setSession(fresh);

    // Send Webhook Alert
    sendWebhookNotification(settings, {
      event: "check_in",
      employeeName,
      project,
      note,
      location,
    });

    return ref;
  }, [user, employeeName, getLocation, settings]);

  // ── Check Out ───────────────────────────────────────────────────────
  const checkOut = useCallback(async () => {
    if (!session) return;
    const checkInMs = session.checkInTime?.toMillis?.() ?? Date.now();
    const duration = Date.now() - checkInMs;
    await fbCheckOut(session.id, checkInMs);

    // Send Webhook Alert
    sendWebhookNotification(settings, {
      event: "check_out",
      employeeName,
      project: session.project,
      duration: msToHMS(duration),
    });

    setSession(null);
    setElapsed(0);
  }, [session, employeeName, settings]);

  // ── Start Break ─────────────────────────────────────────────────────
  const startBreak = useCallback(async () => {
    if (!session) return;
    await fbStartBreak(session.id, session.breaks ?? []);
    setSession((s) => ({ ...s, status: "break" }));

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
    const fresh = await getActiveSession(user.uid);
    setSession(fresh);

    sendWebhookNotification(settings, {
      event: "break_end",
      employeeName,
      project: session?.project,
    });
  }, [session, user, employeeName, settings]);

  return { session, loading, elapsed, checkIn, checkOut, startBreak, endBreak };
}
