/**
 * geofence.js — Real-time GPS geofence monitoring, boundary calculations & background wake service.
 * Calculates Haversine distances and monitors employee coordinates for work-zone exit breaches.
 */

/**
 * Calculates Great-Circle distance between two coordinates in meters using the Haversine formula.
 */
export function haversineDistanceM(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity;
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Verifies whether coordinates fall within the designated work zone radius.
 */
export function isInsideZone(coords, zoneLat, zoneLng, zoneRadiusM = 200) {
  if (!coords || zoneLat == null || zoneLng == null) {
    return { inside: true, distanceM: 0 };
  }
  const distanceM = haversineDistanceM(coords.lat, coords.lng, zoneLat, zoneLng);
  return {
    inside: distanceM <= zoneRadiusM,
    distanceM: Math.round(distanceM),
    maxAllowedM: zoneRadiusM,
  };
}

/**
 * Queries the user's current GPS position once and checks zone compliance.
 */
export async function verifyCurrentPositionZone(zoneLat, zoneLng, zoneRadiusM = 200) {
  if (!navigator.geolocation || zoneLat == null || zoneLng == null) {
    return { inside: true, distanceM: 0, coords: null };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const currentCoords = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: Math.round(coords.accuracy),
        };
        const check = isInsideZone(currentCoords, zoneLat, zoneLng, zoneRadiusM);
        resolve({ ...check, coords: currentCoords });
      },
      (err) => {
        console.warn("Geofence position verification warning:", err.message);
        // If GPS cannot be resolved indoors, do not falsely evict
        resolve({ inside: true, distanceM: 0, coords: null, error: err.message });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  });
}

/**
 * Haptic and Audio buzzer warning when breaching the geofence perimeter.
 */
export function triggerGeofenceAlert() {
  // 1. Vibration
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([300, 150, 300, 150, 500]);
    } catch {}
  }

  // 2. Synthesized Web Audio Beep (Works in all modern browsers without external asset)
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
      setTimeout(() => {
        try { ctx.close(); } catch {}
      }, 500);
    }
  } catch {}
}

/**
 * Shows an urgent system/browser notification on perimeter departure.
 */
export function notifyPerimeterDeparture(distanceM, maxAllowedM = 200) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("⚠️ ZoneClock Workplace Boundary Exit", {
        body: `You are ${distanceM}m away from the job site (limit: ${maxAllowedM}m). Time tracking paused.`,
        icon: "/clock.svg",
        tag: "geofence-alert",
      });
    } catch {}
  }
}

/**
 * Starts continuous GPS watch to detect when user moves outside the assigned work zone,
 * with background app state listeners (visibility change & device resume).
 */
export function startGeofenceWatcher({
  zoneLat,
  zoneLng,
  zoneRadiusM = 200,
  onExit,
  onInside,
  onError,
}) {
  if (!navigator.geolocation || zoneLat == null || zoneLng == null) {
    return () => {};
  }

  let consecutiveExits = 0; // Requires 2 consecutive GPS readings outside zone to prevent false GPS jitter
  let hasTriggeredBreach = false;

  function processPosition(coords) {
    const currentCoords = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: Math.round(coords.accuracy),
    };

    const { inside, distanceM } = isInsideZone(currentCoords, zoneLat, zoneLng, zoneRadiusM);

    if (!inside) {
      consecutiveExits++;
      // Confirm breach after 2 consecutive readings or large displacement (>1.5x radius)
      if ((consecutiveExits >= 2 || distanceM > zoneRadiusM * 1.5) && !hasTriggeredBreach) {
        hasTriggeredBreach = true;
        triggerGeofenceAlert();
        notifyPerimeterDeparture(distanceM, zoneRadiusM);
        if (onExit) {
          onExit({
            distanceM,
            maxAllowedM: zoneRadiusM,
            coords: currentCoords,
          });
        }
      }
    } else {
      consecutiveExits = 0;
      hasTriggeredBreach = false;
      if (onInside) {
        onInside({
          distanceM,
          maxAllowedM: zoneRadiusM,
          coords: currentCoords,
        });
      }
    }
  }

  const watchId = navigator.geolocation.watchPosition(
    ({ coords }) => processPosition(coords),
    (err) => {
      console.warn("Geofence watch warning:", err.message);
      if (onError) onError(err);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    }
  );

  // Background resume handler: when screen turns on or user refocuses app
  const handleWake = () => {
    if (document.visibilityState === "visible") {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => processPosition(coords),
        () => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);
    window.addEventListener("pageshow", handleWake);
  }

  return () => {
    navigator.geolocation.clearWatch(watchId);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("pageshow", handleWake);
    }
  };
}
