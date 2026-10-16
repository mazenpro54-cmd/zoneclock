/**
 * useGeolocation — resolves the user's current GPS position.
 * Returns { lat, lng, accuracy, error, loading }.
 */
import { useState, useCallback } from "react";

export function useGeolocation() {
  const [state, setState] = useState({
    lat: null,
    lng: null,
    accuracy: null,
    error: null,
    loading: false,
  });

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported" }));
      return Promise.resolve(null);
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const loc = {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: Math.round(coords.accuracy),
          };
          setState({ ...loc, error: null, loading: false });
          resolve(loc);
        },
        (err) => {
          setState((s) => ({
            ...s,
            error: err.message,
            loading: false,
          }));
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  return { ...state, getLocation };
}
