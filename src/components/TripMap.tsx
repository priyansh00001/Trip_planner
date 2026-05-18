"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Day colors for pins
const DAY_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ef4444", // red
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#a855f7", // purple
]

const STAY_COLOR = "#3b82f6" // blue

// Category → emoji mapping
const CATEGORY_EMOJI: Record<string, string> = {
  Cafe: "☕",
  Restaurant: "🍽️",
  Beach: "🏖️",
  Temple: "🛕",
  Museum: "🏛️",
  Market: "🛍️",
  Trek: "🥾",
  Viewpoint: "🌅",
  Club: "🎶",
  Heritage: "🏰",
  Park: "🌳",
}

function createDayIcon(dayNum: number, category: string) {
  const color = DAY_COLORS[(dayNum - 1) % DAY_COLORS.length]
  const emoji = CATEGORY_EMOJI[category] || "📍"

  return L.divIcon({
    className: "custom-map-pin",
    html: `<div style="
      background: ${color};
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      position: relative;
    ">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

function createStayIcon() {
  return L.divIcon({
    className: "custom-map-pin",
    html: `<div style="
      background: ${STAY_COLOR};
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      border: 3px solid white;
      box-shadow: 0 2px 10px rgba(59,130,246,0.5);
    ">🏨</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  })
}

function createHomeIcon() {
  return L.divIcon({
    className: "custom-map-pin",
    html: `<div style="
      background: #10b981;
      color: white;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      border: 3px solid white;
      box-shadow: 0 0 15px rgba(16,185,129,0.8);
      animation: pulse 2s infinite;
    ">🏡</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  })
}

interface TripMapProps {
  plan: any
}

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function TripMap({ plan }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const [activeDay, setActiveDay] = useState<number | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Collect all coordinates to find bounds
    const allCoords: [number, number][] = []

    plan.days?.forEach((day: any) => {
      day.activities?.forEach((act: any) => {
        if (act.lat && act.lng) allCoords.push([act.lat, act.lng])
      })
    })

    if (plan.confirmed_stay && plan.confirmed_stay.lat) {
      allCoords.push([plan.confirmed_stay.lat, plan.confirmed_stay.lng])
    } else {
      plan.recommendedStays?.forEach((stay: any) => {
        if (stay.lat && stay.lng) allCoords.push([stay.lat, stay.lng])
      })
    }

    if (allCoords.length === 0) return

    // Initialize map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    })

    // Beautiful dark tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map)

    // Add stay markers
    if (plan.confirmed_stay && plan.confirmed_stay.lat) {
      const stay = plan.confirmed_stay
      L.marker([stay.lat, stay.lng], { icon: createHomeIcon() })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui; min-width: 180px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #10b981; letter-spacing: 0.5px;">🏡 Locked Basecamp</div>
            <div style="font-size: 15px; font-weight: 700; margin-top: 4px;">${stay.name}</div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">Your Confirmed Booking</div>
          </div>
        `)
    } else {
      plan.recommendedStays?.forEach((stay: any) => {
        if (!stay.lat || !stay.lng) return
        L.marker([stay.lat, stay.lng], { icon: createStayIcon() })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui; min-width: 180px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #3b82f6; letter-spacing: 0.5px;">🏨 AI Recommendation</div>
              <div style="font-size: 15px; font-weight: 700; margin-top: 4px;">${stay.name}</div>
              <div style="font-size: 12px; color: #666; margin-top: 2px;">⭐ ${stay.rating || "N/A"} · ${stay.price}</div>
            </div>
          `)
      })
    }

    // Get primary stay coordinates for distance calculations
    let primaryStay = plan.recommendedStays?.[0]
    if (plan.confirmed_stay && plan.confirmed_stay.lat) {
      primaryStay = plan.confirmed_stay
    }
    const stayLatLng = (primaryStay?.lat && primaryStay?.lng)  
      ? L.latLng(primaryStay.lat, primaryStay.lng) 
      : null

    // Add activity markers grouped by day
    plan.days?.forEach((day: any) => {
      const dayColor = DAY_COLORS[(day.dayNumber - 1) % DAY_COLORS.length]

      day.activities?.forEach((act: any) => {
        if (!act.lat || !act.lng) return
        
        // Distance calculations from basecamp
        let distanceHtml = ""
        let actLatLng: L.LatLng | null = null
        if (stayLatLng && act.lat && act.lng) {
          actLatLng = L.latLng(act.lat, act.lng)
          const distKm = haversineKm(
            stayLatLng.lat, stayLatLng.lng,
            act.lat, act.lng
          )
          const walkMins = Math.round((distKm / 5) * 60)
          const driveMins = Math.round((distKm / 30) * 60)
          const distDisplay = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`

          distanceHtml = `
            <div style="margin-top: 8px; background: #1e40af10; border: 1px solid #3b82f630; border-radius: 8px; padding: 6px 10px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #3b82f6; letter-spacing: 0.5px; margin-bottom: 4px;">📍 From Your Basecamp</div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 700; color: #1d4ed8;">🗺️ ${distDisplay}</span>
                <span style="font-size: 12px; color: #555;">🚶 ${walkMins < 60 ? walkMins + ' min walk' : Math.round(walkMins/60) + 'h walk'}</span>
                <span style="font-size: 12px; color: #555;">🚗 ${driveMins} min drive</span>
              </div>
            </div>`
        }

        let metroHtml = ""
        if (act.nearestMetro && act.nearestMetro.station) {
          metroHtml = `<div style="font-size: 11px; color: #10b981; margin-top: 5px; font-weight: 600; background: #10b98115; padding: 2px 6px; border-radius: 4px; display: inline-block;">🚇 ${act.nearestMetro.station} (${act.nearestMetro.line}) · ${act.nearestMetro.walkMins} min walk</div>`
        }

        const marker = L.marker([act.lat, act.lng], { icon: createDayIcon(day.dayNumber, act.category) })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui; min-width: 240px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${dayColor}; letter-spacing: 0.5px;">Day ${day.dayNumber} · ${act.time}</div>
              <div style="font-size: 15px; font-weight: 700; margin-top: 4px; line-height: 1.2;">${act.name}</div>
              <div style="font-size: 12px; color: #666; margin-top: 4px; font-weight: 500;">⭐ ${act.rating || "N/A"} · ${act.costEstimate}</div>
              <div style="font-size: 11.5px; color: #888; margin-top: 6px; line-height: 1.4;">${act.description || ""}</div>
              ${distanceHtml}
              ${metroHtml}
              <div style="margin-top: 10px; display: flex; gap: 6px;">
                <a href="https://www.google.com/maps/search/?api=1&query=${act.lat},${act.lng}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px 8px; font-size: 11px; font-weight: 700; text-decoration: none; display: block;">🗺️ Open in Maps</a>
                <a href="https://www.google.com/maps/dir/?api=1&destination=${act.lat},${act.lng}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 8px; font-size: 11px; font-weight: 700; text-decoration: none; display: block;">🧭 Navigate Here</a>
              </div>
            </div>
          `)

        // Draw dashed line from stay → activity on popup open, remove on close
        if (stayLatLng && actLatLng) {
          const aLatLng = actLatLng
          marker.on("popupopen", () => {
            if (routeLineRef.current) {
              routeLineRef.current.remove()
            }
            routeLineRef.current = L.polyline(
              [stayLatLng, aLatLng],
              {
                color: "#6366f1",
                weight: 2.5,
                opacity: 0.8,
                dashArray: "8, 6",
              }
            ).addTo(map)
          })
          marker.on("popupclose", () => {
            if (routeLineRef.current) {
              routeLineRef.current.remove()
              routeLineRef.current = null
            }
          })
        }
      })

    })

    // Fit map to bounds
    const bounds = L.latLngBounds(allCoords)
    map.fitBounds(bounds, { padding: [40, 40] })

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [plan])

  // Check if we have any coordinates at all
  const hasCoords = plan.days?.some((d: any) =>
    d.activities?.some((a: any) => a.lat && a.lng)
  )

  if (!hasCoords) {
    return (
      <div className="w-full h-64 rounded-2xl bg-muted/20 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed gap-3 px-6 text-center">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-2xl">🗺️</span>
        </div>
        <p className="text-sm font-medium">Map not available for this trip</p>
        <p className="text-xs max-w-sm">This plan was generated before map support was added. Click <strong>"Modify Trip"</strong> below and regenerate to see all your places plotted on an interactive map!</p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden border shadow-lg">
      <div ref={mapRef} className="w-full h-[400px] sm:h-[500px]" />
      {/* Legend */}
      <div className="flex flex-wrap gap-3 p-3 bg-card border-t text-xs items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
            🏨 Stay
          </span>
          {plan.days?.map((day: any) => (
            <span
              key={day.dayNumber}
              className="flex items-center gap-1.5 font-semibold"
              style={{ color: DAY_COLORS[(day.dayNumber - 1) % DAY_COLORS.length] }}
            >
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ background: DAY_COLORS[(day.dayNumber - 1) % DAY_COLORS.length] }}
              />
              Day {day.dayNumber}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="text-muted-foreground/60 text-[10px] italic hidden sm:block">
            📍 Click any pin for distance &amp; directions
          </span>
          <a
            href={`https://www.google.com/maps/search/bike+scooter+rental+near+${encodeURIComponent(plan.destination)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors whitespace-nowrap"
          >
            🛵 Find Rentals Nearby
          </a>
        </div>
      </div>
    </div>
  )
}
