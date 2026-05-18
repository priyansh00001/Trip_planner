import { NextResponse } from 'next/server'
import { callAI, parseAIJson } from '@/lib/ai'

// In-memory cache for ultra-fast subsequent loads
const METRO_CACHE = new Map<string, any>()

// Geocode a station name via Nominatim to get verified real GPS coordinates
async function geocodeStation(stationName: string, city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(`${stationName} metro station ${city} India`)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=in`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TripPlanner/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    
    if (!res.ok) {
      console.warn(`Geocoding failed for "${stationName}": Status ${res.status}`)
      return null
    }

    const text = await res.text()
    if (!text) return null
    
    try {
      const data = JSON.parse(text)
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      }
    } catch (e) {
      console.warn(`Geocoding failed for "${stationName}": Invalid JSON response`)
    }
  } catch (err) {
    console.warn(`Geocoding failed for "${stationName}":`, err)
  }
  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const destination = body.destination || ""
    const city = destination.toLowerCase().replace(/[^a-z0-9]/g, '').trim()

    if (!city) {
      return NextResponse.json({ error: "Destination missing" }, { status: 400 })
    }

    // 1. Check in-memory cache first (prevents any repeat API calls)
    if (METRO_CACHE.has(city)) {
      return NextResponse.json(METRO_CACHE.get(city))
    }

    let stations: any[] = []

    // OPTION 1: OpenStreetMap Overpass API — real data with accurate coordinates
    try {
      const overpassQuery = `
        [out:json][timeout:12];
        area["name"~"${destination}","i"]["admin_level"~"[2-6]"]->. searchArea;
        (
          node["railway"="station"]["station"="subway"](area.searchArea);
          node["railway"="station"]["network"~"metro","i"](area.searchArea);
          node["station"="subway"](area.searchArea);
        );
        out body;
      `
      const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: AbortSignal.timeout(12000),
      })

      if (overpassRes.ok) {
        const data = await overpassRes.json()
        if (data.elements && data.elements.length > 0) {
          stations = data.elements
            .filter((el: any) => el.lat && el.lon && el.tags?.name)
            .map((el: any) => ({
              name: el.tags.name,
              line: el.tags.network || el.tags.line || el.tags["railway:line"] || "Metro",
              lat: el.lat,
              lng: el.lon,
            }))
          console.log(`Overpass found ${stations.length} metro stations for ${destination}`)
        }
      }
    } catch (err: any) {
      console.warn("Overpass API error:", err.message)
    }

    // OPTION 2: AI names → Nominatim geocoding (if Overpass returned nothing)
    // Uses shared callAI() with Groq→Gemini cascade
    if (stations.length === 0) {
      const prompt = `List ALL metro/subway station names in ${destination}, India.
If ${destination} does NOT have a metro system, return hasMetro: false.

IMPORTANT: Do NOT include latitude/longitude coordinates. Only provide station names and metro line names.

Return ONLY valid JSON:
{
  "hasMetro": true,
  "stations": [
    { "name": "Shivaji Park", "line": "Aqua Line" },
    { "name": "Dadar", "line": "Yellow Line" }
  ]
}`

      const { content, provider } = await callAI({
        prompt,
        systemPrompt: 'You are an Indian public transport expert. Respond ONLY with valid JSON.',
        temperature: 0.1,
        maxTokens: 2000,
      })

      if (provider !== 'none' && content) {
        const parsed = parseAIJson(content)

        if (parsed?.hasMetro && parsed.stations?.length > 0) {
          console.log(`AI found ${parsed.stations.length} station names. Geocoding each via Nominatim...`)

          // Geocode each station name one by one with a 1100ms delay
          // to respect Nominatim's 1 request/second rate limit
          const geocodedStations: any[] = []
          for (let i = 0; i < parsed.stations.length; i++) {
            const s = parsed.stations[i]
            const coords = await geocodeStation(s.name, destination)
            if (coords) {
              geocodedStations.push({
                name: s.name,
                line: s.line || "Metro",
                lat: coords.lat,
                lng: coords.lng,
              })
            } else {
              console.warn(`Could not geocode station: ${s.name} — skipping`)
            }
              await new Promise(r => setTimeout(r, 1100))
          }

          stations = geocodedStations
          console.log(`Geocoded ${stations.length} of ${parsed.stations.length} stations successfully`)
        }
      }
    }

    const result = {
      hasMetro: stations.length > 0,
      destination,
      stationCount: stations.length,
      stations,
    }

    // Cache results so we never re-fetch on the same server instance
    if (stations.length > 0) {
      METRO_CACHE.set(city, result)
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
