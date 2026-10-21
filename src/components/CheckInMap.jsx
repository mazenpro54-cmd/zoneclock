import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, Crosshair, Map, Globe, Mountain } from "lucide-react";

// Real tile layers without watermarks or API key requirements
const TILE_PROVIDERS = {
  streets: {
    id: "streets",
    label: "Streets",
    icon: Map,
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    icon: Globe,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution: 'Tiles &copy; Esri &mdash; DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and GIS User Community',
      maxZoom: 19,
    },
  },
  terrain: {
    id: "terrain",
    label: "Terrain",
    icon: Mountain,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase',
      maxZoom: 19,
    },
  },
};

export default function CheckInMap({ sessions = [], height = "420px" }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [mapType, setMapType] = useState("streets");
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Filter sessions that have valid coordinates
  const sessionsWithLoc = sessions.filter(
    (s) => s.location && typeof s.location.lat === "number" && typeof s.location.lng === "number"
  );

  const displayedSessions = filterActiveOnly
    ? sessionsWithLoc.filter((s) => s.status === "active" || s.status === "break")
    : sessionsWithLoc;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter = [30.0444, 31.2357];
      const initialZoom = 12;

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: initialZoom,
        zoomControl: true,
      });

      // Initial Tile Layer
      const initialProvider = TILE_PROVIDERS[mapType] || TILE_PROVIDERS.streets;
      tileLayerRef.current = L.tileLayer(initialProvider.url, initialProvider.options).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Map Type Switching (Streets / Satellite / Terrain)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const provider = TILE_PROVIDERS[mapType] || TILE_PROVIDERS.streets;
    tileLayerRef.current = L.tileLayer(provider.url, provider.options).addTo(map);
  }, [mapType]);

  // Recenter helper
  const handleRecenter = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const bounds = displayedSessions.map((s) => [s.location.lat, s.location.lng]);
    if (bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else {
      mapInstanceRef.current.setView([30.0444, 31.2357], 12);
    }
  }, [displayedSessions]);

  // Update Markers when displayedSessions changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

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
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [displayedSessions]);

  return (
    <div className="map-wrapper">
      <div className="map-toolbar">
        <div className="map-toolbar-top">
          <div className="map-title-row">
            <Navigation size={17} className="text-brand" />
            <span className="map-title">Live Locations ({displayedSessions.length})</span>
          </div>
          <label className="map-filter-toggle">
            <input
              type="checkbox"
              checked={filterActiveOnly}
              onChange={(e) => setFilterActiveOnly(e.target.checked)}
            />
            <span>Active only</span>
          </label>
        </div>

        <div className="map-toolbar-bottom">
          <div className="map-layer-switcher">
            {Object.values(TILE_PROVIDERS).map((p) => {
              const Icon = p.icon;
              const isSelected = mapType === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`map-layer-btn ${isSelected ? "active" : ""}`}
                  onClick={() => setMapType(p.id)}
                  title={`Switch to ${p.label} view`}
                >
                  <Icon size={12} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn-outline btn-sm map-recenter-btn"
            onClick={handleRecenter}
            title="Recenter map on all employees"
          >
            <Crosshair size={13} />
            <span>Recenter</span>
          </button>
        </div>
      </div>

      <div
        ref={mapContainerRef}
        className="leaflet-map-container"
        style={{ height }}
      />
    </div>
  );
}
