/**
 * Push notification service using the Web Notifications API + service worker.
 * Falls back gracefully when permissions are denied or unavailable.
 */

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

export function sendNotification(title, body, options = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    icon: "/clock.svg",
    badge: "/clock.svg",
    tag: options.tag || "zoneclock",
    requireInteraction: options.requireInteraction ?? false,
    ...options,
  });
  return n;
}

/**
 * Schedule a reminder notification after `delayMs` milliseconds.
 * Returns a cancel function.
 */
export function scheduleReminder(title, body, delayMs) {
  const id = setTimeout(() => sendNotification(title, body, { requireInteraction: true }), delayMs);
  return () => clearTimeout(id);
}

/** Daily check-in reminder — fires at the given hour (local time) */
export function scheduleDailyCheckInReminder(hour = 9) {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  return scheduleReminder(
    "⏰ ZoneClock Reminder",
    "Don't forget to check in for the day!",
    delay
  );
}

/** Overtime alert — fires when elapsed > maxHours */
export function scheduleOvertimeAlert(elapsedMs, maxHours = 8) {
  const maxMs = maxHours * 3_600_000;
  if (elapsedMs >= maxMs) {
    sendNotification(
      "⚠️ Overtime Alert",
      `You've been clocked in for over ${maxHours} hours!`,
      { requireInteraction: true, tag: "overtime" }
    );
    return null;
  }
  const remaining = maxMs - elapsedMs;
  return scheduleReminder(
    "⚠️ Overtime Alert",
    `You've been clocked in for over ${maxHours} hours. Consider wrapping up.`,
    remaining
  );
}
