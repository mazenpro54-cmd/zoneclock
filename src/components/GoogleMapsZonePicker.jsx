// Source: Google Maps Platform Code Assist
import { useState, useEffect, useRef, useCallback } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
  Pin,
} from "@vis.gl/react-google-maps";
import { useSettings } from "../contexts/SettingsContext";
import {
  MapPin, Navigation, CheckCircle, Key, ExternalLink,
  Sliders, ShieldCheck, Crosshair
} from "lucide-react";

/**
 * Custom circle component that renders a google.maps.Circle over the map
 */
function MapCircle({ center, radius, strokeColor = "#6366f1", fillColor = "#6366f1" }) {
  const map = useMap();
  const maps = useMapsLibrary("maps");
  const circleRef = useRef(null);

  useEffect(() => {
    if (!map || !maps || !center) return;

    if (!circleRef.current) {
      circleRef.current = new maps.Circle({
        map,
        center,
        radius,
        strokeColor,
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor,
        fillOpacity: 0.22,
        clickable: false,
      });
    } else {
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(radius);
    }

    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [map, maps, center, radius, strokeColor, fillColor]);

  return null;
}

/**
 * Helper to smoothly pan to coordinates
 */
function MapPanController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.panTo(center);
    }
  }, [map, center]);
  return null;
}

export default function GoogleMapsZonePicker({ onSave }) {
  const { settings, updateSettings } = useSettings();

  // Current or default center
  const initialLat = settings.zoneLat || 30.0444;
  const initialLng = settings.zoneLng || 31.2357;
  const initialRadius = settings.zoneRadiusM || 200;

  const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
  const [radius, setRadius] = useState(initialRadius);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(settings.googleMapsApiKey || "");
  const [gpsLoading, setGpsLoading] = useState(false);

  const effectiveApiKey =
    settings.googleMapsApiKey ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    "AIzaSyD00SldMns_5EiY3gvc8-YP-fsHL0eOFgI";

  // Handle map click
  const handleMapClick = useCallback((e) => {
    if (e.detail?.latLng) {
      setCenter({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
    }
  }, []);

  // Handle marker drag
  const handleMarkerDragEnd = useCallback((e) => {
    if (e.latLng) {
      setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  }, []);

  // Set current GPS location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(coords);
        setGpsLoading(false);
      },
      (err) => {
        alert("GPS Error: " + err.message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Save zone coordinates & radius
  const handleSaveZone = () => {
    updateSettings({
      zoneLat: center.lat,
      zoneLng: center.lng,
      zoneRadiusM: radius,
      zoneEnforcement: true,
    });
    setSavedSuccess(true);
    if (onSave) onSave();
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    updateSettings({ googleMapsApiKey: apiKeyInput.trim() });
  };

  return (
    <div className="google-maps-zone-card">
      <div className="zone-picker-header">
        <div className="zone-picker-title">
          <MapPin size={18} className="text-brand" />
          <span>Interactive Workplace Geofence (Google Maps)</span>
        </div>
        {settings.zoneEnforcement && (
          <span className="status-pill-ok">
            <ShieldCheck size={12} /> Enforcement Active
          </span>
        )}
      </div>

      {/* API Key Banner if not set */}
      {!effectiveApiKey && (
        <div className="gmp-key-banner">
          <div className="gmp-key-header">
            <Key size={16} className="text-warn" />
            <strong>Google Maps API Key Required for Interactive Map</strong>
          </div>
          <p className="muted-small" style={{ lineHeight: 1.4, margin: "4px 0 8px 0" }}>
            To activate interactive Google Maps with live radius adjustments and geofencing,
            enter your Google Cloud API key or a prototyping Demo Key.
          </p>
          <form onSubmit={handleSaveApiKey} className="gmp-key-form">
            <input
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste AIzaSy... API key"
              className="compact-select"
              required
            />
            <button type="submit" className="btn-primary" style={{ width: "auto", padding: "0.4rem 0.85rem", fontSize: "0.78rem" }}>
              Save Key
            </button>
          </form>
          <div className="gmp-key-links">
            <a
              href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_git_agentskills_v1"
              target="_blank"
              rel="noreferrer"
              className="gmp-link"
            >
              Get Free Maps Demo Key <ExternalLink size={11} />
            </a>
            <span className="muted">•</span>
            <a
              href="https://console.cloud.google.com/google/maps-apis/credentials?utm_campaign=gmp_git_agentskills_v1"
              target="_blank"
              rel="noreferrer"
              className="gmp-link"
            >
              Cloud Console <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}

      {/* Render Google Map if API key is provided */}
      {effectiveApiKey ? (
        <div className="google-map-container-wrap">
          <APIProvider apiKey={effectiveApiKey}>
            <Map
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={["gmp_git_agentskills_v1"]}
              defaultCenter={center}
              defaultZoom={16}
              style={{ width: "100%", height: "360px", borderRadius: "12px" }}
              onClick={handleMapClick}
              gestureHandling="greedy"
              disableDefaultUI={false}
            >
              <MapPanController center={center} />
              <AdvancedMarker
                position={center}
                draggable={true}
                onDragEnd={handleMarkerDragEnd}
                title="Work Zone Center (Drag to adjust)"
              >
                <Pin
                  background="#6366f1"
                  borderColor="#ffffff"
                  glyphColor="#ffffff"
                  scale={1.15}
                />
              </AdvancedMarker>
              <MapCircle center={center} radius={radius} />
            </Map>
          </APIProvider>

          <p className="map-instruction-hint">
            💡 <strong>Tip:</strong> Click anywhere on the map or drag the pin to set the exact office center point.
          </p>
        </div>
      ) : (
        <div className="map-placeholder-box">
          <Crosshair size={32} className="muted-icon" />
          <p className="muted">Enter your Google Maps API Key above to unlock the interactive geofence map.</p>
        </div>
      )}

      {/* Zone Controls & Radius */}
      <div className="zone-adjust-toolbar">
        <div className="zone-stat-col">
          <span className="tiny-label">Center Point</span>
          <strong className="coord-text">
            {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
          </strong>
        </div>

        <div className="zone-stat-col">
          <span className="tiny-label">Allowed Geofence Radius</span>
          <div className="radius-slider-row">
            <input
              type="range"
              min="50"
              max="1000"
              step="25"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="radius-range-slider"
            />
            <span className="radius-val-badge">{radius}m</span>
          </div>
        </div>
      </div>

      <div className="zone-actions-footer">
        <button
          type="button"
          className="btn-outline"
          onClick={handleUseCurrentLocation}
          disabled={gpsLoading}
        >
          <Navigation size={14} />
          {gpsLoading ? "Locating..." : "Center at My GPS"}
        </button>

        <button
          type="button"
          className="btn-primary"
          style={{ width: "auto", minWidth: "160px" }}
          onClick={handleSaveZone}
        >
          {savedSuccess ? "✓ Zone Saved!" : "Save Work Zone"}
        </button>
      </div>
    </div>
  );
}
