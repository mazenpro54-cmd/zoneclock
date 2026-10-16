import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Eye, User, Clock, Layers } from "lucide-react";

export default function CheckInMap({ sessions = [], height = "420px" }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Filter sessions that have location
  const sessionsWithLoc = sessions.filter(
    (s) => s.location && typeof s.location.lat === "number" && typeof s.location.lng === "number"
  );

  const displayedSessions = filterActiveOnly
    ? sessionsWithLoc.filter((s) => s.status === "active" || s.status === "break")
    : sessionsWithLoc;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default to Cairo / Center
      const defaultCenter = [30.0444, 31.2357];
      const initialZoom = 12;

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: initialZoom,
        zoomControl: true,
      });

      // CartoDB Voyager or OpenStreetMap
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const bounds = [];

    displayedSessions.forEach((s) => {
      const { lat, lng, accuracy = 20 } = s.location;
      const isActive = s.status === "active";
      const isBreak = s.status === "break";
      const statusColor = isBreak ? "#f59e0b" : isActive ? "#22c55e" : "#6366f1";
      const initial = (s.displayName || "U")[0].toUpperCase();

      // Custom HTML Marker Pin
      const pinHtml = `
        <div class="custom-map-pin" style="--pin-color: ${statusColor}">
          <div class="pin-avatar">${initial}</div>
          <div class="pin-pulse"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: pinHtml,
        className: "custom-leaflet-div-icon",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const checkInFormatted = s.checkInTime?.toDate?.()
        ? s.checkInTime.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Recent";

      const popupContent = `
        <div class="map-popup">
          <div class="map-popup-header">
            <strong>${s.displayName || "Employee"}</strong>
            <span class="popup-status" style="background: ${statusColor}22; color: ${statusColor}">
              ${isActive ? "Clocked In" : isBreak ? "On Break" : "Completed"}
            </span>
          </div>
          <div class="map-popup-body">
            <p><strong>Project:</strong> ${s.project || "General"}</p>
            <p><strong>Check In:</strong> ${checkInFormatted}</p>
            <p><strong>Coordinates:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            ${s.note ? `<p class="popup-note">"${s.note}"</p>` : ""}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      layerGroup.addLayer(marker);

      // Accuracy circle
      if (accuracy) {
        const circle = L.circle([lat, lng], {
          radius: Math.min(accuracy, 200),
          color: statusColor,
          weight: 1,
          opacity: 0.5,
          fillColor: statusColor,
          fillOpacity: 0.12,
        });
        layerGroup.addLayer(circle);
      }

      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [displayedSessions]);

  return (
    <div className="map-wrapper">
      <div className="map-toolbar">
        <div className="map-title-row">
          <Navigation size={16} className="text-brand" />
          <span>Live Check-in GPS Locations ({displayedSessions.length})</span>
        </div>
        <div className="map-actions">
          <label className="map-filter-toggle">
            <input
              type="checkbox"
              checked={filterActiveOnly}
              onChange={(e) => setFilterActiveOnly(e.target.checked)}
            />
            <span>Active only</span>
          </label>
        </div>
      </div>
      <div
        ref={mapContainerRef}
        className="leaflet-map-container"
        style={{ height, width: "100%", borderRadius: "12px" }}
      />
    </div>
  );
}
