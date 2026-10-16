/**
 * Timezone utilities — all times stored as UTC in Firestore,
 * displayed in the user's preferred timezone.
 */

export const TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf("timeZone")
  : [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Europe/Istanbul",
      "Asia/Dubai",
      "Asia/Riyadh",
      "Asia/Kolkata",
      "Asia/Tokyo",
      "Australia/Sydney",
    ];

/** Format a Firestore timestamp or Date in a given timezone */
export function formatInTZ(tsOrDate, tz, fmt = "HH:mm") {
  const date =
    tsOrDate && typeof tsOrDate.toDate === "function"
      ? tsOrDate.toDate()
      : tsOrDate instanceof Date
      ? tsOrDate
      : new Date(tsOrDate);

  if (!date || isNaN(date)) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: fmt === "HH:mm:ss" ? "2-digit" : undefined,
    timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour12: false,
  }).format(date);
}

export function formatDateInTZ(tsOrDate, tz) {
  const date =
    tsOrDate && typeof tsOrDate.toDate === "function"
      ? tsOrDate.toDate()
      : tsOrDate instanceof Date
      ? tsOrDate
      : new Date(tsOrDate);

  if (!date || isNaN(date)) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(date);
}

export function getUserTZ() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
