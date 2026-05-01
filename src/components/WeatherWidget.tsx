"use client"

import { useEffect, useState } from "react"
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Eye, Loader2, MapPin } from "lucide-react"

// WMO weather code → label + icon
function getWeatherInfo(code: number): { label: string; Icon: any; color: string } {
  if (code === 0) return { label: "Clear Sky", Icon: Sun, color: "text-yellow-500" }
  if (code <= 3) return { label: "Partly Cloudy", Icon: Cloud, color: "text-slate-400" }
  if (code <= 48) return { label: "Foggy", Icon: Cloud, color: "text-slate-400" }
  if (code <= 67) return { label: "Rain", Icon: CloudRain, color: "text-blue-500" }
  if (code <= 77) return { label: "Snow", Icon: CloudSnow, color: "text-sky-300" }
  if (code <= 82) return { label: "Rain Showers", Icon: CloudRain, color: "text-blue-600" }
  if (code <= 99) return { label: "Thunderstorm", Icon: CloudLightning, color: "text-purple-500" }
  return { label: "Unknown", Icon: Cloud, color: "text-slate-400" }
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

interface WeatherWidgetProps {
  destination: string
  lat?: number
  lng?: number
}

export default function WeatherWidget({ destination, lat, lng }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!destination) return

    async function fetchWeather() {
      setLoading(true)
      setError(null)
      try {
        let finalLat = lat
        let finalLng = lng

        // Step 1: Geocode destination via Nominatim ONLY if exact coordinates weren't provided
        if (!finalLat || !finalLng) {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination + ", India")}&format=json&limit=1`,
            { headers: { "User-Agent": "TripPlanner/1.0" } }
          )
          const geoData = await geoRes.json()
          if (!geoData.length) throw new Error("Location not found")
          finalLat = parseFloat(geoData[0].lat)
          finalLng = parseFloat(geoData[0].lon)
        }

        // Step 2: Fetch 7-day forecast from Open-Meteo (free, no key)
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${finalLat}&longitude=${finalLng}` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
          `&current=temperature_2m,wind_speed_10m,weather_code&timezone=Asia%2FKolkata`
        )
        const weatherData = await weatherRes.json()
        setWeather({ ...weatherData, lat: finalLat, lon: finalLng })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
  }, [destination])

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 border text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>Fetching live weather for {destination}...</span>
      </div>
    )
  }

  if (error || !weather || !weather.current || !weather.daily) {
    return null // Fail silently — weather is supplementary
  }

  const { current, daily } = weather
  const currentInfo = getWeatherInfo(current.weather_code)
  const CurrentIcon = currentInfo.Icon

  return (
    <div className="rounded-2xl overflow-hidden border shadow-sm bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-indigo-500/10 dark:from-sky-900/20 dark:via-blue-900/10 dark:to-indigo-900/20">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-b border-white/10">
        {/* Current conditions */}
        <div className="flex items-center gap-4 flex-1">
          <div className={`p-3 rounded-xl bg-white/20 dark:bg-white/5 backdrop-blur-sm ${currentInfo.color}`}>
            <CurrentIcon className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-3xl font-extrabold tracking-tight">
                {Math.round(current.temperature_2m)}°C
              </span>
              <span className="text-sm font-medium text-muted-foreground">{currentInfo.label}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Live weather · {destination}</span>
            </div>
          </div>
        </div>

        {/* Current stats */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Wind className="h-3.5 w-3.5 text-sky-500" />
            <span>{Math.round(current.wind_speed_10m)} km/h</span>
          </div>
          {daily.precipitation_sum?.[0] !== undefined && (
            <div className="flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5 text-blue-500" />
              <span>{daily.precipitation_sum[0].toFixed(1)} mm today</span>
            </div>
          )}
        </div>
      </div>

      {/* 7-day forecast strip */}
      <div className="grid grid-cols-7 divide-x divide-white/10 px-2 py-3">
        {daily.time?.slice(0, 7).map((dateStr: string, i: number) => {
          const date = new Date(dateStr)
          const info = getWeatherInfo(daily.weather_code[i])
          const DayIcon = info.Icon
          const isToday = i === 0

          return (
            <div
              key={dateStr}
              className={`flex flex-col items-center gap-1.5 px-1 py-1 rounded-lg transition-all ${
                isToday ? "bg-white/10 dark:bg-white/5" : ""
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {isToday ? "Today" : DAYS[date.getDay()]}
              </span>
              <DayIcon className={`h-4 w-4 ${info.color}`} />
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-bold">{Math.round(daily.temperature_2m_max[i])}°</span>
                <span className="text-[10px] text-muted-foreground">{Math.round(daily.temperature_2m_min[i])}°</span>
              </div>
              {daily.precipitation_sum[i] > 0 && (
                <span className="text-[9px] text-blue-500 font-medium">{daily.precipitation_sum[i].toFixed(0)}mm</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 pb-3 pt-1">
        <p className="text-[10px] text-muted-foreground/50">
          Live data via Open-Meteo · Updated now · {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}
