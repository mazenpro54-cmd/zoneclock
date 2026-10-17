/**
 * geofence.js — Real-time GPS geofence monitoring & boundary calculations.
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
        // If GPS cannot be resolved (indoor/offline), don't falsely evict unless strict
        resolve({ inside: true, distanceM: 0, coords: null, error: err.message });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  });
}

/**
 * Starts continuous GPS watch to detect when user moves outside the assigned work zone.
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

  const watchId = navigator.geolocation.watchPosition(
    ({ coords }) => {
      const currentCoords = {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: Math.round(coords.accuracy),
      };

      const { inside, distanceM } = isInsideZone(currentCoords, zoneLat, zoneLng, zoneRadiusM);

      if (!inside) {
        consecutiveExits++;
        // Confirm breach after 2 consecutive readings or large displacement (>1.5x radius)
        if (consecutiveExits >= 2 || distanceM > zoneRadiusM * 1.5) {
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
        if (onInside) {
          onInside({
            distanceM,
            maxAllowedM: zoneRadiusM,
            coords: currentCoords,
          });
        }
      }
    },
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

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}
