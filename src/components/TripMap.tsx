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

interface TripMapProps {
  plan: any
}

export default function TripMap({ plan }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
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

    plan.recommendedStays?.forEach((stay: any) => {
      if (stay.lat && stay.lng) allCoords.push([stay.lat, stay.lng])
    })

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
    plan.recommendedStays?.forEach((stay: any) => {
      if (!stay.lat || !stay.lng) return
      L.marker([stay.lat, stay.lng], { icon: createStayIcon() })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui; min-width: 180px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #3b82f6; letter-spacing: 0.5px;">🏨 Your Stay</div>
            <div style="font-size: 15px; font-weight: 700; margin-top: 4px;">${stay.name}</div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">⭐ ${stay.rating || "N/A"} · ${stay.price}</div>
          </div>
        `)
    })

    // Add activity markers grouped by day
    plan.days?.forEach((day: any) => {
      const dayColor = DAY_COLORS[(day.dayNumber - 1) % DAY_COLORS.length]

      day.activities?.forEach((act: any) => {
        if (!act.lat || !act.lng) return
        L.marker([act.lat, act.lng], { icon: createDayIcon(day.dayNumber, act.category) })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui; min-width: 200px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${dayColor}; letter-spacing: 0.5px;">Day ${day.dayNumber} · ${act.time}</div>
              <div style="font-size: 15px; font-weight: 700; margin-top: 4px;">${act.name}</div>
              <div style="font-size: 12px; color: #666; margin-top: 2px;">⭐ ${act.rating || "N/A"} · ${act.costEstimate}</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">${act.description || ""}</div>
            </div>
          `)
      })

      // Draw route lines connecting activities within a day
      const dayCoords: [number, number][] = day.activities
        ?.filter((a: any) => a.lat && a.lng)
        .map((a: any) => [a.lat, a.lng] as [number, number]) || []

      if (dayCoords.length >= 2) {
        L.polyline(dayCoords, {
          color: dayColor,
          weight: 3,
          opacity: 0.6,
          dashArray: "8, 6",
        }).addTo(map)
      }
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
      <div className="w-full h-64 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground border border-dashed">
        <p className="text-sm">Map unavailable — no coordinates in this plan. Regenerate to enable the map.</p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden border shadow-lg">
      <div ref={mapRef} className="w-full h-[400px] sm:h-[500px]" />
      {/* Legend */}
      <div className="flex flex-wrap gap-3 p-3 bg-card border-t text-xs">
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
    </div>
  )
}
