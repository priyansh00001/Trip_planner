"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { X, LocateFixed, Loader2, TrainFront, Navigation, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MetroDrawerProps {
  isOpen: boolean
  onClose: () => void
  plan: any
}

const LINE_COLORS: Record<string, string> = {
  "Yellow Line": "#FFD700",
  "Blue Line": "#0000FF",
  "Red Line": "#FF0000",
  "Green Line": "#008000",
  "Violet Line": "#8B008B",
  "Magenta Line": "#FF00FF",
  "Pink Line": "#FF69B4",
  "Orange Line": "#FFA500",
  "Aqua Line": "#00CED1",
  "Grey Line": "#808080",
  "Purple Line": "#800080",
}

function getLineColor(line: string): string {
  for (const [key, color] of Object.entries(LINE_COLORS)) {
    if (line.toLowerCase().includes(key.toLowerCase().replace(" line", ""))) return color
  }
  return "#6366f1"
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function MetroDrawer({ isOpen, onClose, plan }: MetroDrawerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [stations, setStations] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMetro, setHasMetro] = useState<boolean | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [nearestToUser, setNearestToUser] = useState<any>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)

  // Fetch metro stations when drawer opens
  useEffect(() => {
    if (!isOpen || stations.length > 0 || loading) return

    async function fetchStations() {
      setLoading(true)
      try {
        const res = await fetch('/api/metro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination: plan.destination })
        })
        const data = await res.json()
        setHasMetro(data.hasMetro)
        setStations(data.stations || [])
      } catch (e) {
        console.error(e)
        setHasMetro(false)
      }
      setLoading(false)
    }
    fetchStations()
  }, [isOpen])

  // Build map
  useEffect(() => {
    if (!isOpen || !mapRef.current || stations.length === 0) return

    // Cleanup previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true })

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
    }).addTo(map)

    const allCoords: [number, number][] = []

    // Plot metro stations
    stations.forEach((s) => {
      if (!s.lat || !s.lng) return
      const color = getLineColor(s.line)
      allCoords.push([s.lat, s.lng])

      const icon = L.divIcon({
        className: "metro-station-pin",
        html: `<div style="
          background: ${color};
          width: 14px; height: 14px;
          border-radius: 50%;
          border: 2.5px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -10],
      })

      L.marker([s.lat, s.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui; min-width: 160px;">
            <div style="font-size: 10px; font-weight: 800; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">🚇 ${s.line}</div>
            <div style="font-size: 14px; font-weight: 700; margin-top: 3px;">${s.name}</div>
          </div>
        `)
    })

    // Plot activity pins from itinerary
    plan.days?.forEach((day: any) => {
      day.activities?.forEach((act: any) => {
        if (!act.lat || !act.lng) return
        allCoords.push([act.lat, act.lng])

        const actIcon = L.divIcon({
          className: "activity-pin",
          html: `<div style="
            background: #6366f1;
            width: 20px; height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; color: white;
          ">📍</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          popupAnchor: [0, -12],
        })

        // Find nearest metro to this activity
        let nearest = null as any
        let minDist = Infinity
        stations.forEach((s) => {
          const d = calcDistance(act.lat, act.lng, s.lat, s.lng)
          if (d < minDist) { minDist = d; nearest = s }
        })

        const nearestText = nearest
          ? `<div style="font-size: 11px; color: #10b981; margin-top: 5px; font-weight: 600; background: #10b98115; padding: 2px 6px; border-radius: 4px;">🚇 Nearest: ${nearest.name} (${minDist.toFixed(1)} km)</div>`
          : ""

        L.marker([act.lat, act.lng], { icon: actIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui; min-width: 180px;">
              <div style="font-size: 10px; font-weight: 700; color: #6366f1; text-transform: uppercase;">📍 Activity</div>
              <div style="font-size: 14px; font-weight: 700; margin-top: 3px;">${act.name}</div>
              ${nearestText}
            </div>
          `)

        // Draw dashed line from activity to nearest metro
        if (nearest) {
          L.polyline([[act.lat, act.lng], [nearest.lat, nearest.lng]], {
            color: "#10b981",
            weight: 2,
            opacity: 0.4,
            dashArray: "5, 5",
          }).addTo(map)
        }
      })
    })

    // Plot hotel/basecamp
    plan.recommendedStays?.forEach((stay: any) => {
      if (!stay.lat || !stay.lng) return
      allCoords.push([stay.lat, stay.lng])

      const stayIcon = L.divIcon({
        className: "stay-pin",
        html: `<div style="
          background: #3b82f6;
          width: 24px; height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(59,130,246,0.5);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px;
        ">🏨</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14],
      })

      let nearest = null as any
      let minDist = Infinity
      stations.forEach((s) => {
        const d = calcDistance(stay.lat, stay.lng, s.lat, s.lng)
        if (d < minDist) { minDist = d; nearest = s }
      })

      const nearestText = nearest
        ? `<div style="font-size: 11px; color: #10b981; margin-top: 5px; font-weight: 600; background: #10b98115; padding: 2px 6px; border-radius: 4px;">🚇 Nearest: ${nearest.name} (${minDist.toFixed(1)} km)</div>`
        : ""

      L.marker([stay.lat, stay.lng], { icon: stayIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui; min-width: 180px;">
            <div style="font-size: 10px; font-weight: 700; color: #3b82f6; text-transform: uppercase;">🏨 Your Stay</div>
            <div style="font-size: 14px; font-weight: 700; margin-top: 3px;">${stay.name}</div>
            ${nearestText}
          </div>
        `)
    })

    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [30, 30] })
    }

    mapInstanceRef.current = map

    // Fix for Leaflet rendering inside a sliding drawer:
    // We must invalidate the size after the CSS slide-in animation finishes (300ms)
    // otherwise the map tiles might appear grey or squished in the corner
    const timeoutId = setTimeout(() => {
      map.invalidateSize()
    }, 350)

    return () => {
      clearTimeout(timeoutId)
      map.remove()
      mapInstanceRef.current = null
    }
  }, [isOpen, stations])

  // Handle Locate Me
  const handleLocateMe = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setLocating(false)

        const map = mapInstanceRef.current
        if (!map) return

        // Remove old user marker
        if (userMarkerRef.current) map.removeLayer(userMarkerRef.current)
        if (routeLineRef.current) map.removeLayer(routeLineRef.current)

        // Add user marker
        const userIcon = L.divIcon({
          className: "user-pin",
          html: `<div style="
            background: #ef4444;
            width: 20px; height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 12px rgba(239,68,68,0.6);
            animation: pulse 2s infinite;
          "></div>
          <style>@keyframes pulse { 0%,100% { box-shadow: 0 0 12px rgba(239,68,68,0.6); } 50% { box-shadow: 0 0 24px rgba(239,68,68,0.9); } }</style>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          popupAnchor: [0, -12],
        })

        userMarkerRef.current = L.marker([loc.lat, loc.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup(`<div style="font-family: system-ui; font-weight: 700;">📍 You are here</div>`)
          .openPopup()

        // Find nearest station to user
        let nearest = null as any
        let minDist = Infinity
        stations.forEach((s) => {
          const d = calcDistance(loc.lat, loc.lng, s.lat, s.lng)
          if (d < minDist) { minDist = d; nearest = { ...s, distance: d } }
        })

        if (nearest) {
          setNearestToUser(nearest)
          routeLineRef.current = L.polyline(
            [[loc.lat, loc.lng], [nearest.lat, nearest.lng]],
            { color: "#ef4444", weight: 3, opacity: 0.7, dashArray: "8, 6" }
          ).addTo(map)

          map.fitBounds(L.latLngBounds([[loc.lat, loc.lng], [nearest.lat, nearest.lng]]), { padding: [50, 50] })
        } else {
          map.setView([loc.lat, loc.lng], 14)
        }
      },
      (err) => {
        console.error("Geolocation error:", err)
        setLocating(false)
      },
      { enableHighAccuracy: true }
    )
  }

  // Sort stations by distance from user (or hotel)
  const refPoint = userLocation || (plan.recommendedStays?.[0]?.lat ? { lat: plan.recommendedStays[0].lat, lng: plan.recommendedStays[0].lng } : null)
  const sortedStations = refPoint
    ? [...stations].map(s => ({ ...s, distance: calcDistance(refPoint.lat, refPoint.lng, s.lat, s.lng) })).sort((a, b) => a.distance - b.distance)
    : stations

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: 9998 }} onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300" style={{ zIndex: 9999 }}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-2">
            <TrainFront className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-bold">Metro Navigator</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm font-medium">Finding metro stations in {plan.destination}...</p>
          </div>
        ) : hasMetro === false || stations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-3xl">🚌</div>
            <h3 className="text-lg font-bold">No Metro in {plan.destination}</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              This city doesn't have a metro system yet. Use auto-rickshaws, cabs (Ola/Uber), or local buses to get around.
            </p>
          </div>
        ) : (
          <>
            {/* Map */}
            <div className="h-[300px] sm:h-[350px] w-full relative">
              <div ref={mapRef} className="w-full h-full" />

              {/* Locate Me button */}
              <Button
                size="sm"
                className="absolute bottom-3 right-3 z-[1000] bg-red-500 hover:bg-red-600 text-white shadow-lg gap-1.5 font-bold"
                onClick={handleLocateMe}
                disabled={locating}
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                {locating ? "Finding you..." : "Locate Me"}
              </Button>
            </div>

            {/* Route suggestion */}
            {nearestToUser && (
              <div className="px-4 py-3 bg-emerald-500/10 border-y border-emerald-500/20">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Nearest Metro to You</p>
                    <p className="text-sm font-bold flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5 shrink-0" />
                      <span>Walk to <span className="text-emerald-600 dark:text-emerald-400">{nearestToUser.name}</span> ({nearestToUser.distance.toFixed(1)} km)</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Take the <strong className="text-foreground">{nearestToUser.line}</strong> from {nearestToUser.name}
                    </p>
                  </div>
                  {userLocation && (
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${nearestToUser.lat},${nearestToUser.lng}&travelmode=walking`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex flex-col items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                      title="Open in Google Maps"
                    >
                      <MapPin className="h-4 w-4 mb-0.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Navigate</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Station list */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 sticky top-0 bg-card border-b z-10 flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {stations.length} Stations · {plan.destination}
                </p>
                {refPoint && (
                  <p className="text-xs text-muted-foreground">
                    Sorted by distance
                  </p>
                )}
              </div>
              <div className="divide-y">
                {sortedStations.map((s: any, idx: number) => {
                  const color = getLineColor(s.line)
                  return (
                    <button
                      key={idx}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => {
                        const map = mapInstanceRef.current
                        if (map) {
                          map.setView([s.lat, s.lng], 16)
                        }
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm"
                        style={{ background: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.line}</p>
                      </div>
                      {s.distance !== undefined && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                          {s.distance.toFixed(1)} km
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
