import { useEffect, useRef } from "react";

declare global { interface Window { google?: any; initLovableMap?: () => void; __mapLoading?: boolean; __mapReady?: Promise<void>; } }

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__mapReady) return window.__mapReady;
  window.__mapReady = new Promise((resolve) => {
    window.initLovableMap = () => resolve();
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const tid = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=initLovableMap&channel=${tid}`;
    s.async = true;
    document.head.appendChild(s);
  });
  return window.__mapReady;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  color?: string;
  info?: string;
}

// Light pastel map style — soft beige land, pale blue water, muted labels
const PASTEL_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#faf7f2" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a8794" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#faf7f2" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#d6cfc4" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#5a6671" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#f0ebe1" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e4ecd9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f5f0e6" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ebe2d0" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#d6cfc4" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#e8f0f7" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7a9cb8" }] },
];

export function GoogleMap({ markers, height = 500 }: { markers: MapMarker[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerObjs = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !ref.current) return;
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(ref.current, {
          center: { lat: 36.5, lng: 127.8 },
          zoom: 7,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: PASTEL_STYLE,
          backgroundColor: "#faf7f2",
        });
      }
      // clear
      markerObjs.current.forEach((m) => m.setMap(null));
      markerObjs.current = [];

      const bounds = new window.google.maps.LatLngBounds();
      const info = new window.google.maps.InfoWindow();
      markers.forEach((m) => {
        const pos = { lat: m.lat, lng: m.lng };
        const marker = new window.google.maps.Marker({
          position: pos,
          map: mapRef.current,
          title: m.title,
          icon: m.color ? {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: m.color,
            fillOpacity: 0.9,
            strokeColor: "#fff",
            strokeWeight: 2,
          } : undefined,
        });
        if (m.info) {
          marker.addListener("click", () => {
            info.setContent(m.info!);
            info.open({ anchor: marker, map: mapRef.current });
          });
        }
        markerObjs.current.push(marker);
        bounds.extend(pos);
      });
      if (markers.length > 0) mapRef.current.fitBounds(bounds, 60);
    });
    return () => { cancelled = true; };
  }, [markers]);

  return <div ref={ref} style={{ width: "100%", height, borderRadius: 8 }} />;
}
