import { useState, useEffect, useRef } from "react";
import { useActiveSession } from "../hooks/useActiveSession";
import { msToHMS } from "../services/sessions";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useIdleDetection, playAlertChime } from "../hooks/useIdleDetection";
import {
  requestNotificationPermission,
  scheduleOvertimeAlert,
  scheduleDailyCheckInReminder,
} from "../services/notifications";
import { verifyCurrentPositionZone } from "../services/geofence";
import {
  LogIn, LogOut, Coffee, Clock, MapPin, Tag, FileText,
  Bell, BellOff, AlertTriangle, CheckCircle2, Target,
  Play, Pause, RotateCcw, AlertCircle, ShieldCheck
} from "lucide-react";

const PROJECTS = [
  "General", "Development", "Design", "Marketing",
  "Support", "Management", "Meetings", "Research",
];

function pad(n) { return String(n).padStart(2, "0"); }

function ElapsedDisplay({ ms, isOvertime }) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <div className={`elapsed ${isOvertime ? "overtime" : ""}`}>
      <span>{pad(h)}</span>:<span>{pad(m)}</span>:<span>{pad(s)}</span>
    </div>
  );
}

export default function ClockPage() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const {
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
  } = useActiveSession();

  const [project, setProject] = useState("General");
  const [note, setNote] = useState("");
  const [journalNote, setJournalNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notifPerm, setNotifPerm] = useState(Notification?.permission ?? "default");
  const [zoneError, setZoneError] = useState(null);
  const cancelOvertimeRef = useRef(null);

  // ── Pomodoro Focus Mode State ─────────────────────────────────────
  const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
  const [pomodoroStage, setPomodoroStage] = useState("focus"); // "focus" (25m) or "break" (5m)
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  const [pomodoroCycles, setPomodoroCycles] = useState(0);

  const isActive = session?.status === "active";
  const isBreak = session?.status === "break";
  const isClockedIn = isActive || isBreak;
  const isOvertime = elapsed > (settings.overtimeHours || 8) * 3_600_000;

  // ── Idle Detection Hook ───────────────────────────────────────────
  const { isIdle, idleSeconds, resetIdle } = useIdleDetection({
    enabled: isActive,
    timeoutMinutes: settings.idleTimeoutMinutes || 5,
  });

  // ── Pomodoro Timer interval ───────────────────────────────────────
  useEffect(() => {
    let interval = null;
    if (pomodoroEnabled && isActive) {
      interval = setInterval(() => {
        setPomodoroSeconds((prev) => {
          if (prev <= 1) {
            playAlertChime("pomodoro");
            if (pomodoroStage === "focus") {
              setPomodoroStage("break");
              setPomodoroCycles((c) => c + 1);
              return 5 * 60; // 5 min break
            } else {
              setPomodoroStage("focus");
              return 25 * 60; // 25 min focus
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [pomodoroEnabled, isActive, pomodoroStage]);

  // ── Overtime watcher ─────────────────────────────────────────────
  useEffect(() => {
    if (session && notifPerm === "granted" && settings.overtimeHours) {
      if (cancelOvertimeRef.current) cancelOvertimeRef.current();
      cancelOvertimeRef.current = scheduleOvertimeAlert(elapsed, settings.overtimeHours);
    }
    return () => {
      if (cancelOvertimeRef.current) cancelOvertimeRef.current();
    };
  }, [session, notifPerm, settings.overtimeHours]);

  // ── Zone enforcement ──────────────────────────────────────────────
  async function verifyZone() {
    if (!settings.zoneEnforcement || settings.zoneLat == null) return true;
    const check = await verifyCurrentPositionZone(
      settings.zoneLat,
      settings.zoneLng,
      settings.zoneRadiusM || 200
    );
    if (!check.inside) {
      setZoneError(
        `You're ${check.distanceM}m away from the work zone (max allowed ${settings.zoneRadiusM || 200}m).`
      );
      return false;
    }
    setZoneError(null);
    return true;
  }

  async function handleCheckIn() {
    const inZone = await verifyZone();
    if (!inZone) return;
    setBusy(true);
    try {
      await checkIn({ project, note: note || journalNote });
      setNote("");
      setJournalNote("");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    setBusy(true);
    try { await checkOut(); }
    finally { setBusy(false); }
  }

  async function handleBreak() {
    setBusy(true);
    try {
      if (session?.status === "break") await endBreak();
      else await startBreak();
    } finally { setBusy(false); }
  }

  async function handleEnableNotifs() {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm === "granted") {
      scheduleDailyCheckInReminder(settings.reminderHour ?? 9);
    }
  }

  if (loading) return <div className="page-loader"><Clock className="spin" size={32} /></div>;

  const pomoMins = Math.floor(pomodoroSeconds / 60);
  const pomoSecs = pomodoroSeconds % 60;

  return (
    <div className="clock-page">
      {/* Idle / Inactivity Warning Modal */}
      {isIdle && isActive && (
        <div className="modal-overlay">
          <div className="modal-content idle-modal" onClick={(e) => e.stopPropagation()}>
            <div className="idle-header">
              <AlertCircle size={28} className="text-warn" />
              <h3>Inactivity Detected</h3>
            </div>
            <p className="muted" style={{ lineHeight: 1.5 }}>
              No interaction detected for over {settings.idleTimeoutMinutes || 5} minutes.
              Are you still actively working on <strong>{session.project}</strong>?
            </p>
            <div className="idle-actions">
              <button
                className="btn-primary"
                onClick={() => resetIdle()}
              >
                Yes, keep timer running
              </button>
              <button
                className="btn-break"
                onClick={async () => {
                  resetIdle();
                  await handleBreak();
                }}
              >
                <Coffee size={16} /> I was taking a break
              </button>
              <button
                className="btn-danger"
                onClick={async () => {
                  resetIdle();
                  await handleCheckOut();
                }}
              >
                <LogOut size={16} /> Check out now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification permission banner */}
      {notifPerm === "default" && (
        <button className="notif-banner" onClick={handleEnableNotifs}>
          <Bell size={14} /> Enable notifications for overtime alerts & reminders
        </button>
      )}
      {notifPerm === "denied" && (
        <div className="notif-banner denied">
          <BellOff size={14} /> Notifications blocked in browser settings
        </div>
      )}

      {/* Auto Check-Out Notice (Geofence Departure) */}
      {autoCheckoutNotice && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#fca5a5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "16px",
            fontSize: "14px",
            lineHeight: "1.4"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertCircle size={20} style={{ color: "#ef4444", flexShrink: 0 }} />
            <span>{autoCheckoutNotice}</span>
          </div>
          <button
            onClick={clearAutoCheckoutNotice}
            style={{
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "6px",
              flexShrink: 0
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Zone error */}
      {zoneError && (
        <div className="zone-error">
          <MapPin size={14} /> {zoneError}
        </div>
      )}

      {/* Overtime warning */}
      {isClockedIn && isOvertime && (
        <div className="overtime-banner">
          <AlertTriangle size={14} />
          Overtime! You've worked over {settings.overtimeHours || 8}h today.
        </div>
      )}

      {/* Status Banner */}
      <div className={`status-banner ${isBreak ? "break" : isClockedIn ? "active" : "idle"}`}>
        <span className="status-dot" />
        <span>{isBreak ? "On Break" : isClockedIn ? "Clocked In" : "Not Clocked In"}</span>

        {isClockedIn && settings.zoneEnforcement && settings.zoneLat != null && (
          <span
            style={{
              marginLeft: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "12px",
              padding: "3px 8px",
              borderRadius: "20px",
              background: zoneStatus.inside ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: zoneStatus.inside ? "#10b981" : "#ef4444",
              border: `1px solid ${zoneStatus.inside ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            }}
            title={
              zoneStatus.inside
                ? `Inside zone (${zoneStatus.distanceM}m from center, radius ${settings.zoneRadiusM || 200}m). Auto-checkout active on departure.`
                : `Outside work zone (${zoneStatus.distanceM}m away).`
            }
          >
            <ShieldCheck size={13} />
            {zoneStatus.inside ? `In Work Zone (${zoneStatus.distanceM}m)` : `Outside Zone (${zoneStatus.distanceM}m)`}
          </span>
        )}

        {isClockedIn && session.project && (
          <span className="project-badge" style={{ marginLeft: "auto" }}>{session.project}</span>
        )}
      </div>

      {/* Timer Card */}
      <div className="timer-card">
        <p className="timer-label">
          {isClockedIn ? `Today's work time` : "Ready to clock in?"}
        </p>
        <ElapsedDisplay ms={elapsed} isOvertime={isOvertime} />

        {/* Pomodoro Focus Mini Widget */}
        {isClockedIn && (
          <div className="pomodoro-bar">
            <button
              type="button"
              className={`pomodoro-toggle ${pomodoroEnabled ? "active" : ""}`}
              onClick={() => setPomodoroEnabled(!pomodoroEnabled)}
            >
              <Target size={14} />
              {pomodoroEnabled ? "Focus Mode Active" : "Enable Pomodoro (25/5)"}
            </button>

            {pomodoroEnabled && (
              <div className="pomodoro-timer-pill">
                <span className={`pomo-dot ${pomodoroStage}`}></span>
                <strong>
                  {pad(pomoMins)}:{pad(pomoSecs)}
                </strong>
                <span className="pomo-stage-name">
                  {pomodoroStage === "focus" ? "Focus" : "Rest"} (#{pomodoroCycles + 1})
                </span>
              </div>
            )}
          </div>
        )}

        {isClockedIn && session?.location && (
          <p className="location-tag">
            <MapPin size={13} />
            {session.location.lat.toFixed(5)}, {session.location.lng.toFixed(5)}
            &nbsp;(±{session.location.accuracy}m)
            {settings.zoneEnforcement && <span className="zone-ok"><CheckCircle2 size={12} /> In Zone</span>}
          </p>
        )}
        {isClockedIn && session.totalBreakMs > 0 && (
          <p className="break-info">Break time: {msToHMS(session.totalBreakMs)}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="action-group">
        {isClockedIn ? (
          <>
            {/* Journal note while clocked in */}
            <label className="field">
              <FileText size={14} />
              <span>Activity note</span>
              <input
                type="text"
                value={journalNote}
                onChange={(e) => setJournalNote(e.target.value)}
                placeholder="What are you working on right now?"
                maxLength={160}
              />
            </label>
            <button onClick={handleBreak} disabled={busy} className="btn-break">
              <Coffee size={18} />
              {isBreak ? "End Break" : "Start Break"}
            </button>
            <button onClick={handleCheckOut} disabled={busy} className="btn-checkout">
              <LogOut size={18} />
              Check Out
            </button>
          </>
        ) : (
          <>
            <label className="field">
              <Tag size={14} />
              <span>Project</span>
              <select value={project} onChange={(e) => setProject(e.target.value)}>
                {PROJECTS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="field">
              <FileText size={14} />
              <span>Note (optional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What are you working on?"
                maxLength={120}
              />
            </label>
            <button onClick={handleCheckIn} disabled={busy} className="btn-checkin">
              <LogIn size={18} />
              Check In
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
