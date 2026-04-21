"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { Route, X, CheckSquare, Square } from "lucide-react";
import { JobsFilters } from "../jobs/filters";
import { PIN_TONE_LABEL, PIN_TONE_COLOR, type PinTone } from "@/lib/map-pin";
import { TripScheduler } from "./trip-scheduler";
import type { JobStage, Region, Product } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type Pin = {
  id: string;
  jobNumber: string;
  stage: JobStage;
  product: Product;
  latitude: number;
  longitude: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyRegion: Region;
  dueDate: string;
  scheduledDate: string | null;
  assignedTech: {
    id: string;
    name: string;
    initials: string | null;
    color: string | null;
  } | null;
  tone: PinTone;
};

type Tech = {
  id: string;
  name: string;
  initials: string | null;
  color: string | null;
};

const CA_CENTER = { lat: 36.7783, lng: -119.4179 };

export function MapView({
  pins,
  techs,
  canEdit,
  apiKey,
}: {
  pins: Pin[];
  techs: Tech[];
  canEdit: boolean;
  apiKey: string;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    apiKey ? "loading" : "error",
  );
  const [tripMode, setTripMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  const selectedPins = useMemo(
    () => pins.filter((p) => selectedIds.has(p.id)),
    [pins, selectedIds],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---- Load the Google Maps SDK once ---------------------------------------
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    try {
      setOptions({ key: apiKey, v: "weekly" });
    } catch {
      // setOptions is a no-op if called twice; swallow.
    }
    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(() => {
        if (!cancelled) setLoadState("ready");
      })
      .catch((err) => {
        console.error("Google Maps load error", err);
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // ---- Initialize the map once the SDK is ready ---------------------------
  useEffect(() => {
    if (loadState !== "ready" || !mapDivRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(mapDivRef.current, {
      center: CA_CENTER,
      zoom: 6,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
      styles: lightMapStyles,
    });
    infoRef.current = new google.maps.InfoWindow();
  }, [loadState]);

  // ---- (Re)render markers whenever pins change -----------------------------
  useEffect(() => {
    if (loadState !== "ready" || !mapRef.current) return;

    // Clear existing markers.
    clustererRef.current?.clearMarkers();
    for (const m of markersRef.current.values()) m.setMap(null);
    markersRef.current.clear();

    const markers: google.maps.Marker[] = [];
    for (const pin of pins) {
      const selected = selectedIds.has(pin.id);
      const marker = new google.maps.Marker({
        position: { lat: pin.latitude, lng: pin.longitude },
        title: pin.propertyName,
        icon: makePinIcon(PIN_TONE_COLOR[pin.tone], selected),
      });

      marker.addListener("click", () => {
        if (tripMode && canEdit) {
          toggleSelected(pin.id);
          return;
        }
        infoRef.current?.setContent(renderInfoHTML(pin));
        infoRef.current?.open(mapRef.current!, marker);
      });

      markersRef.current.set(pin.id, marker);
      markers.push(marker);
    }

    clustererRef.current?.clearMarkers();
    clustererRef.current = new MarkerClusterer({
      map: mapRef.current,
      markers,
    });
  }, [pins, loadState, tripMode, canEdit, selectedIds, toggleSelected]);

  // ---- Update individual marker icons on selection change -----------------
  useEffect(() => {
    if (loadState !== "ready") return;
    for (const pin of pins) {
      const m = markersRef.current.get(pin.id);
      if (!m) continue;
      m.setIcon(makePinIcon(PIN_TONE_COLOR[pin.tone], selectedIds.has(pin.id)));
    }
  }, [selectedIds, pins, loadState]);

  // ---- Zoom helpers --------------------------------------------------------
  function zoomTo(center: google.maps.LatLngLiteral, zoom: number) {
    mapRef.current?.panTo(center);
    mapRef.current?.setZoom(zoom);
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-neutral-200 bg-white overflow-y-auto">
        <div className="p-4 space-y-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Map</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {pins.length} {pins.length === 1 ? "property" : "properties"}
            </p>
          </div>

          <JobsFilters techs={techs} />

          {canEdit && (
            <div className="border-t border-neutral-200 pt-3">
              <button
                type="button"
                onClick={() => {
                  setTripMode((v) => !v);
                  if (tripMode) clearSelection();
                }}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium transition-colors",
                  tripMode
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                )}
              >
                {tripMode ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {tripMode ? "Trip mode on — tap pins to select" : "Plan a trip"}
              </button>
              {tripMode && (
                <p className="text-[11px] text-neutral-500 mt-1.5 leading-snug">
                  Click pins on the map to add them. Good fit: nearby jobs due
                  around the same time.
                </p>
              )}
            </div>
          )}

          <div className="border-t border-neutral-200 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">
              Quick zoom
            </p>
            <div className="grid grid-cols-3 gap-1">
              <ZoomButton onClick={() => zoomTo({ lat: 38.8, lng: -121.2 }, 8)}>
                NorCal
              </ZoomButton>
              <ZoomButton onClick={() => zoomTo({ lat: 33.8, lng: -117.9 }, 8)}>
                SoCal
              </ZoomButton>
              <ZoomButton onClick={() => zoomTo(CA_CENTER, 6)}>
                All CA
              </ZoomButton>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-3">
            <Legend />
          </div>
        </div>
      </aside>

      {/* Map */}
      <div className="relative flex-1">
        {loadState === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-neutral-50">
            <p className="text-sm text-neutral-500">Loading map…</p>
          </div>
        )}
        {loadState === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-neutral-50 px-10">
            <div className="max-w-md text-center">
              <p className="text-sm font-medium text-neutral-900">
                Map can&apos;t load
              </p>
              <p className="text-xs text-neutral-500 mt-2">
                Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your{" "}
                <code>.env.local</code> to enable the map. See SETUP.md.
              </p>
            </div>
          </div>
        )}
        <div ref={mapDivRef} className="h-full w-full" />

        {/* Trip selection bar */}
        {canEdit && tripMode && selectedPins.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-neutral-900 text-white shadow-lg flex items-center gap-2 px-3 py-2">
            <Route className="h-3.5 w-3.5" />
            <span className="text-[13px] font-medium tabular-nums">
              {selectedPins.length} selected
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="p-1 rounded hover:bg-white/10"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSchedulerOpen(true)}
              disabled={selectedPins.length < 1}
              className="ml-1 rounded-md bg-orange-600 px-3 h-7 text-[12px] font-semibold hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Schedule as trip
            </button>
          </div>
        )}
      </div>

      {/* Trip scheduler modal */}
      {schedulerOpen && (
        <TripScheduler
          pins={selectedPins}
          techs={techs}
          onClose={() => setSchedulerOpen(false)}
          onScheduled={() => {
            setSchedulerOpen(false);
            setTripMode(false);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}

function ZoomButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 rounded-md border border-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:border-neutral-300 hover:text-neutral-900"
    >
      {children}
    </button>
  );
}

function Legend() {
  const tones: PinTone[] = [
    "overdue",
    "dueSoon",
    "dueLater",
    "scheduled",
    "confirmed",
    "inProgress",
    "completed",
    "deferred",
  ];
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">
        Legend
      </p>
      <ul className="space-y-1">
        {tones.map((t) => (
          <li key={t} className="flex items-center gap-2 text-[11px]">
            <span
              className="h-2.5 w-2.5 rounded-full border border-white ring-1 ring-neutral-300"
              style={{ backgroundColor: PIN_TONE_COLOR[t] }}
            />
            <span className="text-neutral-600">{PIN_TONE_LABEL[t]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Render an SVG pin icon using the color and a "selected" outline. */
function makePinIcon(color: string, selected: boolean): google.maps.Icon {
  const stroke = selected ? "#111827" : "#ffffff";
  const strokeWidth = selected ? 3 : 2;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='28' height='32'>` +
    `<path d='M12 0c-5 0-9 4-9 9 0 7 9 15 9 15s9-8 9-15c0-5-4-9-9-9z' fill='${color}' stroke='${stroke}' stroke-width='${strokeWidth}'/>` +
    `<circle cx='12' cy='9' r='3' fill='#ffffff'/>` +
    `</svg>`;
  return {
    url: "data:image/svg+xml;utf8," + encodeURIComponent(svg),
    anchor: new google.maps.Point(14, 30),
    scaledSize: new google.maps.Size(28, 32),
  };
}

function renderInfoHTML(pin: Pin): string {
  const tech = pin.assignedTech
    ? `<div style="font-size:11px;color:#6b7280;">${escapeHtml(pin.assignedTech.name)}</div>`
    : `<div style="font-size:11px;color:#9ca3af;">Unassigned</div>`;
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;min-width:220px;padding:4px 2px;">
      <div style="font-size:10px;color:#6b7280;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(pin.jobNumber)}</div>
      <div style="font-size:14px;font-weight:600;letter-spacing:-0.01em;margin-top:2px;">${escapeHtml(pin.propertyName)}</div>
      <div style="font-size:12px;color:#4b5563;margin-top:1px;">${escapeHtml(pin.propertyAddress)}, ${escapeHtml(pin.propertyCity)}</div>
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center;">
        <span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#f3f4f6;font-size:10px;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(pin.product.replace(/_/g, "-"))}</span>
        ${tech}
      </div>
      <a href="/jobs/${pin.id}" style="display:inline-block;margin-top:8px;font-size:12px;color:#ea580c;text-decoration:none;font-weight:500;">Open job →</a>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Clean, Linear-style map styles: soft neutral terrain, muted roads.
const lightMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#60a5fa" }] },
];
