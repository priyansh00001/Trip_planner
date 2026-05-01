"use client"

import { useEffect, useState } from "react"
import { Sun, Cloud, CloudRain, CloudLightning, Snowflake, CloudFog, Loader2 } from "lucide-react"

interface DailyWeatherProps {
  lat: number
  lng: number
  dayOffset: number
  startDate?: string
}

// Map WMO Weather Codes to Beautiful Lucide Icons & Descriptions
// Source: https://open-meteo.com/en/docs
const getWeatherDetails = (code: number) => {
  if (code === 0) return { icon: Sun, label: "Clear", color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30 border-amber-200" }
  if (code <= 3) return { icon: Cloud, label: "Cloudy", color: "text-sky-500", bg: "bg-sky-100 dark:bg-sky-900/30 border-sky-200" }
  if (code === 45 || code === 48) return { icon: CloudFog, label: "Foggy", color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-900/30 border-slate-200" }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: CloudRain, label: "Rain", color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30 border-blue-200" }
  if (code >= 71 && code <= 77) return { icon: Snowflake, label: "Snow", color: "text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200" }
  if (code >= 95) return { icon: CloudLightning, label: "Storm", color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30 border-purple-200" }
  
  // Fallback
  return { icon: Sun, label: "Sunny", color: "text-amber-500", bg: "bg-amber-100 border-amber-200" }
}

export default function DailyWeather({ lat, lng, dayOffset, startDate }: DailyWeatherProps) {
  const [data, setData] = useState<{ temp: number; code: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchWeather() {
      if (!lat || !lng) {
        setError(true)
        setLoading(false)
        return
      }

      try {
        let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max&timezone=auto`
        let validIndex = Math.min(dayOffset, 6) // Default fallback

        // If user provided a specific travel date
        if (startDate) {
          const start = new Date(startDate)
          const today = new Date()
          today.setHours(0,0,0,0)
          
          // Add day index offset to the journey start date
          const target = new Date(start)
          target.setDate(target.getDate() + dayOffset)

          const diffDays = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (diffDays > 14) {
            // Weather APIs can't accurately predict more than 14-16 days out
            setLoading(false)
            return // Don't show the badge at all
          }

          // If the date is in the past, meteorology APIs won't have forecast data either. Let's just use current weather or historical.
          // For simplicity, if it's within window, strictly target it!
          if (diffDays >= 0 && diffDays <= 14) {
            const targetStr = target.toISOString().split('T')[0]
            url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max&timezone=auto&start_date=${targetStr}&end_date=${targetStr}`
            validIndex = 0 // Since we only requested exactly 1 day, the array naturally only has 1 element!
          }
        }

        const res = await fetch(url)
        const json = await res.json()

        if (json && json.daily && json.daily.temperature_2m_max[validIndex] !== undefined) {
          setData({
            temp: Math.round(json.daily.temperature_2m_max[validIndex]),
            code: json.daily.weathercode[validIndex],
          })
        } else {
          setError(true)
        }
      } catch (err) {
        console.error("Failed to fetch weather", err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
  }, [lat, lng, dayOffset, startDate])

  if (loading) {
    return (
      <div className="flex items-center ml-auto px-3 py-1.5 bg-muted rounded-full animate-pulse border shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) return null // Fail silently so it doesn't ruin the gorgeous header UI

  const details = getWeatherDetails(data.code)
  const Icon = details.icon

  return (
    <div 
      className={`flex items-center gap-2 ml-auto px-3.5 py-1.5 rounded-full border shadow-sm transition-all hover:scale-105 cursor-pointer ${details.bg}`}
      title={`${details.label} - High of ${data.temp}°C`}
    >
      <Icon className={`h-4 w-4 ${details.color}`} />
      <span className={`text-sm font-bold ${details.color} drop-shadow-sm`}>
        {data.temp}°C
      </span>
    </div>
  )
}
