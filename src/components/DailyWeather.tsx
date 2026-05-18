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
// Soft Luxury minimal styling for weather icons
const getWeatherDetails = (code: number) => {
  if (code === 0) return { icon: Sun, label: "Clear" }
  if (code <= 3) return { icon: Cloud, label: "Cloudy" }
  if (code === 45 || code === 48) return { icon: CloudFog, label: "Foggy" }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: CloudRain, label: "Rain" }
  if (code >= 71 && code <= 77) return { icon: Snowflake, label: "Snow" }
  if (code >= 95) return { icon: CloudLightning, label: "Storm" }
  
  // Fallback
  return { icon: Sun, label: "Sunny" }
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
      className={`flex items-center gap-2 ml-auto px-4 py-2 rounded-none border border-foreground/20 bg-transparent shadow-none transition-colors hover:bg-foreground hover:text-background cursor-pointer group text-foreground`}
      title={`${details.label} - High of ${data.temp}°C`}
    >
      <Icon className={`h-4 w-4 opacity-70 group-hover:opacity-100`} />
      <span className={`text-[10px] font-medium tracking-widest uppercase`}>
        {data.temp}°C
      </span>
    </div>
  )
}
