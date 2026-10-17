/**
 * SettingsContext — persists user preferences to localStorage.
 * Provides: timezone, overtimeHours, reminderHour, zoneEnforcement,
 *           zoneLat, zoneLng, zoneRadiusM, webhook settings, idleTimeoutMinutes,
 *           googleMapsApiKey
 */
import { createContext, useContext, useState } from "react";

const API_KEY_DEFAULT =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  "AIzaSyD00SldMns_5EiY3gvc8-YP-fsHL0eOFgI";

const DEFAULTS = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  overtimeHours: 8,
  reminderHour: 9,
  zoneEnforcement: false,
  autoCheckoutOnExit: true,
  zoneLat: 30.0444,
  zoneLng: 31.2357,
  zoneRadiusM: 200,
  idleTimeoutMinutes: 5,
  webhookEnabled: false,
  webhookType: "slack", // "slack" | "discord" | "custom"
  webhookUrl: "",
  webhookTriggers: {
    checkIn: true,
    checkOut: true,
    zoneExit: true,
    overtime: true,
  },
  biometricClockIn: false,
  backgroundGeofence: true,
  googleMapsApiKey: API_KEY_DEFAULT,
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem("zoneclock_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.googleMapsApiKey) {
          parsed.googleMapsApiKey = API_KEY_DEFAULT;
        }
        return { ...DEFAULTS, ...parsed };
      }
      return DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  function updateSettings(patch) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("zoneclock_settings", JSON.stringify(next));
      return next;
    });
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
